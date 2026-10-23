import { trailerDocument } from "@arcadia/contracts/work";
import { z } from "zod";

import {
  fieldKeys,
  isIdentifiedJson,
  projectionSchema,
  type JsonValue,
} from "@/features/editor/json/document/document-model";

const trailerList = trailerDocument.array().max(30);
const validatedProjection = projectionSchema.superRefine((projection, context) => {
  projection.records.forEach((record, index) => {
    if (!Object.hasOwn(record, "trailers")) return;
    const trailers = trailerList.safeParse(record.trailers);
    if (trailers.success) return;
    for (const issue of trailers.error.issues) {
      context.addIssue({
        code: "custom",
        path: ["records", index, "trailers", ...issue.path],
        message:
          'الإعلانات التشويقية قائمة كائنات، وليست روابط نصية. استخدم { "youtubeVideoId": "_McjTc1Qp9s" } بمعرّف YouTube من 11 حرفًا. الحقول الاختيارية: id، title، language، isPrimary، position.',
      });
    }
  });
});

// Accept the dashboard projection, a CLI work document, or an array of work documents.
// The original input remains available so formatting never rewrites its chosen shape.
type EditorDocumentInput =
  | { raw: JsonValue; projection: ReturnType<typeof projectionSchema.safeParse> }
  | { error: string };
export function readEditorDocument(text: string): EditorDocumentInput {
  try {
    const raw = z.json().parse(JSON.parse(text));
    const records = Array.isArray(raw) ? raw : isIdentifiedJson(raw) ? [raw] : null;
    const projection = records
      ? {
          schemaVersion: 1,
          fields: fieldKeys.filter((key) =>
            records.some((record) => isIdentifiedJson(record) && Object.hasOwn(record, key)),
          ),
          records,
        }
      : raw;
    return { raw, projection: validatedProjection.safeParse(projection) };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "تعذّر قراءة JSON." };
  }
}
export function jsonIssueKey(path: PropertyKey[], code: string, message: string) {
  return JSON.stringify([path, code, message]);
}
