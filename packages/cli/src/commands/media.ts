/**
 * `arcadia media` — content-addressed image ingest and assignment.
 *
 * Mirrors `apps/api/src/media-storage.ts`: files are hashed with sha256, stored under
 * `/media/uploads/<role>s/<slug>-<role>-<hash>.<ext>`, and deduplicated by hash so re-ingesting
 * the same image reuses the existing asset. Dimensions are read from the file header rather
 * than a decoding library, matching the API's approach and keeping the CLI dependency-free.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ParsedArgs } from "../args";
import { boolFlag, stringFlag } from "../args";
import { recordAudit, type Sql } from "../db";
import { loadSchema, requireTable } from "../introspect";
import { CliError } from "../output";
import { resolveRef } from "../resolve";
import type { CommandResult, RowDraft } from "../types";

export const mediaRoles = ["poster", "banner", "logo", "profile"] as const;
export type MediaRole = (typeof mediaRoles)[number];

const maximumBytes = 10 * 1024 * 1024;

type MediaOwnerColumn = { column: string; table: string };

type DetectedImage = { mimeType: string; detail: MimeDetail };

type MimeDetail = {
  extension: string;
  matches: (bytes: Buffer) => boolean;
  dimensions: (bytes: Buffer) => { width: number; height: number } | null;
};

const mimeDetails = {
  "image/png": {
    extension: ".png",
    matches: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    dimensions: (bytes) =>
      bytes.length >= 24 ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } : null,
  },
  "image/jpeg": {
    extension: ".jpg",
    matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8,
    dimensions: readJpegDimensions,
  },
  "image/gif": {
    extension: ".gif",
    matches: (bytes) => ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii")),
    dimensions: (bytes) =>
      bytes.length >= 10 ? { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) } : null,
  },
  "image/webp": {
    extension: ".webp",
    matches: (bytes) =>
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP",
    dimensions: readWebpDimensions,
  },
} satisfies Record<string, MimeDetail>;

function readJpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    const length = bytes.readUInt16BE(offset + 2);
    // SOF0-SOF15, excluding the non-frame markers DHT (c4), JPG (c8), and DAC (cc).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

function readWebpDimensions(bytes: Buffer): { width: number; height: number } | null {
  const format = bytes.subarray(12, 16).toString("ascii");
  if (format === "VP8X" && bytes.length >= 30) {
    return {
      width: 1 + (bytes.readUIntLE(24, 3) & 0xffffff),
      height: 1 + (bytes.readUIntLE(27, 3) & 0xffffff),
    };
  }
  if (format === "VP8 " && bytes.length >= 30) {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (format === "VP8L" && bytes.length >= 25) {
    const bits = bytes.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
}

function detectMime(bytes: Buffer): DetectedImage {
  for (const [mimeType, detail] of Object.entries(mimeDetails)) {
    if (detail.matches(bytes)) return { mimeType, detail };
  }
  throw new CliError(
    "Unrecognized image format",
    "Supported formats are PNG, JPEG, GIF, and WebP.",
  );
}

function mediaRoot(): string {
  return resolve(
    process.env.ARCADIA_MEDIA_ROOT ??
      fileURLToPath(new URL("../../../../data/media/uploads", import.meta.url)),
  );
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "asset"
  );
}

async function loadBytes(source: string): Promise<{ bytes: Buffer; originalFilename: string }> {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new CliError(`Could not download ${source} (HTTP ${response.status})`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const name = basename(new URL(source).pathname) || "download";
    return { bytes, originalFilename: name };
  }
  return { bytes: await readFile(source), originalFilename: basename(source) };
}

const ownerColumns = {
  title: { column: "title_id", table: "titles" },
  installment: { column: "installment_id", table: "installments" },
  episode: { column: "episode_id", table: "episodes" },
  entity: { column: "entity_id", table: "entities" },
} satisfies Record<string, MediaOwnerColumn>;

export async function mediaCommand(
  sql: Sql,
  args: ParsedArgs,
  verb: string | undefined,
  target: string | undefined,
): Promise<CommandResult> {
  if (verb === "ingest") return ingest(sql, args, target);
  if (verb === "assign") return assign(sql, args, target);
  if (verb === "purge") return purge(sql, args);
  throw new CliError(
    `Unknown media command "${verb ?? ""}"`,
    "Use: arcadia media ingest <file-or-url> --role poster [--title <ref>] | media assign | media purge",
  );
}

async function ingest(
  sql: Sql,
  args: ParsedArgs,
  source: string | undefined,
): Promise<CommandResult> {
  if (!source) {
    throw new CliError(
      "No image given",
      "arcadia media ingest ./poster.jpg --role poster --title 'Arcane'",
    );
  }
  // SAFETY: validated against mediaRoles on the next line; an unknown role throws.
  const role = (stringFlag(args, "role") ?? "poster") as MediaRole;
  if (!mediaRoles.includes(role)) {
    throw new CliError(`Unknown media role "${role}"`, `Roles: ${mediaRoles.join(", ")}`);
  }

  const { bytes, originalFilename } = await loadBytes(source);
  if (bytes.byteLength === 0) throw new CliError("The image is empty");
  if (bytes.byteLength > maximumBytes) {
    throw new CliError(
      `The image is ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB, over the 10MB limit`,
    );
  }
  const { mimeType, detail } = detectMime(bytes);
  const size = detail.dimensions(bytes);
  if (!size || size.width <= 0 || size.height <= 0) {
    throw new CliError(`Could not read the dimensions of this ${mimeType} image`);
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const [existing] = await sql<Array<{ id: string; path: string }>>`
    select id, path from media_assets where sha256 = ${sha256}`;

  let assetId: string;
  let path: string;
  if (existing) {
    assetId = existing.id;
    path = existing.path;
  } else {
    const ownerName =
      stringFlag(args, "name") ?? basename(originalFilename, extname(originalFilename));
    const fileName = `${slugify(ownerName)}-${role}-${sha256.slice(0, 10)}${detail.extension}`;
    path = `/media/uploads/${role}s/${fileName}`;
    if (boolFlag(args, "dry-run")) {
      return { dryRun: true, action: "ingest", path, sha256, mimeType, ...size };
    }
    const directory = resolve(mediaRoot(), `${role}s`);
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, fileName), bytes);
    const [row] = await sql<Array<{ id: string }>>`
      insert into media_assets (path, sha256, mime_type, byte_size, width, height, original_filename)
      values (${path}, ${sha256}, ${mimeType}, ${bytes.byteLength}, ${size.width}, ${size.height}, ${originalFilename})
      returning id`;
    if (!row) throw new CliError("Could not register the media asset");
    assetId = row.id;
  }

  const assignment = await assignIfRequested(sql, args, assetId, role);
  const result: RowDraft = {
    assetId,
    path,
    sha256,
    mimeType,
    width: size.width,
    height: size.height,
    reused: Boolean(existing),
  };
  if (assignment) result.assignedTo = assignment;
  return result;
}

async function assignIfRequested(
  sql: Sql,
  args: ParsedArgs,
  assetId: string,
  role: MediaRole,
): Promise<string | undefined> {
  const schema = await loadSchema(sql);
  for (const [flag, owner] of Object.entries(ownerColumns)) {
    const ref = stringFlag(args, flag);
    if (!ref) continue;
    const ownerId = await resolveRef(sql, requireTable(schema, owner.table), ref);
    await sql.begin(async (transaction) => {
      await transaction.unsafe(
        `delete from media_asset_assignments where "${owner.column}" = $1 and role = $2 and is_primary`,
        [ownerId, role],
      );
      await transaction.unsafe(
        `insert into media_asset_assignments (asset_id, role, "${owner.column}", is_primary)
         values ($1, $2, $3, true) on conflict do nothing`,
        [assetId, role, ownerId],
      );
      await recordAudit(transaction, {
        action: "cli.media.assign",
        targetType: owner.table,
        targetId: ownerId,
        summary: `Assigned ${role} via CLI`,
        changes: { assetId, role },
      });
    });
    return `${flag}:${ownerId}`;
  }
  return undefined;
}

async function assign(
  sql: Sql,
  args: ParsedArgs,
  assetRef: string | undefined,
): Promise<CommandResult> {
  if (!assetRef) {
    throw new CliError(
      "No asset given",
      "arcadia media assign <asset-id-or-path> --role banner --title 'Arcane'",
    );
  }
  // SAFETY: validated against mediaRoles on the next line; an unknown role throws.
  const role = (stringFlag(args, "role") ?? "poster") as MediaRole;
  if (!mediaRoles.includes(role)) {
    throw new CliError(`Unknown media role "${role}"`, `Roles: ${mediaRoles.join(", ")}`);
  }
  const schema = await loadSchema(sql);
  const assetId = await resolveRef(sql, requireTable(schema, "media_assets"), assetRef);
  const assigned = await assignIfRequested(sql, args, assetId, role);
  if (!assigned) {
    throw new CliError(
      "No owner given",
      "Pass exactly one of --title, --installment, --episode, or --entity.",
    );
  }
  return { assetId, role, assignedTo: assigned };
}

/**
 * Delete assets nothing references, removing the file from disk as well. Mirrors
 * `purgeUnreferencedMedia` in the API, including recording a `deletion_error` rather than
 * failing outright when a file cannot be removed.
 */
async function purge(sql: Sql, args: ParsedArgs): Promise<CommandResult> {
  const orphans = await sql<Array<{ id: string; path: string }>>`
    select a.id, a.path from media_assets a
    where not exists (select 1 from media_asset_assignments x where x.asset_id = a.id)
      and not exists (select 1 from audit_logs l where l.action='admin.artwork.rename' and l.target_type='media_assets' and l.target_id=a.id::text)`;
  if (boolFlag(args, "dry-run")) {
    return { dryRun: true, wouldDelete: orphans.length, rows: orphans.slice(0, 20) };
  }
  if (orphans.length === 0) return { deleted: 0 };
  if (!boolFlag(args, "yes")) {
    throw new CliError(
      `This would delete ${orphans.length} unreferenced media assets`,
      "Re-run with --yes to confirm, or --dry-run to list them.",
    );
  }
  const { rm } = await import("node:fs/promises");
  let deleted = 0;
  for (const orphan of orphans) {
    if (!orphan.path.startsWith("/media/uploads/")) continue;
    try {
      await rm(resolve(mediaRoot(), `.${orphan.path.slice("/media/uploads".length)}`), {
        force: true,
      });
      await sql`delete from media_assets where id = ${orphan.id}`;
      deleted += 1;
    } catch (error) {
      await sql`update media_assets
        set deletion_error = ${error instanceof Error ? error.message : "File deletion failed"},
            updated_at = now()
        where id = ${orphan.id}`;
    }
  }
  await recordAudit(sql, {
    action: "cli.media.purge",
    targetType: "media_assets",
    summary: `Purged ${deleted} unreferenced media assets via CLI`,
    changes: { deleted },
  });
  return { deleted, examined: orphans.length };
}
