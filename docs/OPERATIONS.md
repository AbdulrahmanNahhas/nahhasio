# Operations

Current implementation: rootless Podman server/PostgreSQL, signed server releases, Flatpak client,
coordinated backup/restore and app maintenance controls. Installed Fedora/transfer/update acceptance
is pending. [DEPLOYMENT](DEPLOYMENT.md) owns the sequence; exact commands belong to the
[server installer](../packaging/server/README.md), [maintenance tools](../packaging/operations/README.md)
and [Flatpak guide](../packaging/flatpak/README.md).

The family PC inventory supplied on 2026-10-25 is Fedora Silverblue 44, Podman 5.8.9, Python 3.14.8,
x86_64 Dell OptiPlex 3070, with approximately 100 GB free on the shared `/var`/`/var/home` filesystem.
SSH connectivity and user lingering were confirmed by Aqua. Nahhasio installation, catalog transfer
and reboot acceptance have not occurred. Recheck capacity immediately before transfer.

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

Daily backups retain seven daily copies plus protected recovery checkpoints. Restore stages a
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
