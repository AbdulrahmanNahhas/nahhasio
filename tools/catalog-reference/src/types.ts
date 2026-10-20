/**
 * The value vocabulary shared by every layer of the CLI.
 *
 * A catalog row is JSON-shaped by the time it reaches output, and every value the CLI sends to
 * Postgres is drawn from the same set. Naming that set once keeps `unknown` out of the public
 * signatures (see the `anti-slop` rules in `oxlint.config.ts`) without pretending each command
 * returns a distinct hand-written type.
 */

export type SqlValue =
  // `undefined` is included deliberately: reading a column that a query did not select yields
  // it, and the driver is configured to transform it to NULL on the way out (see `db.ts`).
  | undefined
  | string
  | number
  | boolean
  | null
  | Date
  | readonly SqlValue[]
  | { readonly [key: string]: SqlValue };

/** One database row, keyed by column name. */
export type Row = { readonly [column: string]: SqlValue };

/** A mutable row under construction, before it is handed to the driver. */
export type RowDraft = { [column: string]: SqlValue };

/** Whatever a command hands back to be rendered; `undefined` means "already written to stdout". */
export type CommandResult = SqlValue | undefined;
