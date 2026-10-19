import { spawn } from "node:child_process";
/** Explicit maintenance only. Never imported by application startup. Private outputs stay in data/backups. */
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";
import { z } from "zod";

import { runMigrations } from "../src/run-migrations";
import { verifyFoundation } from "./verify-foundation";

const identifier = z.string().regex(/^[a-z_][a-z0-9_]*$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const inventorySchema = z.array(
  z.strictObject({
    name: identifier,
    columns: z.array(identifier).min(1),
    fingerprints: z.array(z.string().regex(/^[0-9a-f]{32}$/)),
  }),
);
const checksumSchema = z.strictObject({ database: sha256, artwork: sha256, inventory: sha256 });
const rehearsalSchema = z.strictObject({
  database: z.string().regex(/^nahhasio_schema_rehearsal_[0-9]+$/),
  migrationHash: sha256,
  restoredAndMigrated: z.literal(true),
  assertions: z.number().int().positive(),
  originalTablesPreserved: z.number().int().positive(),
});
const appliedSchema = z.strictObject({
  migrationHash: sha256,
  originalTablesPreserved: z.number().int().positive(),
  appliedAt: z.iso.datetime(),
});
type Inventory = z.infer<typeof inventorySchema>;
type CheckpointOutput =
  | Inventory
  | z.infer<typeof checksumSchema>
  | z.infer<typeof rehearsalSchema>
  | z.infer<typeof appliedSchema>;
const root = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const source = new URL(process.env.DATABASE_URL ?? "postgresql://127.0.0.1:23102/arcadia");
const [mode, argument] = process.argv.slice(2);
const directory = resolve(argument ?? `${root}/data/backups/schema-foundation-${Date.now()}`);
if (!directory.startsWith(`${root}/data/backups/`))
  throw new Error("Use a private project data/backups directory.");
const migrations = resolve(root, "packages/database/drizzle");
const environment = {
  ...process.env,
  PGHOST: source.hostname,
  PGPORT: source.port || "5432",
  PGUSER: decodeURIComponent(source.username) || process.env.PGUSER || process.env.USER,
  PGPASSWORD: decodeURIComponent(source.password),
  PGDATABASE: decodeURIComponent(source.pathname.slice(1)),
};
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
async function command(program: string, args: string[], extra: NodeJS.ProcessEnv = {}) {
  await new Promise<void>((done, reject) => {
    const child = spawn(program, args, {
      env: { ...environment, ...extra },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let failed = false;
    // Database tools may include connection details in diagnostics: keep errors out of the transcript.
    child.stderr.on("data", () => {
      failed = true;
    });
    child.on("error", () => reject(new Error(`Cannot execute ${program}; run inside devenv.`)));
    child.on("close", (code) =>
      code === 0
        ? done()
        : reject(new Error(`${program} failed (${code}, diagnostics present: ${failed}).`)),
    );
  });
}
async function json(name: string, value: CheckpointOutput) {
  await writeFile(resolve(directory, name), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}
async function inventory(
  sql: postgres.Sql | postgres.TransactionSql,
  baseline?: Inventory,
): Promise<Inventory> {
  const tables =
    baseline ??
    (
      await sql<{ name: string; columns: string[] }[]>`
    select table_name as name,array_agg(column_name order by ordinal_position) as columns
    from information_schema.columns where table_schema='public'
    group by table_name order by table_name`
    ).map((table) => ({ ...table, fingerprints: [] }));
  const result: Inventory = [];
  for (const table of tables) {
    const rows = await sql.unsafe<{ fingerprint: string }[]>(
      `select md5(row_to_json(x)::text) fingerprint from (select ${table.columns.map(quote).join(",")} from public.${quote(table.name)}) x order by 1`,
    );
    result.push({ ...table, fingerprints: rows.map((row) => row.fingerprint) });
  }
  return result;
}
function preserved(before: Inventory, after: Inventory) {
  for (const table of before) {
    const remaining = [...(after.find((entry) => entry.name === table.name)?.fingerprints ?? [])];
    for (const fingerprint of table.fingerprints) {
      const index = remaining.indexOf(fingerprint);
      if (index < 0)
        throw new Error(
          `Original content changed in ${table.name}; stop and inspect the checkpoint.`,
        );
      remaining.splice(index, 1);
    }
    if (remaining.length && table.name !== "roles")
      throw new Error(`Unexpected inserted rows in ${table.name}.`);
  }
}
async function digest(name: string) {
  return createHash("sha256")
    .update(await readFile(resolve(directory, name)))
    .digest("hex");
}
const sql = postgres(source.toString(), { max: 1, onnotice: () => {} });
try {
  if (mode === "backup") {
    await mkdir(dirname(directory), { recursive: true, mode: 0o700 });
    // Refuse to overwrite an earlier recovery point, including a partially completed one.
    await mkdir(directory, { mode: 0o700 });
    await chmod(directory, 0o700);
    const baseline = await sql.begin("isolation level repeatable read read only", async (tx) => {
      await tx`set local time zone 'UTC'`;
      const [snapshot] = await tx<{ id: string }[]>`select pg_export_snapshot() id`;
      if (!snapshot) throw new Error("Cannot export database snapshot.");
      await command("pg_dump", [
        "--format=custom",
        "--no-owner",
        `--snapshot=${snapshot.id}`,
        `--file=${directory}/catalog.dump`,
      ]);
      return inventory(tx);
    });
    await command("tar", [
      "-czf",
      `${directory}/artwork.tar.gz`,
      "-C",
      root,
      "data/media",
      "data/recovery",
    ]);
    await Promise.all([
      chmod(`${directory}/catalog.dump`, 0o600),
      chmod(`${directory}/artwork.tar.gz`, 0o600),
    ]);
    await json("inventory.json", baseline);
    await json("checksums.json", {
      database: await digest("catalog.dump"),
      artwork: await digest("artwork.tar.gz"),
      inventory: await digest("inventory.json"),
    });
    console.log(
      `Private backup created: ${directory}; ${baseline.length} table fingerprints saved.`,
    );
  } else if (mode === "rehearse" || mode === "apply") {
    const baseline = inventorySchema.parse(
      JSON.parse(await readFile(`${directory}/inventory.json`, "utf8")),
    );
    const checksums = checksumSchema.parse(
      JSON.parse(await readFile(`${directory}/checksums.json`, "utf8")),
    );
    if (
      checksums.database !== (await digest("catalog.dump")) ||
      checksums.artwork !== (await digest("artwork.tar.gz")) ||
      checksums.inventory !== (await digest("inventory.json"))
    )
      throw new Error("Backup checksum mismatch.");
    const journal = await readFile(`${migrations}/meta/_journal.json`);
    const entries = z
      .object({ entries: z.array(z.object({ tag: z.string().regex(/^[0-9]{4}_[a-z0-9_]+$/) })) })
      .parse(JSON.parse(journal.toString())).entries;
    const migrationFiles = await Promise.all(
      entries.map((entry) => readFile(`${migrations}/${entry.tag}.sql`)),
    );
    const acceptance = await readFile(
      fileURLToPath(new URL("./verify-foundation.ts", import.meta.url)),
    );
    const hash = createHash("sha256").update(journal);
    for (const migration of migrationFiles) hash.update(migration);
    const migrationHash = hash.update(acceptance).digest("hex");
    if (mode === "rehearse") {
      const name = `nahhasio_schema_rehearsal_${Date.now()}`;
      await sql.unsafe(`create database ${quote(name)}`);
      await command("pg_restore", [
        "--exit-on-error",
        "--no-owner",
        "--no-privileges",
        `--dbname=${name}`,
        `${directory}/catalog.dump`,
      ]);
      await command("tar", ["-tzf", `${directory}/artwork.tar.gz`]);
      const target = new URL(source);
      target.pathname = `/${name}`;
      const restored = postgres(target.toString(), { max: 1, onnotice: () => {} });
      try {
        await restored`set time zone 'UTC'`;
        preserved(baseline, await inventory(restored, baseline));
        await runMigrations(migrations, target.toString());
        const assertions = await verifyFoundation(restored);
        preserved(baseline, await inventory(restored, baseline));
        await json("rehearsal.json", {
          database: name,
          migrationHash,
          restoredAndMigrated: true,
          assertions,
          originalTablesPreserved: baseline.length,
        });
        console.log(
          `Restored and migrated ${name}; ${assertions} integrity assertions passed; all ${baseline.length} original tables preserved. Live catalog unchanged.`,
        );
      } finally {
        await restored.end();
      }
    } else {
      const receipt = rehearsalSchema.parse(
        JSON.parse(await readFile(`${directory}/rehearsal.json`, "utf8")),
      );
      if (!receipt.restoredAndMigrated || receipt.migrationHash !== migrationHash)
        throw new Error("Rehearse the exact current migration first.");
      await sql`set time zone 'UTC'`;
      preserved(baseline, await inventory(sql, baseline));
      await runMigrations(migrations, source.toString());
      preserved(baseline, await inventory(sql, baseline));
      await json("applied.json", {
        migrationHash,
        originalTablesPreserved: baseline.length,
        appliedAt: new Date().toISOString(),
      });
      console.log(`Migration applied; all ${baseline.length} original tables preserved.`);
    }
  } else throw new Error("Use backup, rehearse <backup-directory>, or apply <backup-directory>.");
} finally {
  await sql.end();
}
