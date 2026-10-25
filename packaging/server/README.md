# Rootless Fedora Atomic installation

This bundle installs the catalog server and PostgreSQL only. The Linux AppImage runs as a
normal desktop application on the TV PC or another LAN machine. There is no website, Jellyfin
service, video scanner or server torrent worker in this release. Installation does not need
Nix, Cargo, Node or the source checkout once the release installer/operations artifacts exist.

Implementation is ready for installation acceptance; no Fedora installation is claimed by the
source/static checks. Do not run installation commands against the laptop's development database.

## Service ownership and host prerequisites

Use a dedicated unprivileged account, for example `nahhasio`, with a persistent home directory,
subordinate UID/GID allocation, Podman with Quadlet/cgroup v2, Python 3 and OpenSSL. As the machine
administrator create that account if needed, then enable its user manager at boot:

```sh
sudo loginctl enable-linger nahhasio
```

Log into that account through a normal local/SSH session before using `systemctl --user`.
These instructions deliberately do not change users, sudo rules, firewall or host packages on
your behalf. Containers and maintenance run rootless, without a Podman socket mounted into the
API. Keep this account separate from the desktop account when possible.

Reserve a stable LAN hostname/address. Allow TCP 8443 only on the trusted home-network firewall
zone/interface; PostgreSQL publishes no host port. No router forwarding or public DNS is needed.
The same hostname can be used by the client on the family PC and by clients elsewhere on the LAN.

## Build/release artifacts

The image includes the Rust server and `nahhasio` operator CLI, their embedded single migration
history, contracts and account avatar assets. Build from the repository root:

```sh
podman build -f packaging/server/Containerfile -t localhost/nahhasio-server:0.1.0 .
```

Release CI should pass digest-qualified `RUST_IMAGE` and `RUNTIME_IMAGE` build arguments and
record those inputs. The local defaults are build conveniences, not pinned release provenance.
The final runtime contains no source checkout/Node toolchain. The installation accepts only
fully qualified digest references, for example `registry.example/repository@sha256:<digest>`.
Use release metadata for the server digest/schema digest and a resolved PostgreSQL 17 image
digest; do not invent those values. PostgreSQL major upgrades are separate maintenance work.

Distribute `packaging/server/install.py`, the `packaging/operations` worker and release public key
with the release. `bin/nahhasio-server-install` is the source-checkout convenience wrapper.

## Prepare an installation

Run these as the service account. Replace the uppercase placeholders with verified release
values. `--release-key` receives only the publisher's public verification key.

```sh
python3 install.py prepare \
  --server-image SERVER_IMAGE_WITH_DIGEST \
  --postgres-image POSTGRES_17_IMAGE_WITH_DIGEST \
  --schema-version SCHEMA_DIGEST \
  --version RELEASE_VERSION \
  --release-key ./release-key.pem \
  --manifest-url HTTPS_RELEASE_MANIFEST_URL
python3 install.py certificates --hostname FAMILY_PC_HOSTNAME --ip FAMILY_PC_LAN_IP
python3 install.py reload
python3 install.py start-database
python3 install.py bootstrap
```

Preparation refuses existing installation metadata/Quadlets, symlinked roots, root execution and
unversioned images. It creates private mode-0700 roots and mode-0600 secrets. It does not start
services, migrate, create application users or seed data. `bootstrap` is a separate, explicit
operation for an empty container database and refuses existing roles. It creates:

| Role               | Responsibility                                                                  |
| ------------------ | ------------------------------------------------------------------------------- |
| `postgres`         | Container-local bootstrap and backup/restore administration                     |
| `nahhasio_owner`   | Non-superuser database/schema owner and explicit migrations                     |
| `nahhasio_runtime` | Existing-table DML and read-only migration ledger; no ownership/schema creation |

The database is `nahhasio`; runtime/owner passwords never appear in command arguments. Operator
commands obtain credentials from a private environment file. No demo accounts/passwords are
installed. Existing account credentials arrive through the reviewed catalog restore.

## Data transfer and explicit schema maintenance

For this existing family catalog, follow the operations transfer/restore procedure; preserve
the current database identities, credentials, migration ledger, artwork paths and tracking.
Do not apply an empty baseline over a populated restore. Keep the original laptop dataset
as a recovery checkpoint until the family installation is accepted.

The source checkout does not need to be an installed server to export a recovery bundle. Pause
its API and all other catalog/artwork writers while keeping the explicitly selected PostgreSQL
instance available. Run from the repository root inside its development shell:

```sh
export DATABASE_URL='postgresql://127.0.0.1:23102/arcadia'
task_schema="$(python3 packaging/release/manifest.py --fingerprint)"
python3 packaging/server/transfer.py export \
  --artwork-root "$PWD/data/media" \
  --private-config-root "$PWD/data/server-config" \
  --output-root "$PWD/data/backups/server-transfer" \
  --schema-root "$PWD/packages/database/drizzle" \
  --schema-version "$task_schema" \
  --version 0.1.0 \
  --source-quiesced
```

Those paths are the current source-development defaults; select actual configured roots if they
differ. The artwork argument is the public root containing `uploads/`, not the uploads directory
itself. `DATABASE_URL` is explicit and stays in the child environment rather than command arguments.
The exporter reads PostgreSQL through read-only sessions, includes all public tables/account state
and the migration ledger, and copies artwork/provider files without modifying the source. It compares
the actual applied migration hashes/order with the selected canonical source history and refuses
pending, unknown or altered history. It also verifies each registered artwork file against its
database path, byte size and SHA-256 before exporting; missing files require explicit reconciliation.
Keep
writers paused until the final export finishes; a consistent database dump alone cannot coordinate
concurrent filesystem changes. Source and target must use the same schema fingerprint.

Copy the completed directory identified by the printed `backupId` to a private incoming directory
owned by the family service account. Its files contain credentials and private catalog information;
retain directory mode 0700 and file mode 0600. Distribute `transfer.py` with the server tools and
install the host worker before importing. With the worker stopped and the target database freshly
bootstrapped, first verify the bundle, then confirm the exact ID:

```sh
python3 install.py maintenance-install
python3 transfer.py import --source /ABSOLUTE/PRIVATE/INCOMING/BACKUP_ID
python3 transfer.py import --source /ABSOLUTE/PRIVATE/INCOMING/BACKUP_ID \
  --initial --write --confirm BACKUP_ID
```

Initial import is a local operator action only. It refuses a nonempty target public schema or an
active API. It verifies the complete transfer checksums, restores into a staged database as the
new host's migration owner, verifies all public-table counts and the original server identity,
restores artwork/provider data, and grants the new runtime role before activation. Machine database
passwords and certificate trust remain those of the new host. A failed activation restores the
previous empty target and leaves it inactive. The source laptop data is never deleted or changed.
For later populated-target restoration, use the app's confirmed restore workflow or the operations
CLI; omit `--initial` only when deliberately replacing the current catalog with its recovery point.

For a genuinely fresh disposable installation, migration is explicit:

```sh
python3 install.py operator migrate apply --dry-run
python3 install.py operator migrate apply --write
python3 install.py grants
```

After restoring a catalog, run `grants` to grant the runtime role access to restored tables,
then inspect migration status with `operator migrate status --json`. Startup never migrates.
A fresh schema alone does not create a family owner account or server identity. This installation
targets moving the existing catalog; do not advertise a general fresh-owner onboarding flow.
The API readiness probe remains unavailable until the migration ledger and server identity exist.

## TLS enrollment, activation and maintenance

Certificate generation creates a private home CA and a one-year server certificate covering
the specified hostname/IP, `localhost` and `127.0.0.1`. CA signing material is host-only under
`~/.config/nahhasio-server/authority`; the API mounts only the server key/certificate and public
CA under `tls`. Export only `tls/ca.crt` and verify its printed SHA-256 fingerprint through a
trusted local/SSH channel when enrolling clients. Normal chain, hostname and validity checks
stay enabled. Renew the leaf certificate before expiry while retaining the trusted CA; do not
replace the CA silently. TLS is mandatory for non-loopback listeners; loopback HTTP remains
available for source development only.

Once the restored catalog and grants are ready:

```sh
python3 install.py start
python3 install.py status
python3 install.py maintenance-install
```

`Notify=healthy` waits for actual readiness, and failed health checks restart the application.
Services are wanted by the user manager's default target. The server runs with a read-only image,
no capabilities, no new privileges and a bounded temporary directory. App data is writable only
through the configured mounts. Maintenance timers are installed separately; inspect the operations
guide for activation, retention, update verification and restore recovery.

| Persistent location                           | Content                                   |
| --------------------------------------------- | ----------------------------------------- |
| `~/.local/share/nahhasio-server/artwork`      | Artwork root, with `uploads` beneath it   |
| `~/.local/share/nahhasio-server/backups`      | Local recovery bundles                    |
| `~/.local/share/nahhasio-server/operations`   | Narrow API/host operation inbox/status    |
| `~/.local/share/nahhasio-server/tools`        | Installed operator/maintenance tools      |
| `~/.config/nahhasio-server/private`           | Server-owned provider configuration       |
| `~/.config/nahhasio-server/tls`               | Public CA and private server TLS material |
| `~/.config/nahhasio-server/authority`         | Host-only CA signing material             |
| `~/.config/nahhasio-server/installation.json` | Host installation/release metadata        |
| `~/.config/containers/systemd/nahhasio*`      | Rootless Quadlets                         |
| `nahhasio-postgres-data` Podman volume        | PostgreSQL 17 storage                     |

Removing/replacing application images or Quadlet definitions does not delete the persistent roots
or database volume. PostgreSQL backups use database tools through the private container, not
copies of a running `PGDATA` directory. Local same-disk backups do not survive disk loss.
