# Family-PC release and development

Updated 2026-10-25. This is the current four-phase delivery checkpoint. Aqua authorized coding
all four phases before consolidated installation testing. Player/provider testing, Jellyfin,
files-only video playback and the remaining catalog administration tools are outside this release.
The reviewed desktop design stays in place. No family-PC installation, transfer, release publication,
automatic-update activation or runtime acceptance has happened merely because this code exists.

## Deployment shape

The Fedora Atomic family PC owns the authoritative PostgreSQL catalog, artwork, provider settings
and local backups. It also runs the TV's Linux client. Shadow keeps the development checkout and
an independent small database/artwork dataset; its installed client can connect to the family PC.
There is no production source checkout, Node process or website. Only the application HTTPS port
is exposed on the home network. PostgreSQL stays on the private container network.

The four code phases are rootless installation, backup/transfer/development separation, verified
server/client updates, and app maintenance controls. The remaining administration features can
be developed and delivered after installation through the same release path.

## 1. Rootless installation

[Server installer](../packaging/server/README.md) documents the exact commands and prerequisites.
The installer runs as an unprivileged service account, prepares private persistent directories,
creates rootless Quadlets and generates trusted LAN HTTPS certificates. Initial account creation,
lingering and firewall setup are explicit administrator steps. Runtime services remain rootless.

| Location                                    | Ownership                                                          |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `~/.local/share/nahhasio-server/artwork`    | Artwork roots, including uploaded images                           |
| `~/.local/share/nahhasio-server/backups`    | Completed local backup sets                                        |
| `~/.local/share/nahhasio-server/operations` | Fixed app/host operation requests and public status                |
| `~/.config/nahhasio-server`                 | Host installation settings, credentials, provider settings and TLS |
| Podman volume `nahhasio-postgres-data`      | PostgreSQL 17 cluster                                              |
| `~/.config/containers/systemd`              | Rootless server/database Quadlets                                  |

`prepare` does not start services, migrate or seed. Database bootstrap, migration, grants,
certificate provisioning and activation are separate explicit commands. The runtime role owns
neither the application schema nor migration ledger; maintenance uses separate owner credentials.
The server refuses non-loopback plaintext HTTP. Development loopback HTTP remains supported.

Use a stable family-PC hostname and enroll its public CA/fingerprint through the existing native
connection screen. The same PC can connect through localhost; another client connects through
the LAN hostname. Certificates include localhost and explicitly supplied addresses. Distribute
only the public CA; the signing key stays outside the API's mounted TLS directory.

## 2. Backups, transfer and development

[Maintenance](../packaging/operations/README.md) owns the backup format, schedule, retention,
restore journal and local recovery commands. A completed backup contains a PostgreSQL custom
dump, artwork, private provider configuration, checksums and version/schema/identity evidence.
A protected host-recovery archive holds credentials/TLS separately from ordinary app restoration.
Normal app restore keeps the current installation credentials and certificate trust.

The default schedule is daily, retaining seven daily copies plus protected recent checkpoints
before update/restore. Backup stops the application during coordinated data/files capture. Restore
creates a current-state backup, prepares a separate database/artwork/configuration set, validates
it and switches while the application is stopped. Previous data is retained for recovery.

For initial cutover, keep Shadow's source unchanged, rehearse a full backup/restore, freeze
catalog changes for the final export and verify the target before making the family PC authoritative.
Preserve UUIDs, relationships, account credentials, editorial records, tracking, server identity,
artwork paths and the canonical migration ledger. Do not copy a running PostgreSQL data directory.
The original private laptop copy remains an independent recovery checkpoint through acceptance.

The exact read-only export and confirmed initial import commands are in the
[transfer procedure](../packaging/server/README.md#data-transfer-and-explicit-schema-maintenance).
The exporter verifies the applied migration ledger and every registered artwork size/hash before
capture. The receiver verifies the completed archive before a staged restore.

The small development dataset must have the full schema and a selected representative catalog/
artwork subset, separate test accounts and a new server identity. Never point development mutations
at the family server. A dev pack excludes production passwords, sessions, devices, provider keys
and personal tracking. Creating it does not replace the current local database automatically.

Local backups are intentionally sufficient for the initial app workflow. A server-disk backup
does not recover a failed disk; an optional independent copy can be added later.

## 3. Signed releases and updates

The release preparation workflow builds a Rust server image and x86_64 AppImage. It uses
`nahhasio-v<version>` tags, separate from the retired application's historical `v*` tags.
Versions must match the server, CLI, native client and UI package. Container base digests are
resolved and recorded at build time. Installed server/PostgreSQL references are digest-qualified.

The workflow needs the repository secret `NAHHASIO_RELEASE_SIGNING_KEY`, containing a private
Ed25519 PEM key. The public counterpart is repository variable `NAHHASIO_RELEASE_PUBLIC_KEY`.
Generate/store the private key outside the repository and retain its recovery copy:

```sh
umask 077
openssl genpkey -algorithm ED25519 -out release-private.pem
openssl pkey -in release-private.pem -pubout -out release-key.pem
```

Distribute and authenticate the public key independently before installation. A public key
downloaded beside an untrusted release does not establish publisher trust. No private signing
key, registry token, database credential or provider key belongs in a committed file.

`packaging/release/manifest.py` signs the exact manifest bytes. Format version 1 binds application
version, API version, migration-source fingerprint, server image digest and AppImage URL/size/hash.
The signature is detached base64 text in `manifest.json.sig`. The installation archive has a
separate detached signature. Verify it before extracting/running installation code:

```sh
base64 --decode nahhasio-install.tar.gz.sig > installer.sig
openssl pkeyutl -verify -pubin -inkey /trusted/release-key.pem -rawin \
  -in nahhasio-install.tar.gz -sigfile installer.sig
tar -xzf nahhasio-install.tar.gz
```

Preparation creates a draft prerelease, not a published release. Publishing an approved
`nahhasio-v*` release promotes its verified manifest to the `nahhasio-alpha` update channel.
The channel URL is
`https://github.com/AbdulrahmanNahhas/nahhasio/releases/download/nahhasio-alpha/manifest.json`.
Release assets must be accessible to installed clients; private registry access is provisioned
on the service account separately. A checksum alone is not the publisher signature.

Server updates run through the host maintenance worker. Only equal schema fingerprints and
supported API versions activate automatically, after backup and image verification. Failed
readiness restores the previous image. A schema-changing release is marked maintenance-required;
explicit operator maintenance must handle backup, migration, grants and compatible image activation.
PostgreSQL major upgrades remain separate. Application rollback cannot undo database migration.

[Client installation and updates](../packaging/linux/updates.md) uses a user-owned versioned
AppImage directory and stable launcher. Background checks stage signed updates; activation happens
on the next launch. The previous image is retained. Device sessions, caches, progress queues and
downloaded videos stay outside the installation directory. Development builds never self-update.

## 4. App controls and recovery

Administration → Maintenance → Backups shows completed sets and submits fixed backup/restore
requests. Restore requires typing the backup ID and creates a recovery checkpoint first.
Maintenance → Updates shows server release status and compatible installation controls.
Profile settings → Device also provides client update status/check/download for ordinary users.

The authenticated API revalidates/locks administrator sessions when it queues host operations.
The container shares a private operation directory with the host worker, never a Podman socket
or arbitrary host command interface. Jobs continue when the API stops and can be read again
after reconnect. Recovery journals and host credentials are outside the API's shared mount.
If the API cannot start, use the host maintenance command directly.

## Deferred consolidated acceptance

After implementation, use isolated data for installation, backup/restore equality, interrupted
operations, failed update recovery, permission boundaries and signed-artifact rejection. Then
verify Fedora mounts/SELinux, trusted LAN/local login, reboot persistence and installed AppImage
activation. These checks concern delivery/recovery; no player/provider test phase is required
for this release. No live cutover or remote release publication is implied by this checklist.
