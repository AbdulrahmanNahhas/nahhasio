/**
 * Coercion of command-line strings into values Postgres will accept for a given column.
 *
 * Everything arrives as text, so each value has to be interpreted against the introspected
 * column type. Enum mismatches and malformed JSON are caught here rather than surfacing as a
 * raw Postgres error, because the resulting message can name the legal values.
 */

import { isUuid } from "./db";
import type { ColumnInfo } from "./introspect";
import { CliError } from "./output";
import type { SqlValue } from "./types";

const integerTypes = new Set(["int2", "int4", "int8"]);
const numericTypes = new Set(["numeric", "float4", "float8"]);
const jsonTypes = new Set(["json", "jsonb"]);

export const nullLiterals = new Set(["null", "~null", "\\N"]);

function parseBoolean(raw: string, column: ColumnInfo): boolean {
  const normalized = raw.trim().toLowerCase();
  if (["true", "t", "yes", "y", "1", "on"].includes(normalized)) return true;
  if (["false", "f", "no", "n", "0", "off"].includes(normalized)) return false;
  throw new CliError(
    `Column "${column.name}" is boolean but received "${raw}"`,
    "Use true/false (or yes/no, 1/0).",
  );
}

function splitArray(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed === "") return [];
  if (trimmed.startsWith("[")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new CliError(`Expected a JSON array, received "${raw}"`);
    return parsed.map((entry) => String(entry));
  }
  return trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Convert one raw CLI string to a driver value. `null` (and `~null`) always mean SQL NULL —
 * a title genuinely named "null" has to be written through `--json-set` instead.
 */
export function coerceValue(column: ColumnInfo, raw: string): SqlValue {
  if (nullLiterals.has(raw)) {
    if (!column.nullable) {
      throw new CliError(
        `Column "${column.name}" is NOT NULL and cannot be set to null`,
        "Provide a value, or omit the column to keep the database default.",
      );
    }
    return null;
  }

  if (column.isArray) {
    const members = splitArray(raw);
    if (column.enumValues) for (const member of members) assertEnum(column, member);
    return members;
  }
  if (column.enumValues) return assertEnum(column, raw.trim());
  if (column.type === "bool") return parseBoolean(raw, column);
  if (integerTypes.has(column.type)) {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) {
      throw new CliError(`Column "${column.name}" is an integer but received "${raw}"`);
    }
    return parsed;
  }
  if (numericTypes.has(column.type)) {
    if (!Number.isFinite(Number(raw))) {
      throw new CliError(`Column "${column.name}" is numeric but received "${raw}"`);
    }
    // Passed through as text so `8.0` keeps its scale instead of collapsing to `8`.
    return raw.trim();
  }
  if (jsonTypes.has(column.type)) {
    try {
      // SAFETY: the column is json/jsonb, so any successfully parsed JSON is a legal value for it.
      return JSON.parse(raw) as SqlValue;
    } catch {
      throw new CliError(
        `Column "${column.name}" is ${column.type} but received invalid JSON`,
        `Received: ${raw.slice(0, 120)}`,
      );
    }
  }
  if (column.type === "uuid" && !isUuid(raw.trim())) {
    throw new CliError(
      `Column "${column.name}" expects a UUID but received "${raw}"`,
      'Pass a UUID, or use a reference the CLI can resolve (see "nahhasio help refs").',
    );
  }
  return raw;
}

function assertEnum(column: ColumnInfo, value: string): string {
  const allowed = column.enumValues ?? [];
  if (allowed.includes(value)) return value;
  throw new CliError(
    `Column "${column.name}" rejects "${value}"`,
    `Allowed values: ${allowed.join(", ")}`,
  );
}

export type Assignment = { key: string; value: string };

/** Split a `key=value` assignment, tolerating `=` inside the value. */
export function splitAssignment(input: string): Assignment {
  const index = input.indexOf("=");
  if (index === -1) {
    throw new CliError(
      `Expected key=value but received "${input}"`,
      'For example: --set audience=teen --set "summary=A long text."',
    );
  }
  return { key: input.slice(0, index).trim(), value: input.slice(index + 1) };
}
