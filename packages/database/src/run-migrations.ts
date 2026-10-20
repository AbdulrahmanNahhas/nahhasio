import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "./client";

/**
 * Applies every pending migration in `migrationsFolder` (a `drizzle/` directory with its
 * `meta/_journal.json`). Shares the journal and the `drizzle.__drizzle_migrations` table with
 * `drizzle-kit migrate`, so a database migrated by one can be continued by the other. Used by the
 * explicit development `pnpm db:migrate` command. Installed operations use the Rust CLI.
 */
export async function runMigrations(migrationsFolder: string, databaseUrl?: string) {
  const { db, client } = createDatabase(databaseUrl);
  const lease = await client.reserve();
  let locked = false;
  try {
    const [lock] = await lease<
      { locked: boolean }[]
    >`select pg_try_advisory_lock(23103,1000) locked`;
    if (!lock?.locked) throw new Error("Another schema maintenance operation is running.");
    locked = true;
    const expected = readMigrationFiles({ migrationsFolder });
    const [ledger] = await lease<{ exists: boolean }[]>`
      select to_regclass('drizzle.__drizzle_migrations') is not null as exists`;
    const applied = ledger?.exists
      ? await lease<{ hash: string; created_at: string }[]>`
          select hash,created_at from drizzle.__drizzle_migrations order by created_at,id`
      : [];
    for (const [index, row] of applied.entries()) {
      const entry = expected[index];
      if (
        !entry ||
        row.hash !== entry.hash ||
        String(row.created_at) !== String(entry.folderMillis)
      )
        throw new Error(
          "Migration history mismatch; use the reviewed baseline recovery procedure.",
        );
    }
    if (!applied.length) {
      const [tables] = await lease<{ n: number }[]>`
        select count(*)::int n from pg_tables where schemaname='public'`;
      if (tables?.n) throw new Error("A populated database requires explicit baseline adoption.");
    }
    await migrate(db, { migrationsFolder });
  } finally {
    try {
      if (locked) await lease`select pg_advisory_unlock(23103,1000)`;
    } finally {
      lease.release();
      await client.end();
    }
  }
}
