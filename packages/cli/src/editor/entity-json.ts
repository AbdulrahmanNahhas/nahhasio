import { createHmac, timingSafeEqual } from "node:crypto";

import {
  rpcInputs,
  rpcResults,
  adminEntityDraftSchema,
  adminEntityJsonDocumentSchema,
} from "@arcadia/contracts/editor-rpc";
import { z } from "zod";

import type { Sql, TransactionSql } from "../db";
import { snapshot, applyEntity, lockEntityGraph } from "./entities";
import { authorizeWrite, type EditorContext } from "./service";

type HumanEntity = z.infer<typeof adminEntityJsonDocumentSchema>["records"][number];
type EntitySnapshot = Awaited<ReturnType<typeof snapshot>>;
const planSchema = z.strictObject({
  purpose: z.literal("entity-json-v1"),
  accountId: z.string().uuid(),
  expiresAt: z.number(),
  kind: z.enum(["person", "organization"]),
  records: z
    .array(
      z.strictObject({
        id: z.string().uuid(),
        revision: z.string().length(64),
        draft: adminEntityDraftSchema,
      }),
    )
    .min(1)
    .max(30),
});
const secret = Buffer.from(process.env.NAHHASIO_EDITOR_SECRET ?? "", "hex");
function sign(plan: z.infer<typeof planSchema>) {
  if (secret.length !== 32) throw new Error("خدمة المراجعة غير مهيأة.");
  const payload = Buffer.from(JSON.stringify(plan)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
function readPlan(ticket: string, context: EditorContext) {
  const [payload, signature, extra] = ticket.split(".");
  if (!payload || !signature || extra || secret.length !== 32)
    throw new Error("المراجعة غير صالحة؛ أعد إعدادها.");
  const expected = createHmac("sha256", secret).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received))
    throw new Error("تغيّرت المراجعة؛ أعد إعدادها.");
  const plan = planSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
  if (plan.accountId !== context.accountId || plan.expiresAt < Date.now())
    throw new Error("انتهت صلاحية المراجعة أو تغيّر الحساب.");
  return plan;
}
async function humanRecord(tx: TransactionSql, value: EntitySnapshot): Promise<HumanEntity> {
  const image = value.draft.profileAssetId
    ? ((
        await tx<
          { path: string }[]
        >`select path from media_assets where id=${value.draft.profileAssetId}`
      )[0]?.path ?? null)
    : null;
  return {
    id: value.entity.id,
    name: value.draft.name,
    sortName: value.draft.sortName,
    description: value.draft.description,
    aliases: value.draft.aliases,
    profileImage: image,
    credits: value.draft.credits.map((credit) => ({
      work: credit.workTitle,
      role: credit.roleName,
      position: credit.position,
      isPrimary: credit.isPrimary,
    })),
  };
}
export async function readEntityJson(sql: Sql, input: z.infer<typeof rpcInputs.entityJsonRead>) {
  if (new Set(input.ids).size !== input.ids.length) throw new Error("الاختيار يحتوي على تكرار.");
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const values = [];
    for (const id of input.ids) values.push(await snapshot(tx, id, input.kind));
    return rpcResults.entityJsonRead.parse({
      document: {
        schemaVersion: 1,
        target: input.kind === "person" ? "people" : "studios",
        records: await Promise.all(values.map((value) => humanRecord(tx, value))),
      },
      originals: values.map((value) => ({ id: value.entity.id, revision: value.revision })),
      previews: values.map((value) => value.entity),
    });
  });
}
async function resolveDraft(tx: TransactionSql, record: HumanEntity, kind: string) {
  const credits = [];
  for (const credit of record.credits) {
    const works = await tx<
      { id: string; title: string }[]
    >`select id,canonical_title as title from titles where lower(canonical_title)=lower(${credit.work}) limit 2`;
    const [work] = works;
    if (works.length !== 1 || !work)
      throw new Error(
        `«${record.name}»: اسم العمل «${credit.work}» غير موجود أو غامض؛ استخدم عنواناً إنجليزياً مطابقاً.`,
      );
    const roles = await tx<
      { id: string; name: string; label: string }[]
    >`select id,label_en as name,coalesce(nullif(label_ar,''),label_en) as label from roles where entity_kind::text=${kind} and lower(label_en)=lower(${credit.role}) limit 2`;
    const [role] = roles;
    if (roles.length !== 1 || !role)
      throw new Error(`«${record.name}»: الدور «${credit.role}» غير موجود أو غامض.`);
    credits.push({
      workId: work.id,
      workTitle: work.title,
      roleId: role.id,
      roleName: role.name,
      roleLabel: role.label,
      position: credit.position,
      isPrimary: credit.isPrimary,
    });
  }
  let profileAssetId: string | null = null;
  if (record.profileImage) {
    const [asset] = await tx<
      { id: string }[]
    >`select a.id from media_assets a where a.path=${record.profileImage} or exists(select 1 from audit_logs l where l.action='admin.artwork.rename' and l.target_type='media_assets' and l.target_id=a.id::text and l.changes->>'compatibilityPath'=${record.profileImage}) order by (a.path=${record.profileImage}) desc limit 1`;
    if (!asset) throw new Error(`«${record.name}»: الصورة غير مسجلة في المكتبة.`);
    profileAssetId = asset.id;
  }
  return adminEntityDraftSchema.parse({
    name: record.name,
    sortName: record.sortName,
    description: record.description,
    aliases: record.aliases,
    credits,
    profileAssetId,
  });
}
export async function reviewEntityJson(
  sql: Sql,
  input: z.infer<typeof rpcInputs.entityJsonReview>,
  context: EditorContext,
) {
  let parsed;
  try {
    parsed = adminEntityJsonDocumentSchema.safeParse(JSON.parse(input.json));
  } catch (error) {
    throw new Error("صيغة JSON غير صالحة. صحّحها قبل المراجعة.", { cause: error });
  }
  if (!parsed.success)
    throw new Error(
      `الحقول غير صالحة: ${parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("؛ ")}`,
    );
  const document = parsed.data;
  const ids = document.records.map((record) => record.id);
  if (
    new Set(ids).size !== ids.length ||
    new Set(input.originals.map((record) => record.id)).size !== input.originals.length ||
    ids.length !== input.originals.length ||
    ids.some((id) => !input.originals.some((record) => record.id === id))
  )
    throw new Error("لا تغيّر معرّفات السجلات أو تضف/تحذف سجلات من النطاق. استخدم أدوات الإنشاء والحذف.");
  const kind = document.target === "people" ? "person" : "organization";
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const records = [];
    const plans = [];
    for (const record of document.records) {
      const original = input.originals.find((value) => value.id === record.id);
      if (!original) throw new Error("السجل خارج نطاق التحرير.");
      const before = await snapshot(tx, record.id, kind);
      if (before.revision !== original.revision)
        throw new Error("تغيّر سجل أو مساهماته على الخادم؛ أعد تحميله قبل المراجعة.");
      const baseline = await humanRecord(tx, before);
      const draft = await resolveDraft(tx, record, kind);
      const keys = draft.credits.map((credit) => `${credit.workId}:${credit.roleId}`);
      if (new Set(keys).size !== keys.length)
        throw new Error(`«${record.name}»: مساهمة العمل والدور مكررة.`);
      if (
        draft.aliases.some(
          (alias) => alias.id && !before.draft.aliases.some((previous) => previous.id === alias.id),
        )
      )
        throw new Error(`«${record.name}»: اسم بديل خارج نطاق السجل.`);
      const aliasKeys = draft.aliases.map(
        (alias) => `${alias.alias.toLowerCase()}\u0000${alias.language ?? ""}`,
      );
      if (new Set(aliasKeys).size !== aliasKeys.length)
        throw new Error(`«${record.name}»: اسم بديل مكرر.`);
      const aliasIds = draft.aliases.flatMap((alias) => (alias.id ? [alias.id] : []));
      if (new Set(aliasIds).size !== aliasIds.length)
        throw new Error(`«${record.name}»: معرّف اسم بديل مكرر.`);

      const changes = [];
      for (const key of [
        "name",
        "sortName",
        "description",
        "aliases",
        "profileImage",
        "credits",
      ] as const)
        if (JSON.stringify(baseline[key]) !== JSON.stringify(record[key]))
          changes.push({
            path: key,
            before: z.json().parse(baseline[key]),
            after: z.json().parse(record[key]),
          });
      if (changes.length) {
        records.push({ id: record.id, name: record.name, changes });
        plans.push({ id: record.id, revision: original.revision, draft });
      }
    }
    if (!plans.length) throw new Error("لا توجد تغييرات لمراجعتها.");
    const expiresAt = Date.now() + 15 * 60 * 1000;
    return {
      ticket: sign({
        purpose: "entity-json-v1",
        accountId: context.accountId,
        expiresAt,
        kind,
        records: plans,
      }),
      expiresAt,
      records,
    };
  });
}
export async function saveEntityJson(
  sql: Sql,
  input: z.infer<typeof rpcInputs.entityJsonSave>,
  context: EditorContext,
) {
  const plan = readPlan(input.ticket, context);
  return sql.begin("isolation level serializable", async (tx) => {
    await authorizeWrite(tx, context);
    await lockEntityGraph(
      tx,
      plan.records.map((record) => record.id),
      plan.records.flatMap((record) => record.draft.credits),
    );
    for (const record of plan.records)
      await applyEntity(tx, { ...record, kind: plan.kind }, context);
    return { saved: plan.records.length };
  });
}
