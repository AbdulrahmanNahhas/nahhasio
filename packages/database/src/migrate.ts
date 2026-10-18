/** Explicit operator command, sharing the single journal and maintenance lock. Never startup. */
import { fileURLToPath } from "node:url";

import { runMigrations } from "./run-migrations";

await runMigrations(fileURLToPath(new URL("../drizzle", import.meta.url)));
