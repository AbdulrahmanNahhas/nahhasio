import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "./client";

/**
 * Applies every pending migration in `migrationsFolder` (a `drizzle/` directory with its
 * `meta/_journal.json`). Shares the journal and the `drizzle.__drizzle_migrations` table with
 * `drizzle-kit migrate`, so a database migrated by one can be continued by the other. Used by the
 * API image's `dist/migrate.js` and the explicit `pnpm db:migrate` command.
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
