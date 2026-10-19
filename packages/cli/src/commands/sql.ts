/**
 * `nahhasio sql` — the escape hatch.
 *
 * No fixed command surface will cover every question worth asking of a catalog this shape, so
 * raw SQL stays available. Statements are read-only unless `--write` is passed: the guard is a
 * real one (a rolled-back `READ ONLY` transaction), not a regex over the query text, because
 * pattern-matching SQL for mutations is trivially defeated by a CTE.
 */

import { readFile } from "node:fs/promises";

import type { ParsedArgs } from "../args";
import { boolFlag, stringFlag } from "../args";
import type { Sql } from "../db";
import { recordAudit } from "../db";
import { CliError } from "../output";
import type { CommandResult, Row } from "../types";

export async function sqlCommand(
  sql: Sql,
  args: ParsedArgs,
  inlineQuery: string | undefined,
): Promise<CommandResult> {
  const file = stringFlag(args, "file");
  const query = file ? await readFile(file, "utf8") : inlineQuery;
  if (!query || query.trim().length === 0) {
    throw new CliError(
      "No SQL provided",
      'Pass a statement: nahhasio sql "select count(*) from titles" — or --file query.sql',
    );
  }

  const write = boolFlag(args, "write");
  if (!write) {
    // A READ ONLY transaction lets Postgres itself reject any write, including writes hidden
    // inside a data-modifying CTE.
    return sql.begin(async (transaction) => {
      await transaction.unsafe("set transaction read only");
      return transaction.unsafe<Row[]>(query);
    });
  }

  if (boolFlag(args, "dry-run")) {
    // Run the statement for real, report what it touched, then roll back.
    let rows: Row[] = [];
    try {
      await sql.begin(async (transaction) => {
        rows = await transaction.unsafe<Row[]>(query);
        throw new RollbackSignal();
      });
    } catch (error) {
      if (!(error instanceof RollbackSignal)) throw error;
    }
    return { dryRun: true, rolledBack: true, rows };
  }

  const result = await sql.begin(async (transaction) => {
    const rows = await transaction.unsafe<Row[]>(query);
    await recordAudit(transaction, {
      action: "cli.sql.write",
      targetType: "sql",
      summary: `Executed a write statement via CLI`,
      changes: { statement: query.slice(0, 2000) },
    });
    return rows;
  });
  return result;
}

class RollbackSignal extends Error {
  constructor() {
    super("rollback");
    this.name = "RollbackSignal";
  }
}
