import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
/** Explicit, preservation-first baseline maintenance. Never called during server startup. */
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile, realpath, chmod } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";
import { z } from "zod";

import { verifyFoundation } from "./verify-foundation";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const [mode, argument] = process.argv.slice(2);
if (!argument || !["prepare", "rehearse", "apply"].includes(mode ?? ""))
  throw new Error("Use prepare|rehearse|apply with a new private project data/backups directory.");
const directory = resolve(argument);
if (!directory.startsWith(`${root}/data/backups/`)) throw new Error("Use project data/backups.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be selected explicitly.");
const source = new URL(process.env.DATABASE_URL);
const environment = {
  ...process.env,
  PGHOST: source.searchParams.get("host") ?? source.hostname,
  PGPORT: source.port || "5432",
  PGUSER: decodeURIComponent(source.username) || process.env.PGUSER || process.env.USER,
  PGPASSWORD: decodeURIComponent(source.password),
  PGDATABASE: decodeURIComponent(source.pathname.slice(1)),
};
const name = z.string().regex(/^[a-z_][a-z0-9_]*$/);
const tableSchema = z.array(z.object({ name, fingerprint: z.string() }));
const rootsSchema = z.array(z.string());
const quote = (value: string) => `"${name.parse(value)}"`;
const sql = postgres(source.toString(), { max: 1, onnotice: () => {} });
const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
async function save<T>(file: string, value: T) {
  await writeFile(resolve(directory, file), JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
}
async function load(file: string) {
  return JSON.parse(await readFile(resolve(directory, file), "utf8"));
}
async function command(program: string, args: string[], database = environment.PGDATABASE) {
  const selected = new URL(source);
  selected.pathname = `/${database}`;
  await new Promise<void>((done, reject) => {
    const child = spawn(program, args, {
      env: { ...environment, PGDATABASE: database, DATABASE_URL: selected.toString() },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let failed = false;
    child.stderr.on("data", () => {
      failed = true;
    });
    child.on("error", () => reject(new Error(`Cannot execute ${program}.`)));
    child.on("close", (code) =>
      code === 0
        ? done()
        : reject(new Error(`${program} failed (${code}; private diagnostics: ${failed}).`)),
    );
  });
}
async function inventory(connection: postgres.Sql | postgres.TransactionSql) {
  const tables = await connection<
    { name: string }[]
  >`select tablename name from pg_tables where schemaname='public' order by tablename`;
  const rows = [];
  for (const table of tables) {
    const [result] = await connection.unsafe<{ fingerprint: string }[]>(
      `select md5(coalesce(string_agg(row_hash,'' order by row_hash),'')) fingerprint from (select md5(row_to_json(t)::text) row_hash from public.${quote(table.name)} t) x`,
    );
    rows.push({ name: table.name, fingerprint: result!.fingerprint });
  }
  return rows;
}
function same<T>(before: T, after: T, description: string) {
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error(`${description} changed; stop and create a fresh checkpoint.`);
}
function normalize(text: string) {
  return text
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("\\restrict ") &&
        !line.startsWith("\\unrestrict ") &&
        !line.startsWith("--"),
    )
    .join("\n")
    .trim();
}
async function schema(file: string, database = environment.PGDATABASE, snapshot?: string) {
  await command(
    "pg_dump",
    [
      "--schema-only",
      "--schema=public",
      "--no-owner",
      "--no-privileges",
      ...(snapshot ? [`--snapshot=${snapshot}`] : []),
      `--file=${directory}/${file}`,
    ],
    database,
  );
  await chmod(resolve(directory, file), 0o600);
  return normalize(await readFile(resolve(directory, file), "utf8"));
}
async function digest(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(resolve(directory, file))) hash.update(chunk);
  return hash.digest("hex");
}
async function checksums() {
  const files = z.record(z.string(), z.string()).parse(await load("checksums.json"));
  for (const [file, hash] of Object.entries(files)) {
    if (!/^[a-z0-9.-]+$/.test(file) || (await digest(file)) !== hash)
      throw new Error("Backup checksum mismatch.");
  }
}
async function history() {
  const folder = resolve(root, "packages/database/drizzle");
  const journal = z
    .object({
      entries: z.array(z.object({ tag: z.string().regex(/^\d{4}_[a-z0-9_]+$/), when: z.number() })),
    })
    .parse(JSON.parse(await readFile(`${folder}/meta/_journal.json`, "utf8")));
  if (journal.entries.length !== 1 || journal.entries[0]!.tag !== "0000_current_catalog")
    throw new Error("This maintenance tool only adopts the initial current-catalog baseline.");
  const entry = journal.entries[0]!;
  const bytes = await readFile(`${folder}/${entry.tag}.sql`);
  return { ...entry, hash: sha(bytes) };
}
async function adopt(connection: postgres.TransactionSql, hash: string, when: number) {
  await connection`delete from drizzle.__drizzle_migrations`;
  await connection`insert into drizzle.__drizzle_migrations(hash,created_at) values(${hash},${when})`;
}
async function assertArtwork(connection: postgres.Sql, roots: string[]) {
  const assets = await connection<
    { path: string; sha256: string }[]
  >`select path,sha256 from media_assets order by id`;
  const uploads = await realpath(
    process.env.NAHHASIO_MEDIA_ROOT ??
      process.env.ARCADIA_MEDIA_ROOT ??
      `${root}/data/media/uploads`,
  );
  const publicRoot = await realpath(
    process.env.NAHHASIO_PUBLIC_MEDIA_ROOT ??
      process.env.ARCADIA_PUBLIC_MEDIA_ROOT ??
      dirname(uploads),
  );
  let matched = 0;
  for (const asset of assets) {
    const relative = asset.path.startsWith("/media/") ? asset.path.slice(7) : "";
    if (!relative || relative.split("/").some((part) => !part || part === ".." || part === "."))
      throw new Error("Invalid registered artwork path.");
    const owner = relative.startsWith("uploads/") ? uploads : publicRoot;
    const original = await realpath(
      resolve(owner, relative.startsWith("uploads/") ? relative.slice(8) : relative),
    );
    const index = roots.findIndex((folder) => original.startsWith(`${folder}/`));
    if (index < 0) throw new Error("Artwork is outside the archived roots.");
    const restored = resolve(
      directory,
      `artwork-${index}`,
      original.slice(roots[index]!.length + 1),
    );
    if (sha(await readFile(restored)) !== asset.sha256)
      throw new Error("Restored artwork hash mismatch.");
    matched += 1;
  }
  return matched;
}
try {
  if (mode === "prepare") {
    await mkdir(dirname(directory), { recursive: true, mode: 0o700 });
    await mkdir(directory, { mode: 0o700 });
    await sql.begin("isolation level repeatable read read only", async (tx) => {
      await tx`set local time zone 'UTC'`;
      const [snapshot] = await tx<{ id: string }[]>`select pg_export_snapshot() id`;
      await command("pg_dump", [
        "--format=custom",
        "--no-owner",
        `--snapshot=${snapshot!.id}`,
        `--file=${directory}/catalog.dump`,
      ]);
      await schema("schema.sql", environment.PGDATABASE, snapshot!.id);
      await save("inventory.json", await inventory(tx));
      await save(
        "ledger.json",
        await tx`select id,hash,created_at from drizzle.__drizzle_migrations order by id`,
      );
      await save(
        "roles.json",
        await tx`select id,slug,label_en,label_ar,entity_kind,position from roles order by position,id`,
      );
      await save(
        "extensions.json",
        await tx`select e.extname,n.nspname schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname<>'plpgsql' order by e.extname`,
      );
    });
    const uploads = await realpath(
      process.env.NAHHASIO_MEDIA_ROOT ??
        process.env.ARCADIA_MEDIA_ROOT ??
        `${root}/data/media/uploads`,
    );
    const publicRoot = await realpath(
      process.env.NAHHASIO_PUBLIC_MEDIA_ROOT ??
        process.env.ARCADIA_PUBLIC_MEDIA_ROOT ??
        dirname(uploads),
    );
    const candidates = [...new Set([uploads, publicRoot])].toSorted((a, b) => a.length - b.length);
    const roots = candidates.filter(
      (path, index) => !candidates.slice(0, index).some((parent) => path.startsWith(`${parent}/`)),
    );
    if (roots.some((path) => path === "/" || path === process.env.HOME))
      throw new Error("Refuse an overbroad artwork root.");
    await save("roots.json", roots);
    const files = [
      "catalog.dump",
      "schema.sql",
      "inventory.json",
      "ledger.json",
      "roles.json",
      "extensions.json",
      "roots.json",
    ];
    for (const [index, folder] of roots.entries()) {
      const file = `artwork-${index}.tar`;
      await command("tar", ["-cf", `${directory}/${file}`, "-C", folder, "."]);
      files.push(file);
    }
    await command("tar", [
      "-cf",
      `${directory}/migration-history.tar`,
      "-C",
      root,
      "packages/database/drizzle",
    ]);
    files.push("migration-history.tar");
    const hashes: Record<string, string> = {};
    for (const file of files) {
      await chmod(resolve(directory, file), 0o600);
      hashes[file] = await digest(file);
    }
    await save("checksums.json", hashes);
    console.log(
      `Private database, configured artwork and migration-history backup complete: ${directory}`,
    );
  } else {
    await checksums();
    const baseline = await history();
    const before = tableSchema.parse(await load("inventory.json"));
    const originalSchema = normalize(await readFile(resolve(directory, "schema.sql"), "utf8"));
    if (mode === "rehearse") {
      const suffix = randomUUID().replaceAll("-", "");
      const restoredName = `nahhasio_baseline_${suffix}`;
      const freshName = `nahhasio_baseline_empty_${suffix}`;
      const roots = rootsSchema.parse(await load("roots.json"));
      for (const [index] of roots.entries()) {
        await mkdir(resolve(directory, `artwork-${index}`), { mode: 0o700, recursive: true });
        await command("tar", [
          "-xf",
          `${directory}/artwork-${index}.tar`,
          "-C",
          `${directory}/artwork-${index}`,
        ]);
      }
      await sql.unsafe(`create database ${quote(restoredName)}`);
      await sql.unsafe(`create database ${quote(freshName)}`);
      const url = new URL(source);
      url.pathname = `/${restoredName}`;
      const restored = postgres(url.toString(), { max: 1, onnotice: () => {} });
      try {
        await command("pg_restore", [
          "--exit-on-error",
          "--no-owner",
          "--no-privileges",
          `--dbname=${restoredName}`,
          `${directory}/catalog.dump`,
        ]);
        await restored`set time zone 'UTC'`;
        same(before, await inventory(restored), "Restored public data");
        same(originalSchema, await schema("restored-schema.sql", restoredName), "Restored schema");
        const artwork = await assertArtwork(restored, roots);
        await restored.begin(async (tx) => {
          await adopt(tx, baseline.hash, baseline.when);
        });
        const assertions = await verifyFoundation(restored);
        same(before, await inventory(restored), "Adopted public data");
        const cli = process.env.NAHHASIO_CLI_BIN ?? `${root}/target/debug/nahhasio`;
        await command(cli, ["migrate", "status", "--json"], restoredName);
        await command(cli, ["migrate", "apply", "--dry-run", "--json"], restoredName);
        await command(cli, ["migrate", "apply", "--write", "--json"], freshName);
        same(originalSchema, await schema("fresh-schema.sql", freshName), "Fresh baseline schema");
        await save("rehearsal.json", {
          hash: baseline.hash,
          when: baseline.when,
          restoredName,
          freshName,
          tables: before.length,
          artwork,
          assertions,
          publicDataUnchanged: true,
          schemaMatches: true,
        });
        console.log(
          `Rehearsal passed: ${before.length} tables unchanged, ${artwork} restored artwork hashes verified, fresh schema matches; ${assertions} constraint assertions passed.`,
        );
      } finally {
        await restored.end();
      }
    } else {
      if (process.env.NAHHASIO_APPLY_BASELINE !== "1")
        throw new Error("Apply requires NAHHASIO_APPLY_BASELINE=1 after a successful rehearsal.");
      const receipt = z
        .object({
          hash: z.string(),
          when: z.number(),
          publicDataUnchanged: z.literal(true),
          schemaMatches: z.literal(true),
        })
        .parse(await load("rehearsal.json"));
      same(receipt.hash, baseline.hash, "Rehearsed baseline");
      same(receipt.when, baseline.when, "Rehearsed timestamp");
      await sql.begin("isolation level serializable", async (tx) => {
        await tx`set local lock_timeout='5s'`;
        await tx`set local statement_timeout='60s'`;
        await tx`set local time zone 'UTC'`;
        const [lock] = await tx<
          { locked: boolean }[]
        >`select pg_try_advisory_xact_lock(23103,1000) locked`;
        if (!lock?.locked) throw new Error("Another migration operation is running.");
        await tx.unsafe(
          `lock table ${before.map((t) => `public.${quote(t.name)}`).join(",")},drizzle.__drizzle_migrations in share mode`,
        );
        same(before, await inventory(tx), "Live public data since backup");
        same(originalSchema, await schema("apply-schema.sql"), "Live schema since backup");
        same(
          await load("ledger.json"),
          await tx`select id,hash,created_at from drizzle.__drizzle_migrations order by id`,
          "Original migration ledger",
        );
        await adopt(tx, baseline.hash, baseline.when);
        same(before, await inventory(tx), "Live public data during adoption");
      });
      await save("applied.json", {
        hash: baseline.hash,
        when: baseline.when,
        appliedAt: new Date().toISOString(),
        publicTablesUnchanged: before.length,
        ledgerOnly: true,
      });
      console.log(
        `Baseline adopted: only migration ledger changed; all ${before.length} public tables are identical to the backup.`,
      );
    }
  }
} catch (error) {
  if (error instanceof postgres.PostgresError) {
    console.error(
      `Baseline checkpoint failed (SQLSTATE ${error.code}); private database diagnostics withheld.`,
    );
    process.exitCode = 1;
  } else throw error;
} finally {
  await sql.end();
}
