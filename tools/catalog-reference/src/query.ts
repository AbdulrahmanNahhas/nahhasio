/**
 * A minimal parameterized SQL builder.
 *
 * postgres.js tagged templates are excellent for fixed queries but awkward for a WHERE clause
 * assembled from a variable number of `--where` flags. Building the text with `$n` placeholders
 * and handing it to `sql.unsafe(text, params)` keeps every user-supplied *value* parameterized;
 * identifiers are the only thing interpolated, and they are validated against the introspected
 * schema before they get here.
 */

import { assertIdentifier } from "./db";
import type { ColumnInfo, TableInfo } from "./introspect";
import { requireColumn } from "./introspect";
import { CliError } from "./output";
import type { SqlValue } from "./types";
import { coerceValue, nullLiterals } from "./values";

export class QueryBuilder {
  readonly params: SqlValue[] = [];

  /** Register a value and return its `$n` placeholder. */
  bind(value: SqlValue): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }
}

export type Condition = { text: string };

const operators = [
  { token: ":in=", kind: "in" },
  { token: ":nin=", kind: "nin" },
  { token: "!=", kind: "ne" },
  { token: ">=", kind: "gte" },
  { token: "<=", kind: "lte" },
  { token: "~", kind: "like" },
  { token: ">", kind: "gt" },
  { token: "<", kind: "lt" },
  { token: "=", kind: "eq" },
] as const;

type OperatorKind = (typeof operators)[number]["kind"];

const comparisonSymbol = {
  ne: "<>",
  gte: ">=",
  lte: "<=",
  gt: ">",
  lt: "<",
  eq: "=",
} satisfies Partial<Record<OperatorKind, string>>;

type ParsedFilter = { column: string; kind: OperatorKind; value: string };

function parseExpression(expression: string): ParsedFilter {
  for (const { token, kind } of operators) {
    const index = expression.indexOf(token);
    if (index > 0) {
      return {
        column: expression.slice(0, index).trim(),
        kind,
        value: expression.slice(index + token.length),
      };
    }
  }
  throw new CliError(
    `Could not parse filter "${expression}"`,
    "Use column=value, column!=value, column~substring, column>value, or column:in=a,b,c",
  );
}

/**
 * Turn one `--where` expression into a SQL condition.
 *
 * `column=null` becomes `IS NULL` and `column!=null` becomes `IS NOT NULL`, since a bare
 * `= NULL` is never what the caller meant.
 */
export function buildCondition(
  builder: QueryBuilder,
  table: TableInfo,
  expression: string,
): Condition {
  const { column: columnName, kind, value } = parseExpression(expression);
  const column = requireColumn(table, assertIdentifier(columnName, "column name"));
  const reference = `"${column.name}"`;

  if (nullLiterals.has(value) && (kind === "eq" || kind === "ne")) {
    return { text: `${reference} is ${kind === "ne" ? "not " : ""}null` };
  }

  if (kind === "in" || kind === "nin") {
    const members = value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (members.length === 0) {
      throw new CliError(`Filter "${expression}" needs at least one value after :in=`);
    }
    const placeholders = members.map((member) =>
      builder.bind(coerceValue({ ...column, nullable: false }, member)),
    );
    return {
      text: `${reference} ${kind === "nin" ? "not " : ""}in (${placeholders.join(", ")})`,
    };
  }

  if (kind === "like") {
    // Substring search always runs against text, so non-text columns are cast rather than
    // rejected — `--where release_year~199` is a reasonable thing to ask for.
    return { text: `${reference}::text ilike ${builder.bind(`%${value}%`)}` };
  }

  const symbol = comparisonSymbol[kind];
  if (!symbol) throw new CliError(`Unsupported operator in "${expression}"`);
  return { text: `${reference} ${symbol} ${builder.bind(coerceValue(column, value))}` };
}

/** OR-joined substring match across a resource's search columns. */
export function buildSearchCondition(
  builder: QueryBuilder,
  columns: readonly string[],
  term: string,
): Condition | undefined {
  if (columns.length === 0) return undefined;
  const placeholder = builder.bind(`%${term}%`);
  const parts = columns.map(
    (column) => `"${assertIdentifier(column, "column name")}"::text ilike ${placeholder}`,
  );
  return { text: `(${parts.join(" or ")})` };
}

export function combine(conditions: readonly Condition[]): string {
  const parts = conditions.map((condition) => condition.text).filter((text) => text.length > 0);
  return parts.length > 0 ? `where ${parts.join(" and ")}` : "";
}

/**
 * Validate an `order by` clause supplied as a flag. Only `column [asc|desc] [nulls first|last]`
 * segments are permitted, so this can be interpolated without opening an injection path.
 */
export function sanitizeOrderBy(table: TableInfo, clause: string): string {
  const segments = clause
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const rendered = segments.map((segment) => {
    const match = /^([a-z_][a-z0-9_]*)(\s+(asc|desc))?(\s+nulls\s+(first|last))?$/i.exec(segment);
    if (!match) {
      throw new CliError(
        `Cannot sort by "${segment}"`,
        'Use "column", "column desc", or "column desc nulls last".',
      );
    }
    const [, columnName, , direction, , nulls] = match;
    const column = requireColumn(table, (columnName ?? "").toLowerCase());
    return [
      `"${column.name}"`,
      direction ? direction.toLowerCase() : "",
      nulls ? `nulls ${nulls.toLowerCase()}` : "",
    ]
      .filter((part) => part.length > 0)
      .join(" ");
  });
  return rendered.join(", ");
}

export function selectList(columns: readonly string[] | undefined, table: TableInfo): string {
  if (!columns || columns.length === 0) return "*";
  return columns
    .map((name) => `"${requireColumn(table, assertIdentifier(name, "column name")).name}"`)
    .join(", ");
}

export function writableColumns(table: TableInfo): ColumnInfo[] {
  return table.columns.filter((column) => !column.isGenerated);
}
