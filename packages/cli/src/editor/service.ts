import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import {
  documentChanges,
  documentRow,
  isJsonObject,
  isJsonNumber,
  equalValue,
  fieldKeys,
  projectionSchema,
  type JsonValue,
  type DocumentReview,
} from "@arcadia/contracts/editor";
import { preserveHidden } from "@arcadia/contracts/projection";
import { z } from "zod";

import { workApply, workDocument, workExport, type WorkDocument } from "../commands/work";
import { openDatabase, type TransactionSql } from "../db";

const secret = process.env.NAHHASIO_EDITOR_SECRET
  ? Buffer.from(process.env.NAHHASIO_EDITOR_SECRET, "hex")
  : randomBytes(32);
if (secret.length !== 32) throw new Error("Editor signing configuration is invalid");
export type EditorContext = { accountId: string; sessionKey: string };
export async function authorizeWrite(transaction: TransactionSql, context?: EditorContext) {
  if (!context) return; // Transitional website still guards its own loopback-only calls.
  const rows =
    await transaction`select a.id from auth_sessions s join auth_users u on u.id=s.user_id join accounts a on a.auth_user_id=u.id where s.token=${context.sessionKey} and s.expires_at>now() and a.id=${context.accountId} and a.kind='admin' and a.status='active' and u.role in ('owner','admin') and (not u.banned or u.ban_expires<=now()) for update of a,u,s`;
  if (!rows.length) throw new Error("انتهت الجلسة أو تغيّرت صلاحيات الإدارة.");
}
const rowWithId = documentRow.refine((row) => z.string().uuid().safeParse(row.id).success);
const planSchema = z.object({
  actorAccountId: z.string().uuid().optional(),
  expiresAt: z.number(),
  records: z.array(
    z.object({
      id: z.string().uuid(),
      create: z.boolean().default(false),
      revision: z.string(),
      patch: rowWithId,
      after: z.string(),
    }),
  ),
});
type Plan = z.infer<typeof planSchema>;
function validateInstallmentIdentities(document: WorkDocument) {
  for (const field of ["tmdbId", "imdbId", "anilistId", "malId"] as const) {
    const owners = new Map<string | number, string>();
    for (const installment of document.installments ?? []) {
      const value = installment[field];
      if (value === null || value === undefined) continue;
      const previous = owners.get(value);
      if (previous)
        throw new Error(
          `معرّف ${field.replace("Id", "").toUpperCase()} مكرر بين «${previous}» و«${installment.title}». معرّف الأنثولوجيا يوضع ضمن مراجع العمل، وليس على كل جزء.`,
        );
      owners.set(value, installment.title);
    }
  }
}
export function revision(document: WorkDocument) {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}
function ticket(plan: Plan) {
  const payload = Buffer.from(JSON.stringify(plan)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function readTicket(value: string) {
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) throw new Error("المراجعة غير صالحة؛ أعد مراجعة المسودة.");
  const expected = createHmac("sha256", secret).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected))
    throw new Error("تغيّرت المراجعة أو انتهت جلسة الخادم؛ أعد المراجعة.");
  const plan = planSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
  if (Date.now() > plan.expiresAt) throw new Error("انتهت صلاحية المراجعة؛ أعد المراجعة قبل الحفظ.");
  return plan;
}
export async function loadWorkSnapshots(ids: string[]) {
  const sql = openDatabase();
  return sql.begin("isolation level repeatable read read only", async (transaction) => {
    const result = [];
    for (const id of ids) {
      const document = await workExport(transaction, id);
      result.push({ document, revision: revision(document) });
    }
    return result;
  });
}
function guardKeys(raw: JsonValue, parsed: JsonValue, path = "") {
  if (Array.isArray(raw) && Array.isArray(parsed)) {
    raw.forEach((value, index) => guardKeys(value, parsed[index] ?? null, `${path}[${index}]`));
  } else if (isJsonObject(raw) && isJsonObject(parsed)) {
    for (const [key, value] of Object.entries(raw)) {
      if (!Object.hasOwn(parsed, key)) throw new Error(`حقل غير معروف: ${path}${key}`);
      guardKeys(value, parsed[key] ?? null, `${path}${key}.`);
    }
  }
}
function prepareStructure(patch: WorkDocument, current: WorkDocument) {
  const removed: string[] = [];
  if (!patch.installments) return removed;
  const ids = new Set<string>();
  for (const item of patch.installments) {
    const original = current.installments?.find((value) => value.id === item.id);
    if (item.id && !original)
      throw new Error("معرّف جزء لا ينتمي إلى العمل. اترك المعرّف فارغاً للأجزاء الجديدة.");
    item.id ??= randomUUID();
    if (ids.has(item.id)) throw new Error("معرّف جزء مكرر.");
    ids.add(item.id);
    const episodes = new Set<string>();
    for (const episode of item.episodes ?? []) {
      if (episode.id && !original?.episodes?.some((value) => value.id === episode.id))
        throw new Error("معرّف حلقة لا ينتمي إلى الجزء.");
      episode.id ??= randomUUID();
      if (episodes.has(episode.id)) throw new Error("معرّف حلقة مكرر.");
      episodes.add(episode.id);
    }
    if (item.episodes) {
      for (const episode of original?.episodes ?? [])
        if (episode.id && !episodes.has(episode.id)) removed.push(episode.id);
    }
  }
  if (current.installments?.some((value) => value.id && !ids.has(value.id)))
    throw new Error(
      "حذف الأجزاء يحتاج مراجعة مستقلة لحماية الحلقات وسجل المشاهدة. أعد الأجزاء المحذوفة إلى المسودة.",
    );
  return removed;
}
function requireSingle(rows: { id: string }[], label: string, value: string) {
  if (!rows.length) throw new Error(`${label}: لا يوجد سجل بالاسم أو slug «${value}».`);
  if (rows.length > 1)
    throw new Error(
      `${label}: الاسم «${value}» يطابق أكثر من سجل. استخدم slug مميزاً أو اسماً فريداً.`,
    );
  return rows[0]!;
}

async function validateHumanReferences(transaction: TransactionSql, patch: WorkDocument) {
  for (const value of patch.planets ?? [])
    requireSingle(
      await transaction<{ id: string }[]>`
    select id from planets where slug = ${value} or lower(name_ar) = lower(${value}) or lower(name_en) = lower(${value}) limit 2`,
      "الكواكب",
      value,
    );
  for (const key of ["genres", "tones", "tags", "countries"] as const)
    for (const value of patch[key] ?? [])
      requireSingle(
        await transaction.unsafe<{ id: string }[]>(
          `select id from "${key}" where lower(btrim(slug)) = lower(btrim($1)) or lower(btrim(label_en)) = lower(btrim($1)) or lower(btrim(label_ar)) = lower(btrim($1)) limit 2`,
          [value],
        ),
        "الفهرسة",
        value,
      );
  for (const credit of patch.credits ?? []) {
    const roles = await transaction<{ id: string; entity_kind: string }[]>`
      select id, entity_kind from roles where slug = ${credit.role} or lower(label_en) = lower(${credit.role}) or lower(label_ar) = lower(${credit.role}) limit 2`;
    requireSingle(roles, "دور المساهمة", credit.role);
    const role = roles[0]!;
    requireSingle(
      await transaction<{ id: string }[]>`
      select e.id from entities e where e.kind = ${role.entity_kind} and
      (e.id::text = ${credit.entity} or lower(btrim(e.name)) = lower(btrim(${credit.entity}))
      or lower(btrim(e.sort_name)) = lower(btrim(${credit.entity}))
      or exists (select 1 from entity_aliases a where a.entity_id = e.id and lower(btrim(a.alias)) = lower(btrim(${credit.entity})))) limit 2`,
      "الشخص / الاستوديو",
      credit.entity,
    );
  }
}
async function prepareOrdering(transaction: TransactionSql, patch: WorkDocument) {
  if (!patch.id || !patch.installments?.length) return;
  const current = await workExport(transaction, patch.id);
  if (
    patch.installments.some((item, index) => {
      const original = current.installments?.find((value) => value.id === item.id);
      return original && original.position !== (item.position ?? index + 1);
    })
  ) {
    const high = Math.max(
      0,
      ...(current.installments ?? []).map((item) => item.position ?? 0),
      ...patch.installments.map((item, index) => item.position ?? index + 1),
    );
    for (const [index, item] of (current.installments ?? []).entries())
      if (item.id)
        await transaction`update installments set position = ${high + index + 1} where id = ${item.id}`;
  }
  for (const item of patch.installments) {
    const original = current.installments?.find((value) => value.id === item.id);
    if (
      !item.episodes ||
      !original ||
      !item.episodes.some((episode, index) => {
        const previous = original.episodes?.find((value) => value.id === episode.id);
        return (
          previous &&
          (previous.position !== (episode.position ?? index + 1) ||
            previous.number !== episode.number)
        );
      })
    )
      continue;
    const high = Math.max(
      0,
      ...(original.episodes ?? []).map((episode) => episode.position ?? 0),
      ...item.episodes.map((episode, index) => episode.position ?? index + 1),
    );
    const low = Math.min(0, ...(original.episodes ?? []).map((episode) => episode.number));
    for (const [index, episode] of (original.episodes ?? []).entries())
      if (episode.id && item.episodes.some((next) => next.id === episode.id))
        await transaction`update episodes set position = ${high + index + 1}, number = ${low - index - 1} where id = ${episode.id}`;
  }
}
async function applyPatch(transaction: TransactionSql, patch: WorkDocument, create = false) {
  await validateHumanReferences(transaction, patch);
  if (!create && patch.installments && patch.id) {
    const current = await workExport(transaction, patch.id);
    const retained = new Set(
      patch.installments.flatMap((item) => (item.episodes ?? []).map((episode) => episode.id)),
    );
    for (const item of current.installments ?? []) {
      if (!patch.installments.find((next) => next.id === item.id)?.episodes) continue;
      for (const episode of item.episodes ?? []) {
        if (!episode.id || retained.has(episode.id)) continue;
        await transaction`select id from episodes where id = ${episode.id} for update`;
        const linked = await episodeLinks(transaction, episode.id);
        if (linked.length)
          throw new Error(
            `لا يمكن حذف الحلقة ${episode.number}: ترتبط بسجلات محفوظة (${linked.map((row) => `${row.table}: ${row.count}`).join("، ")}).`,
          );
        await transaction`delete from episodes where id = ${episode.id}`;
      }
    }
  }
  if (!create) await prepareOrdering(transaction, patch);
  const { id, ...creation } = patch;
  await workApply(
    openDatabase(),
    {
      positionals: [],
      repeated: new Map(),
      flags: new Map<string, string | boolean>([
        ["json", JSON.stringify(create ? creation : patch)],
        ["create-only", create],
        ["mode", "merge"],
      ]),
    },
    undefined,
    transaction,
    [
      "aliases",
      "trivia",
      "genres",
      "tones",
      "tags",
      "countries",
      "planets",
      "credits",
      "externalIds",
      "relations",
      "awards",
    ],
    create ? id : undefined,
  );
}
class Rehearsal extends Error {
  constructor(readonly review: DocumentReview) {
    super("rehearsal rollback");
  }
}
export async function prepareWorkReview(
  json: string,
  originals: { id: string; revision: string }[],
  context?: EditorContext,
) {
  const projection = projectionSchema.parse(JSON.parse(json));
  if (new Set(projection.fields).size !== projection.fields.length)
    throw new Error("قائمة الحقول تتضمن تكراراً.");
  const revisions = new Map(originals.map((value) => [value.id, value.revision]));
  const seen = new Set<string>();
  const sql = openDatabase();
  try {
    await sql.begin("isolation level serializable", async (transaction) => {
      const plan: Plan = {
        actorAccountId: context?.accountId,
        expiresAt: Date.now() + 20 * 60 * 1000,
        records: [],
      };
      const review: DocumentReview = { ticket: "", expiresAt: plan.expiresAt, records: [] };
      const baseline = new Map<string, WorkDocument>();
      for (const raw of projection.records) {
        const id = z.string().uuid().parse(raw.id);
        const current = await workExport(transaction, id);
        if (revision(current) !== revisions.get(id))
          throw new Error("تغيّر العمل منذ تحميله. احتفظ بالمسودة وأعد تحميل النسخة الحالية.");
        baseline.set(id, current);
      }
      for (const raw of projection.records) {
        const id = z.string().uuid().parse(raw.id);
        if (!revisions.has(id) || seen.has(id))
          throw new Error("معرّف عمل غير محدد أو مكرر في المسودة.");
        seen.add(id);
        for (const key of Object.keys(raw))
          if (key !== "id" && !projection.fields.includes(z.enum(fieldKeys).parse(key)))
            throw new Error(`الحقل ${key} خارج نطاق التحرير.`);
        const current = baseline.get(id);
        if (!current) throw new Error("العمل غير موجود في نطاق التحرير.");
        const completed = { ...raw };
        if (Object.hasOwn(raw, "installments"))
          completed.installments = preserveHidden(
            documentRow.parse(current).installments ?? [],
            raw.installments ?? [],
          );
        const candidate = workDocument.partial().required({ id: true }).strict().parse(completed);
        guardKeys(completed, documentRow.parse(candidate));
        const patch: WorkDocument = { id, canonicalTitle: current.canonicalTitle };
        for (const key of projection.fields) {
          if (Object.hasOwn(candidate, key) && !equalValue(current[key], candidate[key]))
            Object.assign(patch, { [key]: candidate[key] });
        }
        prepareStructure(patch, current);
        if (patch.awards) {
          const awardIds = new Set<string>();
          for (const award of patch.awards) {
            if (award.id && !current.awards?.some((original) => original.id === award.id))
              throw new Error("معرّف جائزة لا ينتمي إلى العمل.");
            const previous = current.awards?.find((value) => value.id === award.id);
            if (
              previous &&
              isJsonNumber(award.installment) &&
              award.installment === previous.installment
            ) {
              const originalPart = current.installments?.find(
                (value) => value.position === award.installment,
              );
              if (originalPart?.id) award.installment = originalPart.id;
            }
            award.id ??= randomUUID();
            if (awardIds.has(award.id)) throw new Error("معرّف جائزة مكرر.");
            awardIds.add(award.id);
          }
        }
        if (patch.canonicalTitle === current.canonicalTitle && !Object.hasOwn(patch, "sortTitle"))
          patch.sortTitle = current.sortTitle;
        if (
          Object.keys(patch).length === 3 &&
          patch.canonicalTitle === current.canonicalTitle &&
          patch.sortTitle === current.sortTitle
        )
          continue;
        validateInstallmentIdentities(patch);
        await applyPatch(transaction, patch);
        plan.records.push({
          id,
          create: false,
          revision: revision(current),
          patch: documentRow.parse(patch),
          after: "",
        });
      }
      for (const record of plan.records) {
        const current = baseline.get(record.id);
        if (!current) throw new Error("العمل غير موجود.");
        const after = await workExport(transaction, record.id);
        record.after = revision(after);
        const changes = documentChanges(documentRow.parse(current), documentRow.parse(after));
        if (changes.length)
          review.records.push({
            id: record.id,
            name: after.titleAr || after.canonicalTitle,
            changes,
          });
      }
      plan.records = plan.records.filter((record) => record.after !== record.revision);
      review.ticket = ticket(plan);
      throw new Rehearsal(review);
    });
  } catch (error) {
    if (error instanceof Rehearsal) return error.review;
    throw error;
  }
  throw new Error("تعذّر إعداد المراجعة.");
}
export async function commitWorkReview(value: string, context?: EditorContext) {
  const plan = readTicket(value);
  if (plan.actorAccountId !== context?.accountId) throw new Error("المراجعة تخص حساباً آخر.");
  if (!plan.records.length) throw new Error("لا توجد تغييرات للحفظ.");
  const sql = openDatabase();
  return sql.begin("isolation level serializable", async (transaction) => {
    await authorizeWrite(transaction, context);
    // Lock all work roots in the same order before checking whole-document revisions.
    for (const record of plan.records.toSorted((a, b) => a.id.localeCompare(b.id))) {
      if (!record.create) await transaction`select id from titles where id=${record.id} for update`;
    }
    for (const record of plan.records) {
      if (record.create) {
        const existing = await transaction`select id from titles where id = ${record.id}`;
        if (existing.length) throw new Error("حُفظ هذا العمل بالفعل؛ أعد تحميل الصفحة.");
        continue;
      }
      const current = await workExport(transaction, record.id);
      if (revision(current) !== record.revision)
        throw new Error("تغيّر أحد الأعمال بعد المراجعة. لم تُحفظ أي تغييرات؛ أعد المراجعة.");
    }
    for (const record of plan.records)
      await applyPatch(transaction, workDocument.parse(record.patch), record.create);
    for (const record of plan.records) {
      const after = await workExport(transaction, record.id);
      if (revision(after) !== record.after)
        throw new Error("نتيجة الحفظ تختلف عن المراجعة. لم تُحفظ أي تغييرات؛ أعد المراجعة.");
    }
    if (context)
      for (const record of plan.records) {
        const after = await workExport(transaction, record.id);
        const snapshot = documentRow.parse(after);
        await transaction`insert into editorial_revisions(actor_account_id,entity_type,entity_id,revision,action,summary,snapshot,changes) select ${context.accountId},'work_documents',${record.id},coalesce(max(revision),0)+1,'update','Desktop complete work editor',${transaction.json(snapshot)},${transaction.json({ after: snapshot })} from editorial_revisions where entity_type='work_documents' and entity_id=${record.id}`;
      }
    return {
      saved: plan.records.length,
      createdId: plan.records.find((record) => record.create)?.id ?? null,
    };
  });
}

async function episodeLinks(transaction: TransactionSql, id: string) {
  const queries = await transaction<{ table: string; query: string }[]>`
    select c.conrelid::regclass::text as "table",
      format('select count(*)::int as count from %s child where %s', c.conrelid::regclass,
        string_agg(format('to_jsonb(child)->%L is not distinct from $1::text::jsonb->%L', a.attname, b.attname), ' and ')) as query
    from pg_constraint c
    join lateral unnest(c.conkey, c.confkey) as keys(a, b) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = keys.a
    join pg_attribute b on b.attrelid = c.confrelid and b.attnum = keys.b
    where c.contype = 'f' and c.confrelid = 'episodes'::regclass
    group by c.oid, c.conrelid`;
  const [episode] = await transaction`select to_jsonb(e) as value from episodes e where id = ${id}`;
  if (!episode) throw new Error("الحلقة غير موجودة.");
  const result: { table: string; count: number }[] = [];
  for (const query of queries) {
    const [row] = await transaction.unsafe<{ count: number }[]>(query.query, [
      JSON.stringify(episode.value),
    ]);
    if (row?.count) result.push({ table: query.table, count: row.count });
  }
  return result;
}
export async function inspectEpisodeDeletion(workId: string, episodeId: string) {
  return openDatabase().begin("isolation level repeatable read read only", async (transaction) => {
    const rows =
      await transaction`select e.id from episodes e join installments i on i.id = e.installment_id where e.id = ${episodeId} and i.title_id = ${workId}`;
    if (!rows.length) throw new Error("الحلقة لا تنتمي إلى العمل.");
    return episodeLinks(transaction, episodeId);
  });
}

export function validateWorkDraft(json: string) {
  const raw = documentRow.parse(JSON.parse(json));
  const parsed = workDocument.strict().parse(raw);
  guardKeys(raw, documentRow.parse(parsed));
  return parsed;
}
export async function prepareNewWorkReview(json: string, context?: EditorContext) {
  const patch = validateWorkDraft(json);
  if (patch.id) throw new Error("مسودة العمل الجديد لا تقبل معرّف عمل موجود.");
  patch.id = randomUUID();
  prepareStructure(patch, { canonicalTitle: patch.canonicalTitle });
  for (const award of patch.awards ?? []) {
    if (award.id) throw new Error("الجائزة الجديدة لا تقبل معرّف جائزة موجودة.");
    award.id = randomUUID();
  }
  try {
    await openDatabase().begin("isolation level serializable", async (transaction) => {
      await applyPatch(transaction, patch, true);
      const after = await workExport(transaction, patch.id ?? "");
      const expiresAt = Date.now() + 20 * 60 * 1000;
      const plan: Plan = {
        actorAccountId: context?.accountId,
        expiresAt,
        records: [
          {
            id: patch.id ?? "",
            create: true,
            revision: "new",
            patch: documentRow.parse(patch),
            after: revision(after),
          },
        ],
      };
      throw new Rehearsal({
        ticket: ticket(plan),
        expiresAt,
        records: [
          {
            id: plan.records[0]?.id ?? "",
            name: after.titleAr || after.canonicalTitle,
            changes: documentChanges({}, documentRow.parse(after)),
          },
        ],
      });
    });
  } catch (error) {
    if (error instanceof Rehearsal) return error.review;
    throw error;
  }
  throw new Error("تعذّر إعداد مراجعة العمل الجديد.");
}
