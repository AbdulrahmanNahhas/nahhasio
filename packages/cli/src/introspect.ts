/**
 * Live schema introspection.
 *
 * The CLI derives column types, nullability, enum members, primary keys, and foreign keys from
 * the running database rather than from a hand-maintained table list. That means a Drizzle
 * migration can add a column or a whole table and every generic command
 * (`list`/`get`/`create`/`update`/`delete`/`stats`) picks it up with no CLI change, and
 * `arcadia schema` is always describing what actually exists.
 */

import { assertIdentifier, type Sql, type TransactionSql } from "./db";
import { CliError } from "./output";

export type ColumnInfo = {
  name: string;
  /** Postgres `udt_name`: `text`, `int4`, `uuid`, `bool`, `numeric`, `jsonb`, `_text`, or an enum type. */
  type: string;
  nullable: boolean;
  hasDefault: boolean;
  isArray: boolean;
  isGenerated: boolean;
  /** Enum members when `type` names a Postgres enum. */
  enumValues?: readonly string[];
};

export type ForeignKey = {
  column: string;
  referencesTable: string;
  referencesColumn: string;
};

export type TableInfo = {
  name: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  foreignKeys: ForeignKey[];
};

export type SchemaInfo = {
  tables: Map<string, TableInfo>;
  enums: Map<string, readonly string[]>;
};

let cached: SchemaInfo | undefined;

export async function loadSchema(sql: Sql | TransactionSql): Promise<SchemaInfo> {
  if (cached) return cached;

  const [columnRows, enumRows, primaryKeyRows, foreignKeyRows] = await Promise.all([
    sql<
      Array<{
        table_name: string;
        column_name: string;
        udt_name: string;
        is_nullable: string;
        has_default: boolean;
        is_generated: boolean;
      }>
    >`
      select c.table_name, c.column_name, c.udt_name, c.is_nullable,
             (c.column_default is not null) as has_default,
             coalesce(c.is_generated = 'ALWAYS' or c.identity_generation = 'ALWAYS', false) as is_generated
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
      order by c.table_name, c.ordinal_position`,
    sql<Array<{ typname: string; enumlabel: string }>>`
      select t.typname, e.enumlabel
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
      order by t.typname, e.enumsortorder`,
    sql<Array<{ table_name: string; column_name: string }>>`
      select tc.table_name, kcu.column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name
       and kcu.table_schema = tc.table_schema
      where tc.constraint_type = 'PRIMARY KEY' and tc.table_schema = 'public'
      order by kcu.ordinal_position`,
    sql<
      Array<{
        table_name: string;
        column_name: string;
        foreign_table_name: string;
        foreign_column_name: string;
      }>
    >`
      select tc.table_name, kcu.column_name,
             ccu.table_name as foreign_table_name, ccu.column_name as foreign_column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`,
  ]);

  const enums = new Map<string, string[]>();
  for (const row of enumRows) {
    const members = enums.get(row.typname);
    if (members) members.push(row.enumlabel);
    else enums.set(row.typname, [row.enumlabel]);
  }

  const tables = new Map<string, TableInfo>();
  for (const row of columnRows) {
    let table = tables.get(row.table_name);
    if (!table) {
      table = { name: row.table_name, columns: [], primaryKey: [], foreignKeys: [] };
      tables.set(row.table_name, table);
    }
    const isArray = row.udt_name.startsWith("_");
    const type = isArray ? row.udt_name.slice(1) : row.udt_name;
    const column: ColumnInfo = {
      name: row.column_name,
      type,
      nullable: row.is_nullable === "YES",
      hasDefault: row.has_default,
      isArray,
      isGenerated: row.is_generated,
    };
    const enumValues = enums.get(type);
    if (enumValues) column.enumValues = enumValues;
    table.columns.push(column);
  }
  for (const row of primaryKeyRows) tables.get(row.table_name)?.primaryKey.push(row.column_name);
  for (const row of foreignKeyRows) {
    tables.get(row.table_name)?.foreignKeys.push({
      column: row.column_name,
      referencesTable: row.foreign_table_name,
      referencesColumn: row.foreign_column_name,
    });
  }

  // SAFETY: `enums` is only ever populated with string arrays above and is never mutated after
  // this point, so widening its values to readonly is sound.
  cached = { tables, enums: enums as Map<string, readonly string[]> };
  return cached;
}

export function resetSchemaCache(): void {
  cached = undefined;
}

export function requireTable(schema: SchemaInfo, name: string): TableInfo {
  assertIdentifier(name, "table name");
  const table = schema.tables.get(name);
  if (!table) {
    const suggestion = nearest(name, [...schema.tables.keys()]);
    throw new CliError(
      `Unknown table "${name}"`,
      suggestion
        ? `Did you mean "${suggestion}"? Run "arcadia schema" to list every table.`
        : `Run "arcadia schema" to list every table.`,
    );
  }
  return table;
}

export function requireColumn(table: TableInfo, name: string): ColumnInfo {
  const column = table.columns.find((candidate) => candidate.name === name);
  if (!column) {
    const suggestion = nearest(
      name,
      table.columns.map((candidate) => candidate.name),
    );
    throw new CliError(
      `Table "${table.name}" has no column "${name}"`,
      suggestion
        ? `Did you mean "${suggestion}"? Run "arcadia schema ${table.name}" for the full column list.`
        : `Run "arcadia schema ${table.name}" for the full column list.`,
    );
  }
  return column;
}

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_value, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0] ?? 0;
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temporary = previous[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      previous[j] = Math.min((previous[j] ?? 0) + 1, (previous[j - 1] ?? 0) + 1, diagonal + cost);
      diagonal = temporary;
    }
  }
  return previous[b.length] ?? 0;
}

/** Best fuzzy match for an unknown name, used to turn typos into actionable hints. */
export function nearest(value: string, candidates: readonly string[]): string | undefined {
  let best: { name: string; score: number } | undefined;
  for (const candidate of candidates) {
    const score = editDistance(value.toLowerCase(), candidate.toLowerCase());
    if (score <= Math.max(2, Math.floor(candidate.length / 3)) && (!best || score < best.score)) {
      best = { name: candidate, score };
    }
  }
  return best?.name;
}
