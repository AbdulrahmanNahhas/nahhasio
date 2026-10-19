/**
 * Output formatting for the Nahhasio CLI.
 *
 * The default rendering is a compact text table rather than JSON. That is a deliberate cost
 * decision: this CLI's primary caller is an AI agent, and pretty-printed JSON spends a large
 * share of its tokens on punctuation and indentation. A table of 50 titles is a fraction of the
 * tokens of the same rows as JSON. `--json` stays available for anything that needs to be piped
 * into `jq` or parsed exactly.
 */

import type { Row, SqlValue } from "./types";

export type OutputMode = "table" | "json" | "ndjson" | "csv";

const combiningMarks = /\p{M}/gu;
const wideCharacters = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/u;

/** Approximate terminal columns a string occupies: combining marks are zero-width, CJK is two. */
export function displayWidth(value: string): number {
  let width = 0;
  for (const character of value.replace(combiningMarks, "")) {
    width += wideCharacters.test(character) ? 2 : 1;
  }
  return width;
}

function isText(value: SqlValue): value is string {
  return typeof value === "string";
}
function isScalar(value: SqlValue): value is number | boolean {
  return typeof value === "number" || typeof value === "boolean";
}
function isRow(value: SqlValue): value is Row {
  return value instanceof Object && !Array.isArray(value) && !(value instanceof Date);
}

function cell(value: SqlValue): string {
  if (value === null || value === undefined) return "";
  if (isText(value)) return value;
  if (isScalar(value)) return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(cell).join(", ");
  return JSON.stringify(value);
}

function truncate(value: string, limit: number): string {
  const flattened = value.replace(/\s+/g, " ").trim();
  if (limit <= 0 || displayWidth(flattened) <= limit) return flattened;
  let width = 0;
  let output = "";
  for (const character of flattened) {
    const next = width + displayWidth(character);
    if (next > limit - 1) break;
    output += character;
    width = next;
  }
  return `${output}…`;
}

function pad(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - displayWidth(value)));
}

export function renderTable(rows: readonly Row[], maxCellWidth = 60): string {
  if (rows.length === 0) return "(no rows)";
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  }
  const body = rows.map((row) => columns.map((key) => truncate(cell(row[key]), maxCellWidth)));
  const widths = columns.map((key, index) =>
    Math.max(displayWidth(key), ...body.map((cells) => displayWidth(cells[index] ?? ""))),
  );
  const line = (cells: readonly string[]) =>
    cells
      .map((value, index) => pad(value, widths[index] ?? 0))
      .join("  ")
      .trimEnd();
  return [
    line(columns),
    widths
      .map((width) => "-".repeat(width))
      .join("  ")
      .trimEnd(),
    ...body.map(line),
  ].join("\n");
}

/** Single records render as aligned `key: value` pairs — far easier to read than a 1-row table. */
export function renderRecord(row: Row, maxCellWidth = 0): string {
  const keys = Object.keys(row);
  if (keys.length === 0) return "(empty)";
  const width = Math.max(...keys.map(displayWidth));
  return keys
    .map((key) => {
      const raw = cell(row[key]);
      const value = maxCellWidth > 0 ? truncate(raw, maxCellWidth) : raw;
      return `${pad(key, width)}  ${value}`;
    })
    .join("\n");
}

function csvField(value: SqlValue): string {
  const text = cell(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function renderCsv(rows: readonly Row[]): string {
  if (rows.length === 0) return "";
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  }
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((key) => csvField(row[key])).join(",")),
  ].join("\n");
}

/** Narrow a command result to the row shapes the table and CSV renderers understand. */
function asRows(value: SqlValue): Row[] {
  if (Array.isArray(value)) return value.filter(isRow);
  return isRow(value) ? [value] : [];
}

export function render(value: SqlValue, mode: OutputMode, maxCellWidth = 60): string {
  if (mode === "json") return JSON.stringify(value, null, 2);
  if (mode === "ndjson") {
    const rows = Array.isArray(value) ? value : [value];
    return rows.map((row) => JSON.stringify(row)).join("\n");
  }
  if (mode === "csv") return renderCsv(asRows(value));
  if (Array.isArray(value)) return renderTable(asRows(value), maxCellWidth);
  // Single records are never truncated: there is only one, and its long fields are the point.
  if (isRow(value)) return renderRecord(value, 0);
  return cell(value);
}

export function emit(value: SqlValue, mode: OutputMode, maxCellWidth = 60): void {
  const text = render(value, mode, maxCellWidth);
  if (text.length > 0) process.stdout.write(`${text}\n`);
}

/**
 * A CLI error carrying an actionable hint. Agents recover from a failed command far more often
 * when the failure names the command that would have worked.
 */
export class CliError extends Error {
  readonly hint: string | undefined;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = "CliError";
    this.hint = hint;
  }
}

export function emitError(cause: unknown, mode: OutputMode): void {
  const message = cause instanceof Error ? cause.message : String(cause);
  const hint = cause instanceof CliError ? cause.hint : undefined;
  if (mode === "json" || mode === "ndjson") {
    process.stderr.write(`${JSON.stringify({ error: { message, hint } })}\n`);
    return;
  }
  process.stderr.write(`error: ${message}\n`);
  if (hint) process.stderr.write(`hint:  ${hint}\n`);
}
