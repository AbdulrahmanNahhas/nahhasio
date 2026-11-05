"""Generate a validated TypeScript client from OpenAPI.

The generator supports the local contract's object/ref/array/nullable subset and
rejects unsupported model constructs. Generated outputs are never hand-maintained.
"""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PACKAGE = ROOT / "packages/api-contract"
document = json.loads((PACKAGE / "openapi.json").read_text())
schemas = document["components"]["schemas"]


# Emit referenced schemas before their consumers; Zod schemas are runtime values.
def references(node):
    if isinstance(node, dict):
        if "$ref" in node:
            yield node["$ref"].split("/")[-1]
        for value in node.values():
            yield from references(value)
    elif isinstance(node, list):
        for value in node:
            yield from references(value)


ordered = {}
visiting = set()


def visit(name):
    if name in ordered:
        return
    if name in visiting:
        raise ValueError("Recursive models need an explicit lazy schema design")
    visiting.add(name)
    for dependency in references(schemas[name]):
        visit(dependency)
    visiting.remove(name)
    ordered[name] = schemas[name]


for name in schemas:
    visit(name)
schemas = ordered


def validator(schema):
    if schema.get("x-zod-json"):
        return "z.json()"
    if "anyOf" in schema or "oneOf" in schema:
        members = schema.get("anyOf", schema.get("oneOf"))
        return "z.union([" + ",".join(validator(member) for member in members) + "])"
    if schema.get("type") == "null":
        return "z.null()"
    if "$ref" in schema:
        result = schema["$ref"].split("/")[-1] + "Schema"
    elif "allOf" in schema:
        if len(schema["allOf"]) != 1:
            raise ValueError("Only single-ref allOf is supported")
        result = validator(schema["allOf"][0])
    elif schema["type"] == "array":
        result = f"z.array({validator(schema['items'])})"
    elif schema["type"] == "object" and "properties" not in schema:
        additional = schema.get("additionalProperties")
        result = "z.record(z.string(), " + validator(additional) + ")" if isinstance(additional, dict) else "z.strictObject({})"
    elif schema["type"] == "object":
        required = schema.get("required", [])
        if not set(required).issubset(schema["properties"]):
            raise ValueError("Required fields must exist in properties")
        result = (
            "z.strictObject({\n"
            + "\n".join(
                f"  {field}: {validator(prop)}{'.optional()' if field not in required else ''},"
                for field, prop in schema["properties"].items()
            )
            + "\n})"
        )
    elif schema["type"] == "string":
        result = (
            "z.enum(" + json.dumps(schema["enum"]) + ")"
            if "enum" in schema
            else "z.string()"
        )
        if schema.get("format") == "date":
            result = "z.iso.date()"
        if "minLength" in schema:
            result += f".min({schema['minLength']})"
        if "maxLength" in schema:
            result += f".max({schema['maxLength']})"
        if schema.get("format") == "uuid":
            result += ".uuid()"
    elif schema["type"] == "integer":
        result = "z.number().int()"
    elif schema["type"] == "number":
        result = "z.number()"
    elif schema["type"] == "boolean":
        result = "z.boolean()"
    else:
        raise ValueError(f"Unsupported property schema: {schema}")
    if schema.get("type") in ("integer", "number"):
        if "minimum" in schema:
            result += f".min({schema['minimum']})"
        if "maximum" in schema:
            result += f".max({schema['maximum']})"
    return result + ".nullable()" if schema.get("nullable") else result


def ts_type(schema):
    if "$ref" in schema:
        return schema["$ref"].split("/")[-1]
    if schema["type"] == "string":
        return (
            " | ".join(json.dumps(v) for v in schema["enum"])
            if "enum" in schema
            else "string"
        )
    return {"integer": "number", "number": "number", "boolean": "boolean"}[
        schema["type"]
    ]


typescript = [
    "// Generated from openapi.json. Do not edit.",
    'import { z } from "zod";',
    "",
]
for name, schema in schemas.items():
    typescript += [
        f"export const {name}Schema = {validator(schema)};",
        f"export type {name} = z.infer<typeof {name}Schema>;",
        "",
    ]

request_models = sorted(
    {
        op["requestBody"]["content"]["application/json"]["schema"]["$ref"].split("/")[
            -1
        ]
        for operations in document["paths"].values()
        for op in operations.values()
        if "requestBody" in op and not op.get("x-native-only")
    }
)
request_type = " | ".join(request_models) if request_models else "never"

typescript += [
    "export class ApiClient {",
    "  private readonly baseUrl: string;",
    "  private readonly token: () => string | null;",
    "  constructor(baseUrl: string, token: () => string | null) { this.baseUrl = baseUrl; this.token = token; }",
    f"  private async request(path: string, method: string, body?: {request_type}, signal?: AbortSignal): Promise<Response> {{",
    "    const headers = new Headers();",
    "    const token = this.token();",
    '    if (token) headers.set("Authorization", `Bearer ${token}`);',
    '    if (body !== undefined) headers.set("Content-Type", "application/json");',
    '    const response = await fetch(`${this.baseUrl.replace(/\\/$/, "")}${path}`, {method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal});',
    "    if (!response.ok) throw new globalThis.Error(`API request failed (${response.status})`);",
    "    return response;",
    "  }",
]
for path, operations in document["paths"].items():
    for method, op in operations.items():
        if op["operationId"] == "getArtwork" or op.get("x-native-only"):
            continue
        args = []
        path_expression = json.dumps(path)
        parameters = op.get("parameters", [])
        for param in parameters:
            if param["in"] == "path":
                args.append(f"{param['name']}: {ts_type(param['schema'])}")
                path_expression = (
                    "`"
                    + path.replace(
                        "{" + param["name"] + "}",
                        "${encodeURIComponent(" + param["name"] + ")}",
                    )
                    + "`"
                )
        query = [p for p in parameters if p["in"] == "query"]
        if query:
            args.append(
                "query: { "
                + "; ".join(f"{p['name']}?: {ts_type(p['schema'])}" for p in query)
                + " } = {}"
            )
        if "requestBody" in op:
            args.append(
                "body: "
                + ts_type(op["requestBody"]["content"]["application/json"]["schema"])
            )
        args.append("signal?: AbortSignal")
        success = op["responses"].get("200", op["responses"].get("204"))
        binary = "application/octet-stream" in success.get("content", {})
        result = "Response" if binary else (
            ts_type(success["content"]["application/json"]["schema"])
            if "content" in success
            else "void"
        )
        typescript.append(
            f"  async {op['operationId']}({', '.join(args)}): Promise<{result}> {{"
        )
        if query:
            typescript += [
                "    const params = new URLSearchParams();",
                "    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));",
            ]
            path_expression += ' + (params.size ? `?${params}` : "")'
        typescript.append(
            f'    const response = await this.request({path_expression}, "{method.upper()}", {"body" if "requestBody" in op else "undefined"}, signal);'
        )
        if binary:
            typescript.append("    return response;")
        elif result == "void":
            typescript.append(
                '    if (response.status !== 204) throw new globalThis.Error("Invalid logout response");'
            )
        else:
            typescript.append(
                f"    return {result}Schema.parse(await response.json());"
            )
        typescript.append("  }")
typescript += ["}", ""]
ts_path = PACKAGE / "src/generated.ts"
ts_path.parent.mkdir(parents=True, exist_ok=True)
ts_path.write_text("\n".join(typescript))
subprocess.run(["pnpm", "exec", "oxfmt", "--write", str(ts_path)], cwd=ROOT, check=True)
print("Generated validated TypeScript client from OpenAPI.")
