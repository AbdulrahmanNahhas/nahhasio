/** Read-only comparison helper for bin/test-rust-catalog's socket-only fixture. */
import { writeFile } from "node:fs/promises";

import { parseArgs } from "../args";
import { statsCommand, statsPresets } from "../commands/stats";
import { workExport } from "../commands/work";
import { openDatabase, closeDatabase } from "../db";

if (
  process.env.DATABASE_URL !== "postgresql:///nahhasio_test_rust_migrations" ||
  !process.env.PGHOST?.startsWith("/tmp/nahhasio-catalog.")
)
  throw new Error("Private parity fixture required");
const destination = process.argv[2];
if (!destination?.startsWith(`${process.env.PGHOST}/`))
  throw new Error("Private fixture output required");
try {
  const document = await workExport(openDatabase(), "Rust whole-work fixture");
  const reports = Object.fromEntries(
    await Promise.all(
      statsPresets.map(async (name) => [
        name,
        await statsCommand(openDatabase(), parseArgs(["stats", name]), name),
      ]),
    ),
  );
  await writeFile(destination, JSON.stringify({ document, reports }));
} finally {
  await closeDatabase();
}
