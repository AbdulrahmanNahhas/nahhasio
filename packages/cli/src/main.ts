#!/usr/bin/env node
/**
 * Nahhasio CLI entry point.
 *
 * Dispatch is intentionally flat: `nahhasio <command|resource> <verb> [ref] [flags]`. Anything
 * that is not a built-in command is treated as a resource, which is what makes every table in
 * the database reachable without a per-table code path.
 */

import { workDocument } from "@arcadia/contracts/work";
import { z } from "zod";

import { boolFlag, type ParsedArgs, parseArgs } from "./args";
import { helpDocument, helpText } from "./commands/help";
import { mediaCommand } from "./commands/media";
import { schemaCommand } from "./commands/schema";
import { sqlCommand } from "./commands/sql";
import { statsCommand } from "./commands/stats";
import { workApply, workExport, workTemplate } from "./commands/work";
import { buildContext, createRow, deleteRows, getRow, listRows, updateRows } from "./crud";
import { closeDatabase, openDatabase } from "./db";
import { loadSchema } from "./introspect";
import { CliError, emit, emitError, type OutputMode } from "./output";
import { resolveResource } from "./registry";
import type { CommandResult } from "./types";

function outputMode(args: ParsedArgs): OutputMode {
  if (boolFlag(args, "json")) return "json";
  if (boolFlag(args, "ndjson")) return "ndjson";
  if (boolFlag(args, "csv")) return "csv";
  return "table";
}

const crudVerbs = new Set(["list", "get", "create", "update", "delete", "ls", "show", "new", "rm"]);

const verbAliases = new Map([
  ["ls", "list"],
  ["show", "get"],
  ["new", "create"],
  ["rm", "delete"],
]);

async function run(args: ParsedArgs, mode: OutputMode): Promise<CommandResult> {
  const [first, second, third] = args.positionals;

  if (!first || first === "help" || boolFlag(args, "help")) {
    if (mode === "json") return helpDocument();
    process.stdout.write(
      `${helpText(first === "help" ? second : [first, second].filter(Boolean).join(" "))}\n`,
    );
    return undefined;
  }

  if (first === "schema") return schemaCommand(openDatabase(), args, second);
  if (first === "sql") return sqlCommand(openDatabase(), args, second);
  if (first === "stats") return statsCommand(openDatabase(), args, second);
  if (first === "media") return mediaCommand(openDatabase(), args, second, third);

  if (first === "work") {
    if (second === "template") return workTemplate();
    if (second === "schema") return z.json().parse(z.toJSONSchema(workDocument, { io: "input" }));
    if (second === "export") {
      if (!third)
        throw new CliError("work export needs a reference", "nahhasio work export Arcane");
      return workExport(openDatabase(), third);
    }
    if (second === "apply") return workApply(openDatabase(), args, third);
    throw new CliError(
      `Unknown work command "${second ?? ""}"`,
      "Use: nahhasio work apply | work export | work template",
    );
  }

  if (first === "health") {
    const sql = openDatabase();
    const [row] = await sql<Array<{ titles: number; now: string }>>`
      select (select count(*)::int from titles) as titles, now()::text as now`;
    return {
      ok: true,
      product: "nahhasio",
      ...row,
    };
  }

  // Everything else is a resource.
  const sql = openDatabase();
  const schema = await loadSchema(sql);
  const resource = resolveResource(first, new Set(schema.tables.keys()));
  const rawVerb = second ?? "list";
  if (!crudVerbs.has(rawVerb)) {
    throw new CliError(
      `Unknown verb "${rawVerb}" for resource "${resource.name}"`,
      "Verbs are list, get, create, update, and delete.",
    );
  }
  const verb = verbAliases.get(rawVerb) ?? rawVerb;
  const context = buildContext(sql, schema, resource, args);

  if (verb === "list") return listRows(context);
  if (verb === "get") {
    if (!third) {
      throw new CliError(
        `${resource.name} get needs a reference`,
        `Try: nahhasio ${resource.name} list --search "…"`,
      );
    }
    return getRow(context, third);
  }
  if (verb === "create") return createRow(context);
  if (verb === "update") return updateRows(context, third);
  return deleteRows(context, third);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const mode = outputMode(args);
  const maxCellWidth = boolFlag(args, "wide") ? 0 : 60;
  try {
    const result = await run(args, mode);
    if (result !== undefined) emit(result, mode, maxCellWidth);
  } catch (error) {
    emitError(error, mode);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

await main();
