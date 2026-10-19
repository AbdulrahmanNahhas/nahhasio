import { adminEntityDraftSchema } from "@arcadia/contracts/editor-rpc";
import type { z } from "zod";

import type { TransactionSql } from "../db";

type Draft = z.infer<typeof adminEntityDraftSchema>;
export async function readEntityReferences(tx: TransactionSql, id: string) {
  const [entity] = await tx<
    { urls: NonNullable<Draft["urls"]> }[]
  >`select urls from entities where id=${id}`;
  const relations = await tx<NonNullable<Draft["relations"]>>`
    select r.id,case when r.source_id=${id} then r.target_id else r.source_id end as "entityId",
      e.name as "entityName",case when r.source_id=${id} then 'outgoing' else 'incoming' end as direction,
      r.relation_type as "relationType",r.occurred_on::text as "occurredOn",r.description
    from organization_relations r join entities e on e.id=case when r.source_id=${id} then r.target_id else r.source_id end
    where r.source_id=${id} or r.target_id=${id} order by r.id`;
  return { urls: entity?.urls ?? [], relations };
}
export async function applyEntityReferences(
  tx: TransactionSql,
  id: string,
  kind: string,
  draft: Draft,
  before: Draft | null,
) {
  if (draft.urls !== undefined) {
    if (new Set(draft.urls.map((link) => link.url)).size !== draft.urls.length)
      throw new Error("الروابط تحتوي على تكرار.");
    await tx`update entities set urls=${tx.json(draft.urls)} where id=${id}`;
  }
  if (draft.relations === undefined) return;
  if (kind !== "organization" && draft.relations.length) throw new Error("العلاقات تخص الجهات فقط.");
  const ids = draft.relations.flatMap((relation) => (relation.id ? [relation.id] : []));
  if (new Set(ids).size !== ids.length) throw new Error("معرّفات العلاقات مكررة.");
  const keys = draft.relations.map((r) => `${r.direction}:${r.entityId}:${r.relationType}`);
  if (new Set(keys).size !== keys.length) throw new Error("العلاقات تحتوي على تكرار.");
  for (const relation of draft.relations) {
    if (relation.entityId === id) throw new Error("لا يمكن ربط الجهة بنفسها.");
    if (relation.id && !before?.relations?.some((r) => r.id === relation.id))
      throw new Error("العلاقة لا تنتمي إلى هذا السجل.");
    const [other] = await tx<
      { name: string }[]
    >`select name from entities where id=${relation.entityId} and kind='organization'`;
    if (!other || other.name !== relation.entityName)
      throw new Error("تغيّرت الجهة المرتبطة؛ أعد اختيارها.");
  }
  for (const relation of before?.relations ?? [])
    if (!draft.relations.some((r) => r.id === relation.id))
      await tx`delete from organization_relations where id=${relation.id} and (source_id=${id} or target_id=${id})`;
  for (const r of draft.relations) {
    const source = r.direction === "outgoing" ? id : r.entityId;
    const target = r.direction === "outgoing" ? r.entityId : id;
    if (r.id)
      await tx`update organization_relations set source_id=${source},target_id=${target},relation_type=${r.relationType},occurred_on=${r.occurredOn},description=${r.description} where id=${r.id} and (source_id=${id} or target_id=${id})`;
    else
      await tx`insert into organization_relations(source_id,target_id,relation_type,occurred_on,description) values(${source},${target},${r.relationType},${r.occurredOn},${r.description})`;
  }
}
