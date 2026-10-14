import { createHash } from "node:crypto";

import { rpcInputs, rpcResults, adminPlanetWorkSchema } from "@arcadia/contracts/editor-rpc";
import { z } from "zod";

import type { Sql, TransactionSql } from "../db";
import { authorizeWrite, type EditorContext } from "./service";

const workProjection = `jsonb_build_object('id',t.id,'title',coalesce(nullif(t.title_ar,''),t.canonical_title),'englishTitle',t.canonical_title,'year',t.release_year,'posterId',(select a.asset_id from media_asset_assignments a where a.title_id=t.id and a.role='poster' order by a.is_primary desc,a.id limit 1),'memberships',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name_ar,'icon',p.icon,'rank',m.featured_rank) order by p.id) from title_planets m join planets p on p.id=m.planet_id where m.title_id=t.id),'[]'::jsonb))`;
type Work = z.infer<typeof rpcResults.planetWorks>["items"][number];
type WorkRow = { value: unknown; updated_at: string };
function decode(row: WorkRow): Work {
  const revision = createHash("sha256").update(JSON.stringify(row)).digest("hex");
  return adminPlanetWorkSchema.parse({
    ...z.record(z.string(), z.json()).parse(row.value),
    revision,
  });
}
export async function planetOptions(sql: Sql) {
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const planets = await tx<
      { value: unknown }[]
    >`select jsonb_build_object('id',p.id,'name',p.name_ar,'englishName',p.name_en,'icon',p.icon,'description',p.description,'active',p.is_active,'displayOrder',p.display_order,'count',(select count(*) from title_planets m where m.planet_id=p.id)) as value from planets p order by p.display_order,p.id limit 501`;
    if (planets.length > 500) throw new Error("عدد الكواكب يتجاوز حد هذه الواجهة.");
    const [count] = await tx<
      { count: string }[]
    >`select count(*) as count from titles t where not exists(select 1 from title_planets m where m.title_id=t.id)`;
    return rpcResults.planetOptions.parse({
      planets: planets.map((row) => row.value),
      unassigned: Number(count?.count ?? 0),
    });
  });
}
export async function planetWorks(sql: Sql, input: z.infer<typeof rpcInputs.planetWorks>) {
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const where = `($1::uuid is null and not exists(select 1 from title_planets m where m.title_id=t.id) or $1::uuid is not null and exists(select 1 from title_planets m where m.title_id=t.id and m.planet_id=$1::uuid)) and ($2='' or strpos(lower(concat_ws(' ',t.canonical_title,t.title_ar)),lower($2))>0 or exists(select 1 from title_aliases a where a.title_id=t.id and strpos(lower(a.title),lower($2))>0))`;
    const rows = await tx.unsafe<WorkRow[]>(
      `select ${workProjection} as value,t.updated_at::text as updated_at from titles t where ${where} order by t.sort_title,t.id limit 24 offset $3`,
      [input.source, input.q, (input.page - 1) * 24],
    );
    const [total] = await tx.unsafe<{ count: string }[]>(
      `select count(*) as count from titles t where ${where}`,
      [input.source, input.q],
    );
    return { items: rows.map(decode), total: Number(total?.count ?? 0) };
  });
}
async function readWork(tx: TransactionSql, id: string) {
  const [row] = await tx.unsafe<WorkRow[]>(
    `select ${workProjection} as value,t.updated_at::text as updated_at from titles t where t.id=$1::uuid`,
    [id],
  );
  if (!row) throw new Error("أحد الأعمال لم يعد موجوداً؛ أعد تحميل الاختيار.");
  return decode(row);
}
export async function movePlanetWorks(
  sql: Sql,
  input: z.infer<typeof rpcInputs.planetMove>,
  context: EditorContext,
) {
  if (input.source === input.destination) throw new Error("اختر كوكباً آخر للنقل.");
  const ids = input.records.map((record) => record.id);
  if (new Set(ids).size !== ids.length) throw new Error("الاختيار يحتوي على أعمال مكررة.");
  return sql.begin("isolation level serializable", async (tx) => {
    await authorizeWrite(tx, context);
    await tx.unsafe(`select id from titles where id=any($1::uuid[]) order by id for update`, [
      ids.toSorted(),
    ]);
    for (const id of [input.source, input.destination]
      .filter((value): value is string => value !== null)
      .toSorted()) {
      const [planet] = await tx<
        { is_active: boolean }[]
      >`select is_active from planets where id=${id} for share`;
      if (!planet || (id === input.destination && !planet.is_active))
        throw new Error("الكوكب غير موجود أو الوجهة غير نشطة.");
    }
    for (const record of input.records) {
      const before = await readWork(tx, record.id);
      if (before.revision !== record.revision)
        throw new Error(`تغيّر «${before.title}»؛ أعد تحميل الاختيار قبل النقل.`);
      if (
        input.source
          ? !before.memberships.some((value) => value.id === input.source)
          : before.memberships.length > 0
      )
        throw new Error("تغيّر انتماء أحد الأعمال؛ أعد تحميل الاختيار.");
      if (input.source)
        await tx`delete from title_planets where title_id=${record.id} and planet_id=${input.source}`;
      if (input.destination)
        await tx`insert into title_planets(title_id,planet_id) values(${record.id},${input.destination}) on conflict do nothing`;
      await tx`update titles set updated_at=now() where id=${record.id}`;
      const after = await readWork(tx, record.id);
      const changes = z.json().parse({
        source: input.source,
        destination: input.destination,
        before: before.memberships,
        after: after.memberships,
      });
      await tx`insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values(${context.accountId},'admin.planet.move','titles',${record.id},'Move planet membership',${tx.json(changes)})`;
      await tx`insert into editorial_revisions(actor_account_id,entity_type,entity_id,revision,action,summary,snapshot,changes) select ${context.accountId},'title_planets',${record.id},coalesce(max(revision),0)+1,'move','Move planet membership',${tx.json(z.json().parse(after.memberships))},${tx.json(changes)} from editorial_revisions where entity_type='title_planets' and entity_id=${record.id}`;
    }
    return { moved: input.records.length };
  });
}
