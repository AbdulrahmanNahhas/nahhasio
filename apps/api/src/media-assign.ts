import { database } from "./database";
import {
  type mediaKinds,
  normalizeStoredMediaPath,
  removeStoredMedia,
  storeMedia,
} from "./media-storage";

/**
 * Primary-artwork assignment and orphan cleanup, shared by the catalog write paths in `app.ts`
 * and the per-episode editor (`features/admin-episodes`). Every artwork change goes through
 * `assignMediaPath` so the previous file is purged when nothing references it anymore.
 */
export async function purgeUnreferencedMedia(paths: Array<string | null | undefined>) {
  const sql = database().client;
  for (const path of new Set(paths.filter((value): value is string => Boolean(value)))) {
    if (!path.startsWith("/media/")) continue;
    const [usage] = await sql`select a.id,
      exists(select 1 from media_asset_assignments x where x.asset_id=a.id) as referenced,
      exists(select 1 from audit_logs l where l.action='admin.artwork.rename' and l.target_type='media_assets' and l.target_id=a.id::text) as renamed
      from media_assets a where a.path=${path} or exists(select 1 from audit_logs l where l.action='admin.artwork.rename' and l.target_type='media_assets' and l.target_id=a.id::text and l.changes->>'compatibilityPath'=${path})`;
    if (usage?.renamed) continue; // Compatibility paths require explicit reviewed cleanup.
    if (!usage?.referenced) {
      try {
        await removeStoredMedia(path);
        if (usage?.id) await sql`delete from media_assets where id=${usage.id}`;
      } catch (error) {
        if (usage?.id)
          await sql`update media_assets set deletion_error=${error instanceof Error ? error.message : "File deletion failed"}, updated_at=now() where id=${usage.id}`;
        console.warn(`Could not remove unreferenced media ${path}`, error);
      }
    }
  }
}

export type MediaOwner = {
  titleId?: string;
  installmentId?: string;
  episodeId?: string;
  entityId?: string;
};

export async function assignMediaPath(
  sql: ReturnType<typeof database>["client"],
  path: string | null | undefined,
  role: (typeof mediaKinds)[number],
  owner: MediaOwner,
  isPrimary = true,
) {
  const ownerEntries = Object.entries(owner).filter(([, value]) => value);
  if (ownerEntries.length !== 1) throw new Error("Exactly one media owner is required");
  const ownerColumns = {
    titleId: "title_id",
    installmentId: "installment_id",
    episodeId: "episode_id",
    entityId: "entity_id",
  } as const;
  // SAFETY: `ownerEntries` are the truthy entries of a `MediaOwner`, whose keys are exactly the
  // four `ownerColumns` keys and whose values are the owner ids (strings); the length check
  // above guarantees the first entry exists.
  const [ownerKey, ownerId] = ownerEntries[0] as [keyof typeof ownerColumns, string];
  const ownerColumn = ownerColumns[ownerKey];
  const storedPath = normalizeStoredMediaPath(path);
  // Resolve a replacement before removing the current assignment. Besides producing a clearer
  // validation boundary, this prevents an invalid/qualified display URL from deleting good media
  // and then failing to insert its replacement.
  const asset = storedPath
    ? (
        await sql`select a.id from media_assets a where a.path=${storedPath} or exists(select 1 from audit_logs l where l.action='admin.artwork.rename' and l.target_type='media_assets' and l.target_id=a.id::text and l.changes->>'compatibilityPath'=${storedPath}) order by (a.path=${storedPath}) desc limit 1`
      )[0]
    : undefined;
  if (storedPath && !asset) throw new Error("The selected media asset is not registered");
  const previous = isPrimary
    ? await sql`select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id where x.${sql(ownerColumn)}=${ownerId} and x.role=${role} and x.is_primary`
    : [];
  if (isPrimary)
    await sql`delete from media_asset_assignments where ${sql(ownerColumn)}=${ownerId} and role=${role} and is_primary`;
  if (asset) {
    await sql`insert into media_asset_assignments (asset_id, role, ${sql(ownerColumn)}, is_primary)
      values (${asset.id}, ${role}, ${ownerId}, ${isPrimary}) on conflict do nothing`;
  }
  await purgeUnreferencedMedia(previous.map((row) => String(row.path)));
}

/** A `data:image/...` value pasted into a record becomes a stored asset; anything else passes through. */
export async function materializeEmbeddedMedia(
  value: string | null | undefined,
  ownerName: string,
  assetType: (typeof mediaKinds)[number],
) {
  if (!value?.startsWith("data:image/")) return value ?? null;
  const stored = await storeMedia({
    dataUrl: value,
    fileName: `${ownerName}-${assetType}`,
    ownerName,
    assetType,
  });
  const [existing] = await database()
    .client`select path from media_assets where sha256=${stored.sha256}`;
  if (existing) {
    if (existing.path !== stored.relativePath) await removeStoredMedia(stored.relativePath);
    return String(existing.path);
  }
  await database().client`
    insert into media_assets (path, sha256, mime_type, byte_size, width, height, original_filename)
    values (${stored.relativePath}, ${stored.sha256}, ${stored.mimeType}, ${stored.byteSize}, ${stored.width}, ${stored.height}, ${stored.originalFilename})`;
  return stored.relativePath;
}
