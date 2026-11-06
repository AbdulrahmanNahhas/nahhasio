# Operations

Current implementation: rootless Podman server/PostgreSQL, signed server releases, Flatpak client,
coordinated backup/restore and app maintenance controls. The Fedora family server is installed;
version 0.1.3 is the recorded installed version; live HTTPS/admin access, rootless services, active backup/update timers and a verified
coordinated backup were inspected on 2026-10-30. Restore/reboot and failure-recovery acceptance
remain separate. [FAMILY-SERVER](FAMILY-SERVER.md) records the actual layout and agent access;
[DEPLOYMENT](DEPLOYMENT.md) owns the sequence; exact commands belong to the
[server installer](../packaging/server/README.md), [maintenance tools](../packaging/operations/README.md)
and [Flatpak guide](../packaging/flatpak/README.md).

The family PC inventory verified on 2026-10-30 is Fedora Silverblue 44, Podman 5.8.9, Python 3.14.8,
x86_64 Dell OptiPlex 3070 with an i5-9500T and approximately 16 GB RAM. About 93 GiB was available
on the persistent Btrfs home filesystem. SSH and user lingering were verified. Installation and
catalog transfer have occurred; reboot acceptance was not tested in this inspection. Host tools
must use the selected `--config-root "$HOME/Nahhasio/config"`, not the generic default path.

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
filesystem roots. Podman mounts account for service ownership, read/write needs and
Fedora SELinux labels. Never treat all data/ directories as disposable caches.

`data/nahhasio.db` is a retained SQLite recovery candidate. Recovery tooling requires an explicit
`ARCADIA_V1_DB_PATH` and absolute `ARCADIA_V1_ARTWORK_ROOT`. Old artwork recovered under `data/recovery/legacy-build-artwork` may need
reconciliation; do not delete it or import it automatically. Private backups/captures remain ignored.

Device caches, completed device downloads and server library originals are separate. Removing a
device copy must not delete server originals. Missing paths or space should produce recoverable
errors. Cleanup only verified disposable files and respect active reader/job ownership.

## Backup, migration and recovery

Before cutover or destructive maintenance: take a coordinated PostgreSQL/artwork/private-config
backup, verify checksums, restore separately, and compare identities/content/constraints and artwork.
Retain Shadow's original catalog until the family installation is verified. Local server backups
satisfy the initial app workflow; same-disk copies do not cover disk failure.

Daily backups default to seven daily copies plus protected recovery checkpoints; the new worker
allows 1–30 daily copies and schedule activation through fixed admin operations. The existing
server needs the one-time signed host-tool/media bootstrap before new operations become available. Restore stages a
separate database/artwork/config set, backs up the current state, validates, then switches while the
application is stopped. Host credentials/TLS recovery is separate from normal app restoration.
See the [maintenance guide](../packaging/operations/README.md) for journal and recovery commands.

The [baseline](BASELINE.md) plus future additive migrations is the sole schema history. Startup
never migrates or seeds. An application image rollback cannot undo a schema migration or safely
restore an old catalog over newer edits. Keep matching source history for old recovery archives.
Retained TVDB recovery identifiers are not an active provider integration; their original recovery
checkpoint is `data/backups/tvdb-removal-20261008`. Git retains the old rehearsal instructions.

## Updates and administration

Server maintenance verifies signed artifacts, API/schema and host-tool compatibility, taking a
backup before coordinated server-image/tool activation. Versioned tools use an atomic selector
and retain previous files for rollback. The worker reloads after completing its update job. Schema-changing releases require explicit maintenance. PostgreSQL
major upgrades have separate ownership. Client updates are managed by Flatpak/Software and the
host's policy; the app reports its running version without claiming automatic updates are enabled.

The app queues fixed authenticated maintenance requests. It has no Podman socket or arbitrary host
command interface. Recovery tools remain usable if the API cannot start. Full installation and
failed-update/restore behavior must be accepted on isolated data before production activation.

Routine remote catalog editing will use a future local HTTPS CLI with server address/API key,
scoped permissions, revocation and audits. It is deferred. Current `operator` tooling is trusted
host maintenance with direct database credentials; never expose those credentials or PostgreSQL
as a substitute for the future API.

## Private provider configuration

Set `NAHHASIO_CONFIG_ROOT` to a dedicated absolute persistent directory owned by the service user.
The directory must be private (0700); credential files must be private (0600). Do not mount the
configuration beneath artwork/public content or put it into an image, repository or Flatpak.
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
LAN clients require the installer-provisioned trusted HTTPS listener.
The private provider document is format version 1; unversioned existing files remain compatible,
and a newer unsupported version is refused instead of overwritten. Preserve it with configuration backups.

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
read format 2; keep a protected state backup before a deliberate downgrade. The server installer provisions HTTPS certificates; verify the installed listener before family LAN acceptance.

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

## PostgreSQL query execution

The application pool disables JIT for bounded catalog queries. On the first Fedora 0.1.0 install,
LLVM query compilation caused approximately 30-second Browse requests/Home errors; disabling JIT
for the runtime role and reconnecting resolved them. Shadow's PostgreSQL has no JIT provider, so
local timing alone did not expose the problem. Keep the existing request timeout rather than
masking this with longer waits. Restore refreshes planner statistics on the staged database before
activation. Neither setting changes catalog rows or migration history.

## Installed host-tool upgrades

Follow [RELEASE-0.1.1](RELEASE-0.1.1.md) for the one-time 0.1.0 worker bootstrap. Thereafter the
same verified server update carries host tools; no routine SSH/file copying is needed. The
`~/Nahhasio/releases` folder is only an installer cache, independent of installed tools/backups.

## Managed media checkpoint (source, not installed acceptance)

Jellyfin is retired. Explicit `install.py media-prepare --root ~/Nahhasio --worker-image <installed-digest>`
prepares videos, incoming imports, staging, trash and media-operation journals.
The worker mounts `videos/` once. Hidden `.incoming`, `.staging` and `.trash` directories live
inside that filesystem; `imports/incoming`, `downloads/uploads`, `downloads/jobs` and `trash`
are reviewed directory aliases to those targets. This avoids cross-bind-mount copies without
exposing the installation configuration or private backups to the worker. Existing nonempty
roots are rejected for explicit reconciliation; setup never silently relocates their contents. Run it with the
installation's explicit `--config-root`. It does not start services or import/mutate the catalog.
The worker uses the same verified image as the API, with only runtime database credentials.
FFmpeg, yt-dlp, its EJS package and Deno are packaged tools, not host installations. Release
builds must supply a digest-qualified DENO_IMAGE alongside the existing image inputs.

The API receives read-only videos and writable incoming-upload storage. The separate rootless
worker receives managed videos/incoming/trash/journals, with no owner credentials, provider
settings, signing authority or Podman socket. Shared mounts retain SELinux `:z` labeling.

Container roots are `NAHHASIO_LIBRARY_ROOT`, `NAHHASIO_IMPORT_ROOT`, `NAHHASIO_TRASH_ROOT` and
`NAHHASIO_MEDIA_OPERATIONS_ROOT`. All are absolute and explicitly configured. They do not reuse
artwork roots or change the independent client `NAHHASIO_VIDEO_ROOT`.

The database worker uses existing durable job records and a separate advisory singleton lock.
Acquisition concurrency is two; heavy probing is serialized. Imported files are checked before
publication, with atomic synced journals and verified copy/restore recovery. Directory browsing
selects incoming or unregistered series/movie files and paginates in filename order. Traversal,
symlink escapes, hidden/macOS companion files and empty videos are rejected. Readable directory
names retain UUID identity; title edits do not rename an existing managed folder. Server imports preserve a 5 GiB reserve; staging/capacity failures remain visible.
Future admin deletion expires after seven days. Existing video backups are never implicitly
created or pruned as disposable media cache.

Maintenance stops the media worker alongside the API during coordinated operations. The worker
shares the server's signed release-image override, so update/rollback must restart both services.
Media-enabled backups include import journals and registered file identities/hashes, **not video
bytes**. Backups preserve the prior API/worker activity states, including a worker running while
the API is stopped. Restoring preserves physical videos and newer journals; restored availability
becomes unknown and pending media jobs require review before retry. Large video copies require a separately
chosen backup destination/process. Daily catalog/artwork backup frequency is unchanged.

## Weekly USB recovery set and sudden shutdown

Use **Server maintenance → Backups** to create a manual copy and wait for a succeeded result.
A directory still named `.pending-*` is not a backup. Copy the complete selected directory from
`~/Nahhasio/data/backups/<backup-id>/`, preserving every file and `manifest.json`. Its database dump
contains catalog, accounts, device registrations, tracking, artwork references, library roots, import
records and the canonical migration ledger. Its archives contain registered artwork, provider
configuration and protected host recovery material. Managed installations also include media
journals and a video inventory. Check the copied files against the manifest hashes before relying
on the USB copy. Keep the corresponding signed application/installer release or its exact version.

Also copy these separately:

| Path                                              | Recovery purpose                                                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `~/Nahhasio/videos/`                              | Original videos and local subtitle companions; excluded from routine backups.                                                          |
| `~/Nahhasio/config/`                              | Current installation, private provider settings, DB credentials, TLS trust/authority and release public key. Treat the USB as private. |
| `~/Nahhasio/data/media-operations/`               | The latest import/trash recovery receipts; the backup already includes its capture-time snapshot.                                      |
| `~/Nahhasio/downloads/` and `~/Nahhasio/imports/` | Needed only to retain current unfinished uploads/acquisitions or unmatched incoming files. Pause jobs before copying.                  |
| `~/Nahhasio/trash/`                               | Optional: preserves the ability to restore videos still within their seven-day retention.                                              |

For a coherent weekly media copy, pause/cancel active acquisitions and avoid video imports/deletions
while copying. A simple MP4 copy is sufficient for completed videos, but it is not a database backup.
Do not copy the live PostgreSQL volume as a substitute for `database.dump`. Missing partial staging
can be retried; missing originals cannot be reconstructed from catalog metadata. Keep at least one
older verified USB recovery set rather than replacing the only independent copy mid-transfer.

A replacement machine needs the supported rootless prerequisites and matching signed release,
then explicit installation/transfer restore. Restore the verified bundle with its matching schema,
retain its stable server/catalog identities, restore videos under their configured roots, re-establish
private credentials/trust intentionally, and rescan/verify registered files. Normal same-machine
app restore keeps current TLS/role credentials; new-machine recovery uses the separate protected
host archive and documented transfer flow. Never activate a copied older job queue against newer
files: restored media jobs are marked for review, file availability becomes unknown until verified,
and journal recovery material is retained separately. Device downloads, local subtitles and saved
viewing packs belong to each client; back up that client's private state/video roots separately if
those local copies must survive its loss.

PostgreSQL uses WAL and transactional migrations. Uploads persist acknowledged offsets; publication
uses verified staging and durable filesystem/database journals. Restart reconciles expired worker
leases and interrupted transitions, and never publishes a partial file as a finished video. Schema
upgrades retain a previous database and journal the switch; ordinary restore interruptions remain
blocked for explicit operator recovery. A failed/unknown outcome is not reported as success.

`bin/test-server-media` rehearses interrupted upload/import/subtitle/trash reconciliation;
`bin/test-server-recovery` rehearses actual restored-data migration, failed-readiness rollback,
interruptions between database renames, verified backup/restore and immediate PostgreSQL shutdown.
These disposable software checks do not simulate failed disks or guarantee writes against a storage
device that ignores flushes. They are not Fedora reboot or packaged-installation acceptance. A UPS
can reduce outages, but is not required for the application recovery protocol.
