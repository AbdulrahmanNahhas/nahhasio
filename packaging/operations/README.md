# Rootless maintenance

`operations.py` is a Python 3 standard-library host service. It owns fixed backup, restore and
server-update operations. The API shares only the private operation directory; it receives no
Podman socket, host command execution or database-owner password. The worker runs as the same
unprivileged account that owns the Quadlet installation.

This is implementation awaiting consolidated runtime acceptance. It has not backed up, restored,
updated or installed the family catalog. Use disposable data for the initial acceptance.

## Installation

The server installer writes `~/.config/nahhasio-server/installation.json`, copies this worker to
`~/.local/share/nahhasio-server/tools/operations.py`, and prepares its units. Explicit equivalents:

```sh
python3 packaging/operations/operations.py install-units
systemctl --user daemon-reload
systemctl --user enable --now nahhasio-maintenance.service nahhasio-backup.timer
```

The worker needs Python 3, Podman, systemd user services and OpenSSL. PostgreSQL utilities execute
inside `nahhasio-postgres`. The server image must supply a real HTTPS readiness health check.
The host account needs lingering for operation after logout and across boots; the server installer
documents that administrator bootstrap step.

All data/control/config directories are private (`0700`), and generated documents are `0600`.
Host locks, claimed requests and recovery journals live separately in
`DATA/maintenance-private`, which is never mounted into the API container. Only inbox/status/job
documents belong to the shared operations directory.
`--config-root /absolute/path` selects another installation explicitly. Installation metadata keys:

```json
{
  "dataRoot": "/home/nahhasio/.local/share/nahhasio-server",
  "configRoot": "/home/nahhasio/.config/nahhasio-server",
  "database": "nahhasio",
  "databaseAdmin": "postgres",
  "databaseOwner": "nahhasio_owner",
  "databaseRuntime": "nahhasio_runtime",
  "databaseContainer": "nahhasio-postgres",
  "quadletRoot": "/home/nahhasio/.config/containers/systemd",
  "version": "0.1.0",
  "schemaVersion": "<64 hexadecimal characters from the release schema fingerprint>",
  "serverImage": "ghcr.io/example/nahhasio-server@sha256:<64 hexadecimal characters>",
  "serverRepository": "ghcr.io/example/nahhasio-server",
  "releaseManifestUrl": "https://github.com/example/nahhasio/releases/download/nahhasio-alpha/manifest.json"
}
```

These are illustrative locations/references. The installer records the selected values. It never
includes credential values in metadata. Do not put PostgreSQL passwords into job requests.

## Backups

The daily timer queues a backup around 04:00 local host time, with a randomized delay. A single
worker lock serializes all operations. It briefly stops the API to keep the PostgreSQL dump,
artwork and provider configuration coherent, then restores the previous running state.

A completed backup directory contains:

- `database.dump`: custom-format dump, including account/catalog/tracking data and the migration
  ledger; ownership/grants are provisioned explicitly when restoring.
- `artwork.tar.gz`: the configured server artwork tree, preserving relative file paths and bytes.
- `configuration.tar.gz`: private provider settings.
- `host-recovery.tar.gz`: fixed host TLS/credential/environment files, for operator machine recovery.
- `installation.json`: selected host layout, application version and image reference.
- `manifest.json`: SHA-256 hashes, byte size, schema/application version, server identity and every
  public-table row count.

Temporary backups are hidden and never listed as usable backups. Failed backups are removed.
Every registered artwork record is checked in bounded pages against a contained regular file,
its recorded size and SHA-256 before publication. Missing, altered or symlinked originals fail
the backup; an archive checksum alone does not certify recoverable artwork.
The worker checks available space before capture. It keeps seven successful daily backups and
the two newest checkpoints for each of `before-update` and `before-restore`. Manual backups remain
until deliberately removed by the operator. No automatic artwork or video purge is performed.

```sh
python3 ~/.local/share/nahhasio-server/tools/operations.py enqueue backup
python3 ~/.local/share/nahhasio-server/tools/operations.py status
journalctl --user -u nahhasio-maintenance.service
```

Backups stay on the server PC, unencrypted and protected by filesystem permissions. They protect
against a failed change or accidental deletion; losing the same storage device also loses these
backups. Copy a completed backup directory to another device when an independent copy is wanted.
Video downloads and client caches are outside this backup scope.

## Restore and transfer

Only a completed backup ID is accepted; the API cannot supply a filesystem path or command.
Restore requires the exact ID as confirmation. The worker checks checksums and schema compatibility,
restores into a separate database and directories, checks all public-table counts and the stable
server identity, verifies restored artwork against its database paths/sizes/hashes, and provisions
restricted runtime grants before any switch.

It then stops the API, captures a new `before-restore` backup and switches database/artwork/provider
roots. The previous database and trees remain under unique recovery names. Failed activation rolls
back to them. The durable journal records interrupted switching; the worker does not replay an
interrupted restore or report unknown outcomes as success. Maintenance remains blocked until the
operator resolves that state.

```sh
python3 ~/.local/share/nahhasio-server/tools/operations.py enqueue restore \
  --backup-id 20261025T120000Z-a1b2c3d4 --confirm 20261025T120000Z-a1b2c3d4
```

Normal app restore retains current host TLS trust and PostgreSQL-role passwords. Replaying old
host credentials could otherwise break the current installation. The protected host-recovery
archive is available separately to the operator when rebuilding the machine. Restoring older
application data replaces newer accounts, history and catalog changes from the selected point;
the UI must clearly present that consequence before queuing the job.

For laptop-to-family-PC transfer, copy a completed backup directory into the family service
account's backup root, retain private ownership/modes, install the matching schema version and
queue the selected restore. Keep the original source database/artwork intact until the restored
catalog has been checked. Reconfigure or rotate machine credentials explicitly rather than
blindly overwriting the new host's configuration. This worker does not delete or shrink the
development laptop's database.

Local recovery if the API is down:

```sh
systemctl --user stop nahhasio-maintenance.service
python3 ~/.local/share/nahhasio-server/tools/operations.py recover-interrupted-restore
systemctl --user start nahhasio-maintenance.service
```

To run a fixed operation synchronously while the worker is stopped, substitute `run backup` or
`run restore --backup-id ID --confirm ID`. The same exclusive lock and checks apply. Preserve the
journal and retained directories when diagnosing an interruption; do not delete them as a reset.
Previous databases/trees are retained for deliberate operator cleanup, not automatically pruned.
After fully verifying the selected restore target, the normal restore path can repair missing or
corrupt current artwork. In that case its internal pre-restore capture preserves the current
database, existing regular artwork and configuration as host-only manual recovery material, marked
`recoveryOnly: true` and `integrity: damaged`. It is hidden from the app's backup inventory and is
rejected as a normal restore target. These salvage captures remain for deliberate operator cleanup;
they are never claimed as verified backups. Ordinary scheduled/manual backups still fail on any
registered artwork mismatch, and all archives still refuse symlinks/special files. No network flag
allows callers to request damaged-state capture independently.

## Verified server updates

Install the independently trusted Ed25519 public key as
`~/.config/nahhasio-server/release-key.pem`. It is never downloaded from the release being checked.
The signed raw manifest and its base64 detached `.sig` file follow the shared release format.
OpenSSL verifies the signature before any image reference is used. The image must match the
configured repository and include an exact SHA-256 digest. Downloads retain HTTPS verification;
GitHub redirects are limited to its release asset hosts.

```sh
python3 ~/.local/share/nahhasio-server/tools/operations.py enqueue check-update
python3 ~/.local/share/nahhasio-server/tools/operations.py enqueue update
# Enable only after the trusted key and actual signed release channel are installed:
systemctl --user enable --now nahhasio-update.timer
```

The update timer queues compatible application updates around 05:00. A different schema fingerprint
reports `maintenance-required` and performs no update or implicit migration. PostgreSQL image/major
version upgrades are separate. Compatible updates pull the signed digest, create a recovery backup,
write the image override, reload the Quadlet and await the HTTPS health check. Failed activation
restores the previous override/image. A journal handles interruption before metadata commit.
Image rollback never pretends to reverse a database migration.

## App bridge

The API shares `DATA/operations` as `NAHHASIO_OPERATIONS_ROOT`. It validates and reauthorizes
administrator requests, writes atomic `inbox/<UUID>.json`, and reads `status.json`/`jobs/<UUID>.json`.
The worker only accepts version-1 requests with known fields and canonical UUIDs:

```json
{
  "version": 1,
  "id": "4e56bceb-1a9a-4f02-99c8-50a83c04017e",
  "operation": "restore",
  "requestedAt": "2026-10-25T12:00:00Z",
  "actorAccountId": "0e696f20-3bc5-49d0-a9e4-1bbf6f26fd5f",
  "backupId": "20261025T120000Z-a1b2c3d4",
  "confirmation": "20261025T120000Z-a1b2c3d4"
}
```

Operations are `backup`, `restore`, `check-update`, `update`. Restore parameters may be omitted or
null for other operations. Public status includes only backup IDs/dates/sizes/versions, update
status and job stages/results. It never returns credential values, raw subprocess stderr or host
filesystem paths. Jobs survive API shutdown; a reconnect reads their result. No generic shell,
upload/extraction or service-management endpoint is exposed.

## Coordinated host-tool delivery (0.1.1 onward)

The signed release manifest binds a size-limited installer archive. Updates verify its hash and
version/API, stage Python tools with integrity receipts, and check candidate startup before
activation. `data/tools/versions/<version>` holds immutable files; stable entry links follow the
atomic `current` selector. Image, tool selection and installation metadata share the recovery
journal. Failed activation restores the old selection/image; a successful worker re-execs only
after its finished job and claim removal are durable. Configuration, TLS and Quadlets remain intact.

The original 0.1.0 worker needs one verified bootstrap upgrade. Follow
[RELEASE-0.1.1](../../docs/RELEASE-0.1.1.md); subsequent compatible updates carry their own host tools.
Client updates remain owned by Flatpak/Software, not this worker. Release-download folders can
be removed after bootstrap acceptance; installed tool versions and recovery backups are separate.
