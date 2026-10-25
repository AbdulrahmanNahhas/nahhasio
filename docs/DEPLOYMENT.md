# Family-PC release and development

Updated 2026-10-25. This is the current four-phase delivery checkpoint. Aqua authorized coding
all four phases before consolidated installation testing. Player/provider testing, Jellyfin,
files-only video playback and the remaining catalog administration tools are outside this release.
The reviewed desktop design stays in place. No family-PC installation, transfer, release publication,
automatic-update activation or runtime acceptance has happened merely because this code exists.

## Release preparation status

[Run 40210314390](https://github.com/AbdulrahmanNahhas/nahhasio/actions/runs/40210314390) passed
for commit `e536d4776348766939382e9082df7289872a2c06`: server image, offline client sources,
complete GNOME SDK client compilation, signing and draft creation for 0.1.0. The draft's manifest
and installer signatures were independently verified against the retained trusted public key;
the downloaded client bundle matches its signed size/hash. Anonymous manifest access to the
exact server-image digest also succeeded, so installation does not require private registry login. This does not establish runtime
installation, repository publication, reboot behavior or backup/update recovery.

Push CI on the same commit failed because Ubuntu packaged libtorrent 2.0.10 while the bridge
requires 2.0.12. The local workflow correction uses the release manifest's verified source and
independent interface/backend/native jobs; its hosted result must be checked after push.

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

The server remains a digest-qualified Rust OCI image; the client is now Flatpak. Nix/devenv is
only for local development. The supported Flatpak build and publication procedure is in
[packaging/flatpak/README.md](../packaging/flatpak/README.md). It supersedes the AppImage prototype
and custom client downloader. The existing Ed25519 server signing key remains valid.

The release workflow builds the UI conventionally with Node/pnpm, prepares verified offline
sources and compiles the native client in the pinned GNOME SDK builder. Cached dependency
modules reduce repeated compilation. The SDK is deliberately independent from Fedora's host
libraries, so the same client can be installed on Fedora Atomic and other Flatpak hosts.

The existing `NAHHASIO_RELEASE_SIGNING_KEY` secret and `NAHHASIO_RELEASE_PUBLIC_KEY` variable
sign/verify the release manifest and installer archive. Flatpak additionally needs the dedicated
`NAHHASIO_FLATPAK_GPG_KEY` secret and full `NAHHASIO_FLATPAK_GPG_FINGERPRINT` variable for OpenPGP
commit/summary signatures. The release preflight refuses missing configuration before expensive
builds. Private signing keys remain outside Git and are never included in artifacts.

Preparation produces a draft release. Approved publication verifies its signed repository
archive, retains previous objects on the `flatpak-repository` branch and deploys a static package
feed using GitHub Pages (Actions source). There is no shipped Nahhasio website/runtime. The
server alpha manifest is promoted only after package-feed deployment succeeds. Initial client
trust can be bootstrapped through the existing independently trusted Ed25519 key; the manifest
binds the Flatpak public key, repository URL and artifact hashes.

Server updates still use the host maintenance worker, with exact schema/API compatibility,
backup before replacement and readiness rollback. A schema-changing release requires explicit
maintenance; startup never migrates. PostgreSQL major upgrades remain separately owned.

Client updates use Flatpak/Software. Automatic-update policy belongs to the desktop host; the
app shows its running version and manager and does not claim to know the host's policy. Updates
preserve sandbox-private state and retained videos. There is no self-writing application or
custom background updater. Initial import of any pre-Flatpak device state requires review and
is separate from the server catalog transfer.

## 4. App controls and recovery

Administration → Maintenance → Backups shows completed sets and submits fixed backup/restore
requests. Restore requires typing the backup ID and creates a recovery checkpoint first.
Maintenance → Updates shows server release status and compatible installation controls.
Profile settings → Device also provides the running client version and update-manager information for ordinary users.

The authenticated API revalidates/locks administrator sessions when it queues host operations.
The container shares a private operation directory with the host worker, never a Podman socket
or arbitrary host command interface. Jobs continue when the API stops and can be read again
after reconnect. Recovery journals and host credentials are outside the API's shared mount.
If the API cannot start, use the host maintenance command directly.

## Deferred consolidated acceptance

After implementation, use isolated data for installation, backup/restore equality, interrupted
operations, failed update recovery, permission boundaries and signed-artifact rejection. Then
verify Fedora mounts/SELinux, trusted LAN/local login, reboot persistence and installed Flatpak
updates. These checks concern delivery/recovery; no player/provider test phase is required
for this release. No live cutover or remote release publication is implied by this checklist.

## Deferred remote operator CLI

Aqua chose a CLI on Shadow configured with the server HTTPS address and an API key for routine
catalog editing. Implement this later using scoped/revocable keys, explicit server authorization,
auditing and existing catalog validation/dry-run semantics. PostgreSQL stays private. The current
host `operator` command is local maintenance, not this remote API client.
