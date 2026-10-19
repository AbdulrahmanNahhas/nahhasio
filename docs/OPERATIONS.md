# Operations and deployment boundary

Read [PROJECT.md](PROJECT.md) for confirmed product decisions. **Fedora deployment and release
installation are not implemented/accepted yet.** This guide distinguishes existing development
configuration from the installation/update procedures still to be delivered.

## Current runtime configuration

- Rust server: `DATABASE_URL`; `NAHHASIO_BIND` defaults to `127.0.0.1:23103`.
- Native client: `NAHHASIO_SERVER_URL` defaults to the loopback development server.
- Artwork: `NAHHASIO_MEDIA_ROOT` (uploads) and `NAHHASIO_PUBLIC_MEDIA_ROOT` (public media root), with legacy `ARCADIA_*` fallbacks.
  Default source-development roots are `data/media/uploads` and `data/media`.
- Device video destination: `NAHHASIO_MEDIA_ROOT`, otherwise `~/Videos/nahhasio`.
- Device job state: XDG state directory, normally `~/.local/state/nahhasio`.
- Full editor: fixed private worker at the trusted repository root; `NAHHASIO_EDITOR_ROOT`
  can select a packaged root. Node/tsx and shared dependencies remain required.
- Debug-only generic administration: `NAHHASIO_LOCAL_ADMIN=true` and a private token; the
  server requires a debug build bound to loopback. This is not a production client credential.

Native credentials and provider keys stay outside JavaScript/committed files. Do not print
connection strings, hashes or tokens. Do not reuse demo accounts/passwords as production setup.

## Storage ownership

PostgreSQL owns identities/metadata/links/state. Artwork/video/subtitle bytes live in persistent
filesystem roots. Future Podman mounts must account for service ownership, read/write needs and
Fedora SELinux labels. Never treat all data/ directories as disposable caches.

`data/nahhasio.db` is a retained SQLite recovery candidate. Recovery tooling requires an explicit
`ARCADIA_V1_DB_PATH`. Old artwork recovered under `data/recovery/legacy-build-artwork` may need
reconciliation; do not delete it or import it automatically. Private backups/captures remain ignored.

Device caches, completed device downloads and server library originals are separate. Removing a
device copy must not delete server originals. Missing paths or space should produce recoverable
errors. Cleanup only verified disposable files and respect active reader/job ownership.

## Planned Alpha delivery

Build a versioned server container and Linux AppImage, connect them on the home network, and
provide documented persistent mounts/HTTPS trust/owner setup. No website belongs to the delivered
product. Exact host hardware and library adapter are unresolved. Rootless Quadlets, service boot
ordering and certificate/setup mechanics will be chosen and verified during implementation.

Alpha upgrades should be explicit and guided. Mature stable update notifications, container
registry delivery and AppImage update metadata come with release tooling. Automatic scheduled
updates remain future scope until compatibility/recovery are dependable. Database migrations
remain explicit; restarting a service never implicitly migrates/seeds/imports/cleans the catalog.

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
