# Operations and deployment boundary

Read [PROJECT.md](PROJECT.md) for confirmed product decisions. **Fedora deployment and release
installation are not implemented/accepted yet.** This guide distinguishes existing development
configuration from the installation/update procedures still to be delivered.

## Current runtime configuration

- Rust server: `DATABASE_URL`; `NAHHASIO_BIND` defaults to `127.0.0.1:23103`.
- Native client: `NAHHASIO_SERVER_URL` defaults to the loopback development server.
- Artwork: `NAHHASIO_MEDIA_ROOT` (uploads) and `NAHHASIO_PUBLIC_MEDIA_ROOT` (public media root), with legacy `ARCADIA_*` fallbacks.
  Default source-development roots are `data/media/uploads` and `data/media`.
- Device video destination: `NAHHASIO_VIDEO_ROOT`, otherwise `~/Videos/nahhasio`.
- Device job state: XDG state directory, normally `~/.local/state/nahhasio`.
- Full editor/providers/artwork: shared Rust services; no Node worker or repository source is
  needed by the installed server. Node/pnpm remains development/build tooling for the desktop.
- Debug-only generic administration: `NAHHASIO_LOCAL_ADMIN=true` and a private token; the
  server requires a debug build bound to loopback. This is not a production client credential.

Native credentials and provider keys stay outside JavaScript/committed files. Do not print
connection strings, hashes or tokens. Do not reuse demo accounts/passwords as production setup.

## Storage ownership

PostgreSQL owns identities/metadata/links/state. Artwork/video/subtitle bytes live in persistent
filesystem roots. Future Podman mounts must account for service ownership, read/write needs and
Fedora SELinux labels. Never treat all data/ directories as disposable caches.

`data/nahhasio.db` is a retained SQLite recovery candidate. Recovery tooling requires an explicit
`ARCADIA_V1_DB_PATH` and absolute `ARCADIA_V1_ARTWORK_ROOT`. Old artwork recovered under `data/recovery/legacy-build-artwork` may need
reconciliation; do not delete it or import it automatically. Private backups/captures remain ignored.

Device caches, completed device downloads and server library originals are separate. Removing a
device copy must not delete server originals. Missing paths or space should produce recoverable
errors. Cleanup only verified disposable files and respect active reader/job ownership.

## Planned Alpha delivery

Build a versioned server container and Linux AppImage, connect them on the home network, and
provide documented persistent mounts/HTTPS trust/owner setup. No website belongs to the delivered
product. Exact host hardware remains unverified. Jellyfin is the confirmed stored-media backend, with no
catalog metadata/artwork or tracking synchronization. Rootless Quadlets, service boot
ordering and certificate/setup mechanics will be chosen and verified during implementation.

The approved target includes automatic updates for both Nahhasio and its Linux AppImage.
Implementation must verify artifact provenance/integrity and compatibility, preserve private
state, handle failed downloads/activation and provide recovery. No updater is enabled by this
checkpoint. Server schema maintenance remains explicit and coordinated; restarting a service
never implicitly migrates/seeds/imports/cleans the catalog. PostgreSQL/Jellyfin upgrades are
managed separately from Nahhasio application updates.

### Rust-only runtime delivery order — 2026-10-19

1. Shared Rust catalog services and compiled operator tooling. Initial database/migration CLI,
   common schema discovery/redaction/pool setup and transfer-engine video selection restrictions
   are implemented; see [DEVELOPMENT.md](DEVELOPMENT.md#rust-operator-cli-checkpoint). Planets
   definition/membership workflows have also moved to shared Rust services behind the existing API.
2. Whole-work reconciliation/review/save, entity editors, artwork and providers now run in shared
   Rust, with native operator CLI parity. Isolated checks preserve contracts, UUIDs, transactions,
   authorization and artwork paths. Installed Fedora acceptance remains separate.
3. Add server-owned provider credential management through authenticated desktop administration.
   Saved keys are write-only through the API; responses report configured state. Keep secrets out
   of images, browser storage, logs, raw inspection and ordinary API responses.
4. Build a Node-free server image, private persistent storage, rootless Fedora Quadlets and
   trusted LAN HTTPS; deliver explicit install/backup/restore/update commands. Rehearse restoration
   and schema compatibility before moving family data. No live migration/cutover is implied here.
5. Complete versioned AppImage delivery and verified server/client automatic updates, then run
   installed native/LAN/reboot/reconnect/update/recovery acceptance. Jellyfin remains a later,
   separate media-only service; it supplies no catalog metadata, artwork or tracking authority.

Transfer restrictions currently prevent non-video filenames from being selected, read or exported
through the Rust engine, including direct callers and restored selections. They do not establish
that a renamed payload is valid video. Content validation, malicious-content fixtures and packaged
playback/network isolation acceptance remain outstanding. Torrent piece boundaries can include
adjacent unselected bytes in private engine storage; only selected eligible files may be exported.
Do not describe this as a guarantee that every received torrent byte is video or that arbitrary
media is 100% safe.

## Backup, migration and recovery requirements

Before live cutover or destructive data/schema work:

1. Secure independent PostgreSQL and artwork backups; video backup/recovery policy is separate.
2. Verify checksums and restore to a separate disposable instance.
3. Verify identities, counts/content/constraints, asset links and viewing state.
4. Rehearse additive migration/backfill and rollback/recovery; use the sole Drizzle ledger.
5. Apply only the explicitly approved operation and record outcome/activation.

Application image rollback cannot undo a database migration. Never restore an old whole-database
backup over a newer catalog as a casual fix. A same-laptop dump is not an independent backup.
Specific retained TVDB recovery evidence is in [migrations/remove-tvdb.md](migrations/remove-tvdb.md);
its dated verification must not be assumed to describe today's live schema/data.

## Current migration starting point

The approved [current-database baseline](BASELINE.md) is adopted locally. Its private recovery
checkpoint contains the original dump/ledger, configured artwork and exact old/new migration
sources; all public table content was preserved. Installed updates use the new baseline plus
future additive migrations. Do not restore the old dump over current data or run its retired
creation migrations automatically. Copy the verified recovery material to independent storage
before production cutover.
