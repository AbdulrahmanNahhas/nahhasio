import { z } from "zod";

import { preserveHidden } from "../tree/json-projection";
import { documentRow, fieldKeys, type JsonValue } from "./document-model";
import { readEditorDocument } from "./json-document-input";

type Row = Record<string, JsonValue>;
type IdentityIssue = {
  title: string;
  id: string | null;
  expectedId: string | null;
  reason: string;
};

const text = z.string();

export function checkRecordIdentities(originals: readonly Row[], records: readonly Row[]) {
  const originalIds = new Set<JsonValue>();
  const originalIdByTitle = new Map<JsonValue, string>();
  for (const record of originals) {
    const id = text.safeParse(record.id).data;
    if (!id) continue;
    originalIds.add(id);
    if (record.canonicalTitle) originalIdByTitle.set(record.canonicalTitle, id);
  }
  const counts = new Map<JsonValue, number>();
  for (const { id } of records) counts.set(id, (counts.get(id) ?? 0) + 1);

  const reportedDuplicates = new Set<string>();
  const issues: IdentityIssue[] = [];
  records.forEach((record, index) => {
    const id = text.safeParse(record.id).data ?? null;
    const canonicalTitle = text.safeParse(record.canonicalTitle).data;
    const title = text.safeParse(record.titleAr).data || canonicalTitle || `السجل ${index + 1}`;
    if (!id) {
      issues.push({ title, id, expectedId: null, reason: "لا يوجد معرّف نصي." });
    } else if ((counts.get(id) ?? 0) > 1) {
      if (reportedDuplicates.has(id)) return;
      reportedDuplicates.add(id);
      issues.push({ title, id, expectedId: null, reason: "هذا المعرّف مستخدم في أكثر من سجل." });
    } else if (!originalIds.has(id)) {
      const expectedId = canonicalTitle ? (originalIdByTitle.get(canonicalTitle) ?? null) : null;
      issues.push({
        title,
        id,
        expectedId,
        reason: expectedId
          ? "المعرّف لا يطابق العمل الأصلي."
          : "هذا المعرّف لا ينتمي إلى الأعمال المحددة للتحرير.",
      });
    }
  });
  return issues;
}

export function analyzeWorkDraft(draft: string, originals: Row[], buffers: Row[]) {
  const input = readEditorDocument(draft);
  const parsed = "projection" in input ? input.projection : null;
  if (!parsed?.success) return { input, parsed, identityIssues: [], mergedRows: buffers };

  const patches = new Map<JsonValue, Row>();
  for (const record of parsed.data.records) {
    if (!patches.has(record.id)) patches.set(record.id, record);
  }
  const mergedRows = buffers.map((record) => {
    const patch = patches.get(record.id);
    return patch ? documentRow.parse(preserveHidden(record, patch)) : record;
  });
  return {
    input,
    parsed,
    mergedRows,
    identityIssues: checkRecordIdentities(originals, parsed.data.records),
  };
}

export function serializeWorkReview(rows: Row[]) {
  return JSON.stringify({ schemaVersion: 1, fields: fieldKeys, records: rows });
}
