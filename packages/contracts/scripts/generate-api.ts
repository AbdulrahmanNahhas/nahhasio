import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { rpcInputs, rpcResults, snapshotSchema } from "@arcadia/contracts/editor-rpc";
import { z } from "zod";
const path = new URL("../../api-contract/openapi.json", import.meta.url);
const document = JSON.parse(await readFile(path, "utf8"));
function clean(input: z.infer<ReturnType<typeof z.json>>): z.infer<ReturnType<typeof z.json>> {
  if (Array.isArray(input)) return input.map(clean);
  if (input !== null && Object.getPrototypeOf(input) === Object.prototype) {
    const parsed = z.record(z.string(), z.json()).parse(input);
    if (z.string().safeParse(parsed.$ref).success) return { "x-zod-json": true };
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([key]) => !["$schema", "$defs"].includes(key))
        .map(([key, v]) => [key, clean(v)]),
    );
  }
  return input;
}

function exported(schema: z.ZodType) {
  const value = z.toJSONSchema(schema, { io: "input", unrepresentable: "any", cycles: "ref" });
  return clean(z.json().parse(value));
}
const schemas = document.components.schemas;
// Retired operations must leave the generated API as well as its call union.
const currentCalls = new Set(
  Object.keys(rpcInputs).map(
    (operation) => "Catalog" + operation.charAt(0).toUpperCase() + operation.slice(1) + "Call",
  ),
);
for (const call of schemas.CatalogEditorCall?.oneOf ?? []) {
  const name = z.string().parse(call.$ref).split("/").at(-1);
  if (!name || currentCalls.has(name)) continue;
  const base = name.slice(0, -"Call".length);
  delete schemas[name];
  delete schemas[base + "Input"];
  delete schemas[base + "Result"];
}
schemas.CatalogSnapshot = exported(snapshotSchema);
const names = [];
for (const [operation, input] of Object.entries(rpcInputs)) {
  const name = "Catalog" + operation.charAt(0).toUpperCase() + operation.slice(1);
  schemas[name + "Input"] = exported(input);
  schemas[name + "Call"] = {
    type: "object",
    required: ["operation", "data"],
    properties: {
      operation: { type: "string", enum: [operation] },
      data: { $ref: "#/components/schemas/" + name + "Input" },
    },
  };
  names.push(name + "Call");
}
for (const [operation, result] of Object.entries(rpcResults))
  schemas["Catalog" + operation.charAt(0).toUpperCase() + operation.slice(1) + "Result"] =
    exported(result);
schemas.CatalogEditorCall = {
  oneOf: names.map((name) => ({ $ref: "#/components/schemas/" + name })),
};
schemas.CatalogEditorReply = {
  type: "object",
  required: ["result"],
  properties: { result: { "x-zod-json": true } },
};
document.paths["/api/v1/admin/editor"] = {
  post: {
    operationId: "callCatalogEditor",
    description:
      "Active administrator session; bounded server-owned catalog operations. Existing whole-document reconciliation via a private fixed worker. No website process, arbitrary SQL or client credentials. Actor-bound review and transactional save; registered artwork/provider operations.",
    requestBody: {
      required: true,
      content: {
        "application/json": { schema: { $ref: "#/components/schemas/CatalogEditorCall" } },
      },
    },
    responses: {
      "200": {
        description: "Operation result; validate with its matching Catalog operation result schema",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/CatalogEditorReply" } },
        },
      },
      "403": { description: "Administrator required" },
      "409": { description: "Stale document or invalid review" },
    },
  },
};
await writeFile(path, JSON.stringify(document, null, 2) + "\n");
await promisify(execFile)(
  fileURLToPath(new URL("../../../node_modules/.bin/oxfmt", import.meta.url)),
  [fileURLToPath(path)],
);
