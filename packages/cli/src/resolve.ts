/**
 * Turning human-readable references into primary keys.
 *
 * This is the single biggest token saver in the CLI. Without it every write is a two-step
 * dance: look up a UUID, then use it. With it, `nahhasio title get Arcane` and
 * `--set planet_id=emerald` just work, and foreign keys can be written as slugs or names
 * anywhere a UUID is accepted.
 */

import { isUuid, parameters, type Sql, type TransactionSql } from "./db";
import type { ColumnInfo, SchemaInfo, TableInfo } from "./introspect";
import { CliError } from "./output";
import { findResource } from "./registry";

type SecondaryLookup = { table: string; column: string; target: string };

/** Extra lookup paths that reach a row through a satellite table. */
const secondaryLookups = new Map<string, SecondaryLookup>([
  ["titles", { table: "title_aliases", column: "title", target: "title_id" }],
  ["entities", { table: "entity_aliases", column: "alias", target: "entity_id" }],
]);

export type ResolveOptions = {
  /** Restrict resolution to rows matching these column values (used for scoped resources). */
  scope?: Record<string, string>;
};

type Candidate = { id: string; label: string };

export async function resolveRef(
  sql: Sql | TransactionSql,
  table: TableInfo,
  ref: string,
  options: ResolveOptions = {},
): Promise<string> {
  const primaryKey = table.primaryKey[0];
  if (!primaryKey) {
    throw new CliError(
      `Table "${table.name}" has no single-column primary key`,
      "Address rows in this table with --where filters instead of a reference.",
    );
  }
  const keyColumn = table.columns.find((column) => column.name === primaryKey);
  if (keyColumn && keyColumn.type === "uuid" && isUuid(ref)) return ref;
  if (keyColumn && keyColumn.type === "text" && !refColumnsFor(table).length) return ref;

  const candidates = await findCandidates(sql, table, ref, options);
  if (candidates.length === 1) {
    const only = candidates[0];
    if (only) return only.id;
  }
  if (candidates.length === 0) {
    // A text primary key (Better Auth tables) is a legitimate literal reference.
    if (keyColumn?.type === "text") return ref;
    throw new CliError(
      `No ${table.name} row matches "${ref}"`,
      `Search with: nahhasio ${resourceNameFor(table)} list --search "${ref}"`,
    );
  }
  throw new CliError(
    `"${ref}" matches ${candidates.length} rows in ${table.name}`,
    `Pass one of these ids instead: ${candidates
      .slice(0, 8)
      .map((candidate) => `${candidate.id} (${candidate.label})`)
      .join("; ")}`,
  );
}

function resourceNameFor(table: TableInfo): string {
  return findResource(table.name)?.name ?? table.name;
}

function refColumnsFor(table: TableInfo): string[] {
  const registered = findResource(table.name);
  const configured = registered?.refColumns ?? [];
  const present = configured.filter((name) => table.columns.some((column) => column.name === name));
  if (present.length > 0) return [...present];
  // Fall back to conventional naming so unregistered tables still resolve by slug or name.
  return ["slug", "name", "title", "label_en", "display_name"].filter((name) =>
    table.columns.some((column) => column.name === name),
  );
}

async function findCandidates(
  sql: Sql | TransactionSql,
  table: TableInfo,
  ref: string,
  options: ResolveOptions,
): Promise<Candidate[]> {
  const primaryKey = table.primaryKey[0];
  if (!primaryKey) return [];
  const columns = refColumnsFor(table);
  if (columns.length === 0) return [];

  const scopeEntries = Object.entries(options.scope ?? {});
  const scopeClause = scopeEntries
    .map(([name], index) => `and "${name}"::text = $${index + 2}`)
    .join(" ");
  const scopeParams = scopeEntries.map(([, value]) => value);
  const label = columns.map((column) => `coalesce("${column}"::text, '')`).join(" || ' / ' || ");

  // Three passes, narrowest first: exact (case-insensitive), then prefix, then substring. An
  // exact match wins outright even when looser matches also exist, so "Monster" resolves to
  // Monster rather than reporting an ambiguity with "Monster Musume".
  const passes = [
    { operator: "=", value: ref },
    { operator: "ilike", value: `${ref}%` },
    { operator: "ilike", value: `%${ref}%` },
  ];

  for (const pass of passes) {
    const comparison = columns
      .map((column) =>
        pass.operator === "="
          ? `lower(btrim("${column}"::text)) = lower(btrim($1))`
          : `"${column}"::text ilike $1`,
      )
      .join(" or ");
    const text = `select "${primaryKey}"::text as id, ${label} as label
      from "${table.name}" where (${comparison}) ${scopeClause} limit 25`;
    const rows = await sql.unsafe<Candidate[]>(text, parameters([pass.value, ...scopeParams]));
    if (rows.length > 0) return rows;

    const secondary = secondaryLookups.get(table.name);
    if (secondary && pass.operator === "=") {
      const aliasRows = await sql.unsafe<Candidate[]>(
        `select distinct s."${secondary.target}"::text as id, s."${secondary.column}"::text as label
         from "${secondary.table}" s
         where lower(btrim(s."${secondary.column}")) = lower(btrim($1)) limit 25`,
        [ref],
      );
      if (aliasRows.length > 0) return aliasRows;
    }
  }
  return [];
}

/**
 * Coerce a value destined for a foreign-key column, accepting a human reference in place of a
 * UUID. Non-FK columns and already-valid UUIDs pass straight through.
 */
export async function resolveForeignKey(
  sql: Sql | TransactionSql,
  schema: SchemaInfo,
  table: TableInfo,
  column: ColumnInfo,
  raw: string,
): Promise<string> {
  if (isUuid(raw)) return raw;
  const foreignKey = table.foreignKeys.find((candidate) => candidate.column === column.name);
  if (!foreignKey) return raw;
  const target = schema.tables.get(foreignKey.referencesTable);
  if (!target) return raw;
  return resolveRef(sql, target, raw);
}
