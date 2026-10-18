import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { runMigrations } from "@arcadia/database";

/**
 * Container-friendly explicit `db:migrate`: Drizzle's pending migrations, without implicit
 * media rehashing/merging. Legacy media recovery has its own explicit command. A deployed API image
 * can migrate its own database with `node dist/migrate.js` — no repo checkout, no drizzle-kit, no
 * pnpm on the server. Never runs on API start; schema changes stay an explicit step (see
 * "Database and API safety" in CLAUDE.md and the Quadlet `arcadia-migrate` unit).
 *
 * The migrations folder is `packages/database/drizzle` in the repo and `/app/drizzle` in the image
 * (see apps/api/Dockerfile); `ARCADIA_MIGRATIONS_DIR` overrides both. Drizzle's programmatic
 * migrator and drizzle-kit share the journal and the `drizzle.__drizzle_migrations` table, so a
 * database migrated by one can be continued by the other.
 */
function migrationsFolder() {
  const configured = process.env.ARCADIA_MIGRATIONS_DIR;
  if (configured) return resolve(configured);
  const candidates = [
    resolve(import.meta.dirname, "../drizzle"),
    resolve(import.meta.dirname, "../../../packages/database/drizzle"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`No migrations folder found (looked in ${candidates.join(", ")})`);
  return found;
}

const folder = migrationsFolder();
console.log(`Applying pending migrations from ${folder}…`);
await runMigrations(folder);
console.log("Database is up to date.");
