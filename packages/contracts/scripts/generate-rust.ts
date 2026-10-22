/** Generated validation data shares client contracts. This is development tooling only. */
import { readFile, writeFile } from "node:fs/promises";

import { projectionSchema } from "@arcadia/contracts/editor";
import {
  rpcInputs,
  adminEntityJsonDocumentSchema,
  awardDrafts,
} from "@arcadia/contracts/editor-rpc";
import { workDocument } from "@arcadia/contracts/work";
import { z } from "zod";

const contracts = {
  ...rpcInputs,
  awardOrganizationDraft: awardDrafts.award_organizations,
  awardCategoryDraft: awardDrafts.award_categories,
  awardCeremonyDraft: awardDrafts.award_ceremonies,
  workDocument,
  projection: projectionSchema,
  entityDocument: adminEntityJsonDocumentSchema,
};
const schemas = Object.fromEntries(
  Object.entries(contracts).map(([key, schema]) => [
    key,
    z.toJSONSchema(schema, { io: "input", unrepresentable: "any", cycles: "ref" }),
  ]),
);
const destination = new URL(
  "../../../crates/catalog-core/src/editor/contracts.json",
  import.meta.url,
);
// Compact generated data is deterministic and does not need manual formatting.
const generated = JSON.stringify(schemas) + "\n";
if (process.argv.includes("--check")) {
  if (JSON.stringify(JSON.parse(await readFile(destination, "utf8"))) !== JSON.stringify(schemas))
    throw new Error(
      "Rust editor contracts are stale. Run pnpm --filter @arcadia/contracts generate:rust-editor.",
    );
} else {
  await writeFile(destination, generated);
}
