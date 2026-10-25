# Operations and deployment boundary

The current 2026-10-25 implementation and delivery sequence is [DEPLOYMENT.md](DEPLOYMENT.md).
Rootless installer, host maintenance worker and managed client updater now have implementation
sources under `packaging/`; installed Fedora/transfer/update acceptance remains deferred.
Jellyfin/files-only video playback is outside this release. Older readiness statements below
record earlier checkpoints; use the new guide for current installation commands and boundaries.

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

Session credentials remain native. Provider keys entered in the administration form are transient
and pass through the native gateway; they are never returned or stored by the UI. Keep secrets out
of committed files and do not print connection strings, hashes or tokens. Do not reuse demo accounts/passwords as production setup.

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

## Private provider configuration

Set `NAHHASIO_CONFIG_ROOT` to a dedicated absolute persistent directory owned by the service user.
The directory must be private (0700); credential files must be private (0600). Do not mount the
configuration beneath artwork/public content or put it into an image, repository or AppImage.
The server creates a missing final directory on an authorized dashboard write; its parent must
already exist. Devenv uses the ignored persistent `data/server-config` directory. Restart an existing
server once after adding/changing this environment path; subsequent key updates need no restart.

Desktop Settings can replace TMDB/Fanart keys, explicitly disable a provider, or restore the existing
`TMDB_API_READ_ACCESS_KEY` / `FANART_API_KEY` environment selection. Stored overrides take precedence;
disabling suppresses environment fallback. No configured key value or fragment is returned. Keys
are plaintext in the private server file, protected by service-user filesystem permissions; include
`providers.json` in a separate protected configuration backup. Never include it in public diagnostics.
A replacement records its revision and changing account UUID atomically with its values. The database
rename audit does not substitute for backing up this private configuration.

For recovery, stop the server, restore the complete configuration file to the same root with its
private permissions/ownership, then restart and inspect masked status. Retain the prior file privately
until provider operations are verified. Restoring this file does not change catalog/account identities.
Readiness checks migration history and server identity without applying changes. Persistent artwork
access, restricted database roles, HTTPS and recovery/update activation still require deployment checks.

Overview's new deployment checks report privileged-role flags and explicit readable artwork/config
selection without changing anything. They do not certify write grants, free space, file health or SELinux.
Use the 2026-10-21 gate table in PREDEPLOYMENT-REVIEW for the Podman implementation. In particular,
LAN clients require trusted HTTPS; the existing plain-HTTP server listener alone is insufficient.
The private provider document is format version 1; unversioned existing files remain compatible,
and a newer unsupported version is refused instead of overwritten. Preserve it with configuration backups.

## Local readiness checkpoint — 2026-10-22

The selected family target is Fedora Silverblue 44 with approximately 300 GB available for now.
This is Aqua's supplied inventory, not a disk/OS inspection. SSH installation comes later. Initial
recovery covers PostgreSQL, artwork and private configuration; video storage is outside this pass.
See [PREDEPLOYMENT-REVIEW](PREDEPLOYMENT-REVIEW.md#local-application-follow-up--2026-10-22).

### Home-server certificate trust

The desktop connection form now accepts one public root certificate in PEM format and its SHA-256
fingerprint. Obtain both from the server itself or a separately trusted SSH connection. For an
exported public root certificate, the operator can read its fingerprint with:

```sh
openssl x509 -in root.crt -noout -fingerprint -sha256
```

Paste only the hexadecimal fingerprint (colons/spaces are accepted) into the fingerprint field.
Never distribute the CA's private key. A fingerprint obtained only from the same unverified network
connection does not authenticate the server.

The native transport checks the fingerprint before attempting HTTPS, retains normal TLS chain,
hostname and validity checks, and refuses redirects. Trust applies only to the saved origin (scheme,
host and port); provider/torrent transports and system certificate trust are unchanged. An untrusted
LAN HTTP address remains rejected. Testing a connection does not persist trust. Selecting it saves
trust only after the server information and readiness probes succeed, without sending credentials.

Saved connection format 2 contains the public CA and normalized fingerprint; existing format 1 files
remain readable. Storage is private (0600) and atomic. The UI receives the fingerprint rather than the
certificate. Changing an existing origin's CA requires switching to another connection, removing the
old connection (which clears its saved session), then adding it again. Older client binaries cannot
read format 2; keep a protected state backup before a deliberate downgrade. This checkpoint does
not provision certificates or change the server's current HTTP listener: the installation must supply
HTTPS before family LAN acceptance.

### Shared preliminary preflight

With explicit database selection and the intended service's artwork/config environment, run:

```sh
./bin/nahhasio preflight --json
```

Run it as the intended runtime database role, not the migration owner. It never writes files/data or
runs migrations. It returns exit status 1 if a check fails, with its report on stdout; command/database
errors remain on stderr. It checks migration compatibility, server identity, high database privileges
and inherited public/Drizzle schema or table ownership, explicit readable artwork roots, and an
existing private config directory separated from artwork (including resolved path aliases). Unknown
private provider formats fail their check. `--write` and `--dry-run` are rejected.

Overview uses the same role/storage checks. These checks do not prove complete DML grants, writable
mounts, SELinux access, disk capacity, TLS service configuration, artifact trust or recovery. Those
remain installation acceptance. Provider keys stay manageable through Settings; initial database
credentials, bind address and mount paths remain private installation/bootstrap configuration because
the service needs them before its dashboard can run.
