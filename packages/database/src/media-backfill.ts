import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

function dimensions(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/png" && bytes.length >= 24)
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (mimeType === "image/gif" && bytes.length >= 10)
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  if (mimeType === "image/webp" && bytes.length >= 30) {
    const kind = bytes.subarray(12, 16).toString("ascii");
    if (kind === "VP8X")
      return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
    if (kind === "VP8L") {
      const bits = bytes.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (marker && marker >= 0xc0 && marker <= 0xc3)
        return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      offset += 2 + length;
    }
  }
  return { width: 1, height: 1 };
}

/**
 * Explicit legacy recovery pass (`db:prepare-legacy-media`), never implicit in normal migration
 * or startup. On a v1-shaped database it records every referenced image
 * into `media_asset_backfill` for the media migration to consume; on a v2 database it re-hashes
 * every `media_assets` row from disk (fixing dimensions/sha, merging exact duplicates). Media
 * files are read from `NAHHASIO_MEDIA_ROOT`, the same directory the API serves.
 */
export async function prepareMediaBackfill(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const sql = postgres(databaseUrl, { max: 1 });
  const [legacy] = await sql`select to_regclass('public.titles') is not null as present,
  exists(select 1 from information_schema.columns where table_name='titles' and column_name='poster_path') as has_paths`;
  if (!legacy?.present) {
    await sql.end();
    return;
  }

  if (legacy.has_paths)
    await sql`create table if not exists media_asset_backfill (
  path text primary key, sha256 text not null, mime_type text not null, byte_size integer not null,
  width integer not null, height integer not null, original_filename text not null
)`;
  const rows = legacy.has_paths
    ? await sql`
  select poster_path as path from titles where poster_path is not null
  union select banner_path from titles where banner_path is not null
  union select logo_path from titles where logo_path is not null
  union select poster_path from installments where poster_path is not null
  union select profile_path from entities where profile_path is not null
  union select relative_path from artwork where relative_path is not null`
    : await sql`
  select id, path from media_assets`;
  const uploadRoot = resolve(
    process.env.NAHHASIO_MEDIA_ROOT ??
      process.env.ARCADIA_MEDIA_ROOT ??
      fileURLToPath(new URL("../../../data/media/uploads", import.meta.url)),
  );
  const mediaRoot = resolve(uploadRoot, "..");

  for (const row of rows) {
    const path = String(row.path);
    if (!path.startsWith("/media/")) continue;
    const file = path.startsWith("/media/uploads/")
      ? resolve(uploadRoot, `.${path.slice("/media/uploads".length)}`)
      : resolve(mediaRoot, `.${path.slice("/media".length)}`);
    const containmentRoot = path.startsWith("/media/uploads/") ? uploadRoot : mediaRoot;
    if (relative(containmentRoot, file).startsWith("..")) continue;
    try {
      const bytes = await readFile(file);
      const extension = path.toLocaleLowerCase().match(/\.[^.]+$/)?.[0];
      const mimeType =
        extension === ".png"
          ? "image/png"
          : extension === ".webp"
            ? "image/webp"
            : extension === ".gif"
              ? "image/gif"
              : "image/jpeg";
      const size = dimensions(bytes, mimeType);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (legacy.has_paths)
        await sql`insert into media_asset_backfill (path, sha256, mime_type, byte_size, width, height, original_filename)
        values (${path}, ${sha256}, ${mimeType}, ${bytes.byteLength}, ${size.width}, ${size.height}, ${basename(path)})
        on conflict (path) do update set sha256=excluded.sha256, mime_type=excluded.mime_type,
        byte_size=excluded.byte_size, width=excluded.width, height=excluded.height,
        original_filename=excluded.original_filename`;
      else {
        const id = String(row.id);
        const [duplicate] =
          await sql`select id from media_assets where sha256=${sha256} and id<>${id} limit 1`;
        if (duplicate)
          await sql.begin(async (transaction) => {
            await transaction`insert into media_asset_assignments
            (asset_id, role, title_id, installment_id, episode_id, entity_id, is_primary, created_at, updated_at)
            select ${duplicate.id}, role, title_id, installment_id, episode_id, entity_id, is_primary, created_at, updated_at
            from media_asset_assignments where asset_id=${id} on conflict do nothing`;
            await transaction`delete from media_asset_assignments where asset_id=${id}`;
            await transaction`delete from media_assets where id=${id}`;
          });
        else
          await sql`update media_assets set sha256=${sha256}, mime_type=${mimeType}, byte_size=${bytes.byteLength},
          width=${size.width}, height=${size.height}, original_filename=${basename(path)}, updated_at=now() where id=${id}`;
      }
    } catch {
      // The migration records a deterministic placeholder; validation will flag the missing file.
    }
  }
  await sql.end();
}
