/**
 * Generic list/get/create/update/delete over any introspected table.
 *
 * One implementation serves every resource. Adding a table to the registry only improves its
 * ergonomics; it is never required for the table to be reachable.
 */

import type { ParsedArgs } from "./args";
import { boolFlag, intFlag, listFlag, rawListFlag, stringFlag } from "./args";
import { assertIdentifier, camelizeRow, parameters, recordAudit, type Sql } from "./db";
import type { SchemaInfo, TableInfo } from "./introspect";
import { requireColumn, requireTable } from "./introspect";
import { CliError } from "./output";
import {
  buildCondition,
  buildSearchCondition,
  combine,
  QueryBuilder,
  sanitizeOrderBy,
  selectList,
} from "./query";
import type { Resource } from "./registry";
import { resolveForeignKey, resolveRef } from "./resolve";
import type { CommandResult, Row, SqlValue } from "./types";
import { coerceValue, splitAssignment } from "./values";

export type CrudContext = {
  sql: Sql;
  schema: SchemaInfo;
  resource: Resource;
  table: TableInfo;
  args: ParsedArgs;
};

const defaultLimit = 50;

function scopeConditions(builder: QueryBuilder, context: CrudContext) {
  return Object.entries(context.resource.scope ?? {}).map(([name, value]) => ({
    text: `"${assertIdentifier(name, "column name")}" = ${builder.bind(value)}`,
  }));
}

function whereConditions(builder: QueryBuilder, context: CrudContext) {
  const conditions = scopeConditions(builder, context);
  for (const expression of rawListFlag(context.args, "where")) {
    conditions.push(buildCondition(builder, context.table, expression));
  }
  const search = stringFlag(context.args, "search");
  if (search) {
    const columns = (context.resource.searchColumns ?? context.resource.refColumns ?? []).filter(
      (name) => context.table.columns.some((column) => column.name === name),
    );
    const condition = buildSearchCondition(builder, columns, search);
    if (!condition) {
      throw new CliError(
        `Resource "${context.resource.name}" has no searchable columns`,
        `Filter explicitly instead: --where "column~${search}"`,
      );
    }
    conditions.push(condition);
  }
  return conditions;
}

export async function listRows(context: CrudContext): Promise<CommandResult> {
  const { args, table } = context;
  const builder = new QueryBuilder();
  const conditions = whereConditions(builder, context);
  const requested = listFlag(args, "columns");
  const columns =
    requested.length > 0
      ? requested
      : boolFlag(args, "all-columns")
        ? undefined
        : context.resource.listColumns?.filter((name) =>
            table.columns.some((column) => column.name === name),
          );

  const orderFlag = stringFlag(args, "order");
  const order = orderFlag
    ? sanitizeOrderBy(table, orderFlag)
    : context.resource.orderBy
      ? sanitizeOrderBy(table, context.resource.orderBy)
      : table.primaryKey.map((name) => `"${name}"`).join(", ");

  if (boolFlag(args, "count")) {
    const text = `select count(*)::int as count from "${table.name}" ${combine(conditions)}`;
    const rows = await context.sql.unsafe<Array<{ count: number }>>(
      text,
      parameters(builder.params),
    );
    return { count: rows[0]?.count ?? 0 };
  }

  const limit = intFlag(args, "limit") ?? defaultLimit;
  const offset = intFlag(args, "offset") ?? 0;
  if (limit < 1 || limit > 500 || offset < 0 || !Number.isSafeInteger(offset)) {
    throw new CliError(
      "Invalid pagination",
      "Use --limit 1..500 and a nonnegative --offset; default limit is 50.",
    );
  }
  const text = [
    `select ${selectList(columns, table)} from "${table.name}"`,
    combine(conditions),
    order ? `order by ${order}` : "",
    limit >= 0 ? `limit ${builder.bind(limit)}` : "",
    offset > 0 ? `offset ${builder.bind(offset)}` : "",
  ]
    .filter((part) => part.length > 0)
    .join(" ");
  const rows = await context.sql.unsafe<Row[]>(text, parameters(builder.params));
  return boolFlag(args, "camel") ? rows.map(camelizeRow) : rows;
}

export async function getRow(context: CrudContext, ref: string): Promise<CommandResult> {
  const { table } = context;
  const primaryKey = table.primaryKey[0];
  if (!primaryKey) {
    throw new CliError(
      `Table "${table.name}" has no single-column primary key`,
      `Use: nahhasio ${context.resource.name} list --where "…"`,
    );
  }
  const id = await resolveRef(context.sql, table, ref, { scope: context.resource.scope ?? {} });
  const builder = new QueryBuilder();
  const text = `select * from "${table.name}" where "${primaryKey}"::text = ${builder.bind(id)} limit 1`;
  const rows = await context.sql.unsafe<Row[]>(text, parameters(builder.params));
  const row = rows[0];
  if (!row) throw new CliError(`No ${context.resource.name} with ${primaryKey} "${id}"`);
  return boolFlag(context.args, "camel") ? camelizeRow(row) : row;
}

/** Collect `--set key=value` and `--json-set key=<json>` into resolved column values. */
async function collectAssignments(context: CrudContext): Promise<Map<string, SqlValue>> {
  const assignments = new Map<string, SqlValue>();
  for (const entry of rawListFlag(context.args, "set")) {
    const { key, value } = splitAssignment(entry);
    const column = requireColumn(context.table, assertIdentifier(key, "column name"));
    const resolved =
      column.type === "uuid" && !column.isArray
        ? await resolveForeignKey(context.sql, context.schema, context.table, column, value)
        : value;
    assignments.set(column.name, coerceValue(column, resolved));
  }
  for (const entry of rawListFlag(context.args, "json-set")) {
    const { key, value } = splitAssignment(entry);
    const column = requireColumn(context.table, assertIdentifier(key, "column name"));
    try {
      // SAFETY: --json-set is an explicit request to store parsed JSON in this column.
      assignments.set(column.name, JSON.parse(value) as SqlValue);
    } catch {
      throw new CliError(
        `--json-set ${key} received invalid JSON`,
        `Received: ${value.slice(0, 120)}`,
      );
    }
  }
  for (const [name, value] of Object.entries(context.resource.scope ?? {})) {
    if (!assignments.has(name)) assignments.set(name, value);
  }
  return assignments;
}

export async function createRow(context: CrudContext): Promise<CommandResult> {
  const assignments = await collectAssignments(context);
  if (assignments.size === 0) {
    throw new CliError(
      `Nothing to insert into ${context.table.name}`,
      `Provide values: nahhasio ${context.resource.name} create --set column=value`,
    );
  }
  const missing = context.table.columns.filter(
    (column) =>
      !column.nullable &&
      !column.hasDefault &&
      !column.isGenerated &&
      !assignments.has(column.name),
  );
  if (missing.length > 0) {
    throw new CliError(
      `Missing required columns for ${context.table.name}: ${missing.map((column) => column.name).join(", ")}`,
      `Inspect the table with: nahhasio schema ${context.table.name}`,
    );
  }

  const builder = new QueryBuilder();
  const names = [...assignments.keys()];
  const placeholders = names.map((name) => builder.bind(assignments.get(name)));
  const text = `insert into "${context.table.name}" (${names.map((name) => `"${name}"`).join(", ")})
    values (${placeholders.join(", ")}) returning *`;

  if (boolFlag(context.args, "dry-run")) {
    return {
      dryRun: true,
      action: "create",
      table: context.table.name,
      values: Object.fromEntries(assignments),
    };
  }
  const rows = await context.sql.unsafe<Row[]>(text, parameters(builder.params));
  const row = rows[0];
  await recordAudit(context.sql, {
    action: `cli.${context.resource.name}.create`,
    targetType: context.table.name,
    targetId: primaryKeyOf(context.table, row),
    summary: `Created ${context.resource.name} via CLI`,
    changes: Object.fromEntries(assignments),
  });
  return row;
}

function primaryKeyOf(table: TableInfo, row: Row | undefined): string | null {
  if (!row) return null;
  const key = table.primaryKey[0];
  if (!key) return null;
  const value = row[key];
  return value === null || value === undefined ? null : String(value);
}

/**
 * Build the WHERE clause identifying the rows a write targets: either one row named by a
 * reference, or every row matching `--where`. Never both, and never neither — an unqualified
 * update or delete is always a mistake.
 */
async function buildTargetConditions(
  builder: QueryBuilder,
  context: CrudContext,
  ref: string | undefined,
  verb: "update" | "delete",
) {
  const conditions = scopeConditions(builder, context);
  if (ref !== undefined) {
    const primaryKey = context.table.primaryKey[0];
    if (!primaryKey) throw new CliError(`Table "${context.table.name}" has no primary key`);
    const id = await resolveRef(context.sql, context.table, ref, {
      scope: context.resource.scope ?? {},
    });
    conditions.push({ text: `"${primaryKey}"::text = ${builder.bind(id)}` });
    return conditions;
  }
  const expressions = rawListFlag(context.args, "where");
  if (expressions.length === 0) {
    throw new CliError(
      `Refusing to ${verb} every row`,
      `Pass a reference, or scope the ${verb} with --where "column=value".`,
    );
  }
  for (const expression of expressions) {
    conditions.push(buildCondition(builder, context.table, expression));
  }
  return conditions;
}

export async function updateRows(
  context: CrudContext,
  ref: string | undefined,
): Promise<CommandResult> {
  const assignments = await collectAssignments(context);
  for (const name of Object.keys(context.resource.scope ?? {})) {
    // Scope values are a filter, not an edit: updating `person` must not rewrite `kind`.
    if (!rawListFlag(context.args, "set").some((entry) => entry.startsWith(`${name}=`))) {
      assignments.delete(name);
    }
  }
  if (assignments.size === 0) {
    throw new CliError(
      `Nothing to update`,
      `Provide values: nahhasio ${context.resource.name} update <ref> --set column=value`,
    );
  }

  if (boolFlag(context.args, "dry-run")) {
    // Placeholder numbering is positional, so the preview needs its own builder rather than a
    // slice of the update's parameters.
    const previewBuilder = new QueryBuilder();
    const previewConditions = await buildTargetConditions(previewBuilder, context, ref, "update");
    const affected = await context.sql.unsafe<Row[]>(
      `select * from "${context.table.name}" ${combine(previewConditions)}`,
      parameters(previewBuilder.params),
    );
    return {
      dryRun: true,
      action: "update",
      table: context.table.name,
      wouldAffect: affected.length,
      values: Object.fromEntries(assignments),
      rows: affected.slice(0, 10),
    };
  }

  const builder = new QueryBuilder();
  const setClause = [...assignments.entries()]
    .map(([name, value]) => `"${name}" = ${builder.bind(value)}`)
    .join(", ");
  const touchesUpdatedAt = context.table.columns.some((column) => column.name === "updated_at");
  const conditions = await buildTargetConditions(builder, context, ref, "update");

  const text = `update "${context.table.name}" set ${setClause}${
    touchesUpdatedAt && !assignments.has("updated_at") ? ", updated_at = now()" : ""
  } ${combine(conditions)} returning *`;

  const rows = await context.sql.unsafe<Row[]>(text, parameters(builder.params));
  await recordAudit(context.sql, {
    action: `cli.${context.resource.name}.update`,
    targetType: context.table.name,
    targetId: rows.length === 1 ? primaryKeyOf(context.table, rows[0]) : null,
    summary: `Updated ${rows.length} ${context.resource.name} row(s) via CLI`,
    changes: Object.fromEntries(assignments),
  });
  return rows;
}

export async function deleteRows(
  context: CrudContext,
  ref: string | undefined,
): Promise<CommandResult> {
  const builder = new QueryBuilder();
  const conditions = await buildTargetConditions(builder, context, ref, "delete");
  const where = combine(conditions);
  const affected = await context.sql.unsafe<Row[]>(
    `select * from "${context.table.name}" ${where}`,
    parameters(builder.params),
  );
  if (boolFlag(context.args, "dry-run")) {
    return {
      dryRun: true,
      action: "delete",
      table: context.table.name,
      wouldAffect: affected.length,
      rows: affected.slice(0, 10),
    };
  }
  if (affected.length > 1 && !boolFlag(context.args, "yes")) {
    throw new CliError(
      `This would delete ${affected.length} rows from ${context.table.name}`,
      "Re-run with --yes to confirm, or --dry-run to see exactly what matches.",
    );
  }
  const rows = await context.sql.unsafe<Row[]>(
    `delete from "${context.table.name}" ${where} returning *`,
    parameters(builder.params),
  );
  await recordAudit(context.sql, {
    action: `cli.${context.resource.name}.delete`,
    targetType: context.table.name,
    targetId: rows.length === 1 ? primaryKeyOf(context.table, rows[0]) : null,
    summary: `Deleted ${rows.length} ${context.resource.name} row(s) via CLI`,
    changes: { deleted: rows.length },
  });
  return { deleted: rows.length, rows };
}

export function buildContext(
  sql: Sql,
  schema: SchemaInfo,
  resource: Resource,
  args: ParsedArgs,
): CrudContext {
  return { sql, schema, resource, table: requireTable(schema, resource.table), args };
}
