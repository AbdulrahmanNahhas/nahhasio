# Family server: installed layout and agent access

Verified live on **2026-10-30**, using HTTPS from Shadow and SSH to the family PC.
This is the operational handoff for the installed machine, not a deployment proposal.
Versions, counts, capacity and service state below are dated observations: recheck before work.
See [DEPLOYMENT](DEPLOYMENT.md) for release ownership, [OPERATIONS](OPERATIONS.md) for policy,
and the [database skill](../.agents/skills/nahhasio-db/SKILL.md) for catalog conventions.

## Ownership and access

- The family PC owns the authoritative PostgreSQL catalog, artwork, provider settings and backups.
- Shadow owns the development checkout. Its local database is independent; changing it does not
  update the family catalog. Do not replace family data with an old laptop export.
- LAN API: `https://192.168.1.53:8443`.
- SSH: `ssh nahhas-family@192.168.1.53`.
- Host account/home: `nahhas-family`, `/var/home/nahhas-family`.
- Installation root: `/var/home/nahhas-family/Nahhasio` (`~/Nahhasio` on that account).
- Server identity: `2cd022f1-85b7-4f3d-a4ae-2ab2d8e55114`, name `مكتبة العائلة`.

Ash explicitly authorized HTTPS catalog administration, then SSH for the named deletion task.
Access is not blanket permission for later destructive work, service changes or deployment.
Use the authorization in the active conversation. Credentials are deliberately absent here.
The Linux SSH login and the Nahhasio application login are different identities.

## Verified Fedora host

| Item            | Observation                                                            |
| --------------- | ---------------------------------------------------------------------- |
| OS              | Fedora Silverblue 44, deployment `44.20261024.0`                       |
| Kernel          | `7.2.11-200.fc44.x86_64`                                               |
| Hardware        | Dell OptiPlex 3070, Intel Core i5-9500T, six cores/threads             |
| Memory          | Approximately 16 GB physical RAM; `free` reports 15 GiB and 8 GiB swap |
| Host tools      | Podman 5.8.9, Python 3.14.8, systemd 259                               |
| Container mode  | Rootless Podman, overlay storage                                       |
| SELinux         | Enforcing                                                              |
| User lingering  | `Linger=yes`                                                           |
| Home storage    | Persistent Btrfs `/var/home`, on `/dev/nvme0n1p3`                      |
| Available space | About 93 GiB available on a 231 GiB filesystem                         |

The booted rpm-ostree origin is `fedora:fedora/44/x86_64/silverblue`; a previous
`44.20261019.0` deployment is retained. Layered package requests include `distrobox`,
`gnome-tweaks` and `podman-compose`. Nahhasio itself runs through Podman/Quadlet, not a host
development shell or a compose deployment. Do not layer packages or change the Atomic deployment
as a catalog-maintenance step.

Listening sockets included SSH on IPv4/IPv6 port 22 and the API on port 8443. PostgreSQL has no
published host port; no host listener on 5432 was observed. The API publishes on `0.0.0.0`, so
LAN-only reachability also depends on the host/network perimeter. Firewall rules, router forwarding
and internet exposure were not audited in this pass.

## Actual directory layout

The installed paths override the generic XDG examples in installer documentation. **Always pass
`--config-root "$HOME/Nahhasio/config"` to the host tools.** The default
`~/.config/nahhasio-server` directory is not this installation's configuration.

```text
~/Nahhasio/
├── config/                         # private, mode 0700
│   ├── installation.json           # selected roots, image/version/schema metadata; mode 0600
│   ├── server.env                  # runtime database credentials/settings; never print
│   ├── operator.env                # owner-level operator connection; never print
│   ├── *-password                  # separate PostgreSQL roles; never print
│   ├── private/                    # server-owned provider settings
│   ├── tls/                        # public ca.crt, leaf server.crt, private server.key
│   ├── authority/                  # host-only CA signing material
│   ├── release-key.pem             # configured release-verification material
│   └── .previous-private-*/        # retained recovery material
├── data/                           # private, mode 0700
│   ├── artwork/
│   │   ├── uploads/                # imported catalog images
│   │   ├── entities/
│   │   └── library/
│   ├── backups/                    # coordinated backup bundles and operator receipts
│   ├── operations/                 # shared API/host inbox, jobs and status
│   ├── maintenance-private/        # worker locks, journals and claimed requests; host-only
│   ├── .previous-artwork-*/        # retained recovery material
│   └── tools/
│       ├── current -> versions/0.1.2
│       ├── install.py -> current/install.py
│       ├── operations.py -> current/operations.py
│       ├── transfer.py -> current/transfer.py
│       ├── host_tools.py -> current/host_tools.py
│       ├── manifest.py -> current/manifest.py
│       ├── versions/               # 0.1.1 and 0.1.2 observed
│       └── legacy/
├── incoming/                       # retained initial transfer 20261026T060849Z-c4e27bea
├── releases/                       # old installer/download directories; 0.1.0 and 0.1.1 observed
├── downloads/                      # empty during inspection
├── videos/                         # empty during inspection
└── jellyfin/                       # empty during inspection
```

Approximate usage: `data/` 5.5 GiB, including 5.0 GiB of backups and 578 MiB of artwork;
`incoming/` 555 MiB; `releases/` 476 KiB. These are directory measurements, not quotas.
The PostgreSQL volume is **outside** `~/Nahhasio`; backing up that directory alone misses it.
The empty video/Jellyfin/download directories do not establish scanning, playback or integration.
Earlier records mention an existing `~/Media` library; it was not inspected in this pass.
Retained `.previous-*`, transfer and version directories are not assumed disposable.

## Containers, database and mounts

Installed server version: **0.1.2**, API version 1. Both containers were running and healthy.

| Container           | Role and storage                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `nahhasio-server`   | Rust API; digest-pinned GHCR image, read-only root filesystem, container user 1000, dropped capabilities and `no-new-privileges` |
| `nahhasio-postgres` | PostgreSQL 17.11; digest-pinned official image, named persistent data volume, no published database port                         |

Both join the rootless `nahhasio` network. The server publishes host port 8443 to container port 8443. PostgreSQL database `nahhasio` uses separate `postgres`, `nahhasio_owner` and
`nahhasio_runtime` roles. The operator wrapper supplies owner credentials privately; do not extract
them to Shadow or expose PostgreSQL to make remote editing easier.

| Host source                  | API container destination      | Access     |
| ---------------------------- | ------------------------------ | ---------- |
| `~/Nahhasio/data/artwork`    | `/var/lib/nahhasio/artwork`    | Read/write |
| `~/Nahhasio/config/private`  | `/var/lib/nahhasio/config`     | Read/write |
| `~/Nahhasio/config/tls`      | `/var/lib/nahhasio/tls`        | Read-only  |
| `~/Nahhasio/data/operations` | `/var/lib/nahhasio/operations` | Read/write |

The Quadlet bind mounts use SELinux `:z` labeling; retain the inspected configuration rather than
substituting flags from a generic example. `config/authority` and `data/maintenance-private` are
not mounted into the API container.

Runtime path settings verified from an allowlisted projection of container environment:

```text
NAHHASIO_BIND=0.0.0.0:8443
NAHHASIO_MEDIA_ROOT=/var/lib/nahhasio/artwork/uploads
NAHHASIO_PUBLIC_MEDIA_ROOT=/var/lib/nahhasio/artwork
NAHHASIO_CONFIG_ROOT=/var/lib/nahhasio/config
NAHHASIO_OPERATIONS_ROOT=/var/lib/nahhasio/operations
```

Named volume: `nahhasio-postgres-data`, mounted at `/var/lib/postgresql/data` inside PostgreSQL.
Its inspected host location is
`/var/home/nahhas-family/.local/share/containers/storage/volumes/nahhasio-postgres-data/_data`.
Do not edit or copy a running database directory. Direct host traversal encountered mapped-user
permissions; database inspection succeeded through the operator instead. No permission change
or privileged workaround was needed.

Live catalog snapshot after the approved additions/deletions:
**268 works, 447 installments, 1,985 episodes, 1,196 media assets, 75 public tables**;
database size approximately 27 MB. Counts can change independently of source releases.

## Services and installed tools

Quadlet definitions live under `~/.config/containers/systemd/`, including:
`nahhasio.network`, `nahhasio-postgres-data.volume`, `nahhasio-postgres.container` and
`nahhasio-server.container`, with a `nahhasio-server.container.d/20-release.conf` drop-in.
Generated service files live under `/run/user/1000/systemd/generator/`; edit neither those nor
the managed release links by hand. Other applications have Quadlets in the same directory;
their presence does not make them part of Nahhasio maintenance.

Observed user services/timers:

| Unit                           | State                                  |
| ------------------------------ | -------------------------------------- |
| `nahhasio-postgres.service`    | Active/running, generated from Quadlet |
| `nahhasio-server.service`      | Active/running, generated from Quadlet |
| `nahhasio-maintenance.service` | Enabled and active/running             |
| `nahhasio-backup.timer`        | Enabled, active/waiting                |
| `nahhasio-update.timer`        | Enabled, active/waiting                |

Backup/update timers target approximately 04:00/05:00 host local time with randomized delays.
The worker reported a successful signed update check for 0.1.2. Enabled units and lingering are
observations, not a reboot test. Installed update failure/rollback and restore acceptance were not
rehearsed during this inspection.

Useful read-only commands, run as `nahhas-family` on the server:

```sh
podman ps --format '{{.Names}} {{.Status}}'
systemctl --user status nahhasio-server.service nahhasio-postgres.service nahhasio-maintenance.service --no-pager
systemctl --user list-timers --all 'nahhasio-*' --no-pager
python3 "$HOME/Nahhasio/data/tools/operations.py" --config-root "$HOME/Nahhasio/config" status
python3 "$HOME/Nahhasio/data/tools/install.py" --config-root "$HOME/Nahhasio/config" operator stats --json
```

Run the installed stable wrappers, which follow `tools/current`. The `releases/` directory is not
the active tool version. Do not run Nix/devenv, install Node, or copy a source checkout to the
family PC for normal catalog operations.

## How inspection and editing worked before SSH

The agent used Python's HTTPS client and `curl` from Shadow, without controlling the Linux app
and without connecting to PostgreSQL. This route already supports substantial administration.
The missing remote API-key CLI does **not** mean that all remote catalog editing is missing.

### Trust and read-only discovery

Ash supplied the public home root CA certificate and an independently communicated SHA-256
fingerprint. The certificate was saved in the ignored project path
`data/backups/family-server-access/home-root.pem`. Its fingerprint was checked with OpenSSL,
then selected for this origin with `curl --cacert` or Python `ssl.create_default_context(cafile=...)`.
No system trust setting was changed and certificate validation was not disabled.

Expected root identity, also verified over SSH on 2026-10-30:

```text
Subject: CN=Nahhasio Home Root
SHA-256: 00:E9:86:20:28:DF:ED:B8:EB:CF:F2:B8:D4:5A:2F:88:CB:A7:24:04:16:67:4B:20:3C:EC:F2:CE:0A:C1:B5:D6
Validity: 2026-10-26 through 2036-10-23
```

These dates describe the root, not the shorter-lived server certificate. The server's public root
is `~/Nahhasio/config/tls/ca.crt`. Never transfer `server.key` or anything in `config/authority`.
If trust changes, verify it with Ash rather than using `curl -k`.

From Shadow, in the project environment:

```sh
curl --cacert data/backups/family-server-access/home-root.pem --connect-timeout 5 --max-time 10 https://192.168.1.53:8443/api/v1/server/info
curl --cacert data/backups/family-server-access/home-root.pem --connect-timeout 5 --max-time 10 https://192.168.1.53:8443/api/health/ready
```

Both were rechecked successfully for this document. Server info returned the identity above,
version 0.1.2 and API version 1; readiness returned `{"status":"ready"}`.
The CA establishes TLS trust; it does not authorize database access.

### Authenticated catalog inspection

1. Sign in with an authorized application admin account using
   `POST /api/v1/auth/login`, JSON `{"email":"<provided separately>","password":"<provided separately>"}`.
2. Keep the returned `token` private and send `Authorization: Bearer <token>`.
   Do not print the login response or include credentials/tokens in commands, documentation or Git.
3. Search works with `GET /api/v1/admin/works?q=<URL-encoded query>&page=1&pageSize=50`.
   Search results require exact identity checks: `ghost` also matched unrelated works.
4. Read schema with `GET /api/v1/admin/database/schema`; inspect bounded rows with
   `GET /api/v1/admin/database/{table}?page=1&pageSize=50&q=<query>`.
   These projections mask protected fields. Paginate against `total`; raw table pages reject
   `pageSize` above **50**. The work-list endpoint has a separate maximum of 100.
5. Export complete work documents using `POST /api/v1/admin/editor`:
   `{"operation":"read","data":{"ids":["<work UUID>"]}}`.
   The response is `{"result":[{"document":{...},"revision":"..."}]}`.
6. End temporary sessions with `POST /api/v1/auth/logout`, then remove temporary token files.

No auth-account, password-hash or provider-secret dump is needed for catalog work. A browser or
native terminal being open on Ash's desktop does not share that session with an agent; establish
an explicitly authorized tool connection instead.

### Supported HTTPS writes

Use the dedicated transactional editor and existing schemas, not generic SQL over HTTP.
The request envelope is `{"operation":"<operation>","data":{...}}` at
`POST /api/v1/admin/editor`; the actual return value is under `result`.

- Existing works: export, build a projection with `schemaVersion: 1`, explicit `fields` and
  `records`, then call `review` with JSON text plus the original `{id, revision}` array.
- New work: call `create` with `{"json":"<serialized work document>"}`. This produces a
  review ticket; it does not create the work permanently yet.
- Inspect reviewed changes, then call `save` with `{"ticket":"<returned ticket>"}`.
  Reviews apply inside a savepoint and roll back; save performs the approved transaction.
- Tickets bind the actor and document revision and expire after 15 minutes. A server restart
  replaces the signing secret; obtain a fresh review after a restart or conflict.
- Re-export after saving and compare IDs, ownership, scope and preserved fields.
- For private works set **`isPrivate: true`** explicitly. `workflowStatus: draft` is an editorial
  revision flag and does not hide a public work from family Browse.

The same editor supports provider artwork `search`, `ingest`, `upload`, season/episode discovery,
entities and reference vocabularies. Provider search uses credentials already owned by the server;
do not read local `.env` secrets and send them to providers. Artwork ingest registers files in the
server's configured root and returns an asset/path. Assign that registered path through the work
document, then check `GET /api/v1/artwork/{asset UUID}` with authorization. Artwork file creation
is separate from work-save rollback; a failed draft can leave retained unassigned files.

This route was used for 100 Meters and the five private anime additions without the Linux app.
The private local helper and receipts are under `data/backups/family-server-access/` and
`data/backups/private-anime-2026-10-30/`; they are ignored, machine-local evidence, not shipped tools.
The helper is not guaranteed available in a fresh checkout. Obtain credentials securely from Ash;
do not copy credentials from historical chats or commit receipts/tickets.

### Current remote boundary

Server 0.1.2 has no authenticated **whole-work deletion** editor operation. Entity/asset deletion
operations do not substitute for deleting a work. The older `/api/database/*` generic mutation
surface is debug-only and separately guarded; do not enable it or weaken authentication on Fedora.
The planned scoped/revocable API-key remote operator CLI remains unimplemented.

For an explicitly authorized operation missing from HTTPS, the installed CLI over authorized SSH
is a working fallback. Do not claim deletion is impossible merely because that API route is absent.

## SSH operator workflow and the backup-command pitfall

SSH was verified reachable and usable for `nahhas-family`. Key-only login was not available to
this agent; Ash supplied password authentication for the task. Neither password was saved in this
document. Keep passwords out of command arguments, scripts, history and captured output.

The installed wrapper launches the compiled Rust `nahhasio` CLI in the digest-pinned server image,
on the private Podman network, with `config/operator.env`. It does not require exposing the DB.

```sh
python3 "$HOME/Nahhasio/data/tools/install.py" --config-root "$HOME/Nahhasio/config" operator title list --search 'Exact title' --json
python3 "$HOME/Nahhasio/data/tools/install.py" --config-root "$HOME/Nahhasio/config" operator work export 'Exact title' --json
python3 "$HOME/Nahhasio/data/tools/install.py" --config-root "$HOME/Nahhasio/config" operator migrate status --json
```

The wrapper does not mount artwork into its transient CLI container. Use the HTTPS image editor
for routine artwork ingest; do not assume a host operator image command uses the API artwork root.
Generic database mutations require `--dry-run` or `--write`; multi-row commits also require `--yes`.
Raw SQL writes require `RETURNING`. Preserve exact UUIDs and retain recovery before destructive work.

The initial backup attempts failed for two distinct reasons:

1. Omitting `--config-root` selected the unused default configuration location.
2. `run backup` tried to acquire the operation lock while the active maintenance worker held it.

With the worker running, **enqueue**, then poll status until the matching job succeeds:

```sh
python3 "$HOME/Nahhasio/data/tools/operations.py" --config-root "$HOME/Nahhasio/config" enqueue backup
python3 "$HOME/Nahhasio/data/tools/operations.py" --config-root "$HOME/Nahhasio/config" status
```

A queued response is not a completed backup. Check the matching job ID, `state: succeeded` and
returned `backupId`; verify its manifest hashes before deletion. Do not stop the worker or remove
its lock to force a concurrent operation. Coordinated backup briefly stops/restarts the API.

Backup `20261030T130411Z-5ebdf47c` completed through the worker and passed
`Maintenance.validate_backup()` checksums before the approved four-work deletion. It includes the
five private anime additions and the four works before deletion. The operator dry run affected
exactly four UUIDs and rolled back; the commit then removed four titles, five installments and
23 episodes. Unrelated title-row fingerprints and shared entity/artwork/account counts matched
before/after. The API remained ready. This is evidence of that completed task, not a deletion
command to replay or authority for future removals.

The checkpoint is in `~/Nahhasio/data/backups/`; detailed deletion receipts are in
`~/Nahhasio/data/backups/delete-four-anime-2026-10-30/`. A completed backup contains
`database.dump`, `artwork.tar.gz`, `configuration.tar.gz`, `host-recovery.tar.gz`,
`installation.json` and `manifest.json`. Bundles contain private account and credential recovery
data: never commit or publish them. Same-disk backups do not protect against disk loss; an
independent off-machine copy was not verified in this inspection.

## Assessment and remaining limits

- The installed separation is working: persistent PostgreSQL, server-owned artwork/configuration,
  private database networking, rootless services and versioned signed host tools. Metadata updates
  do not require a server build or restart.
- The active timers and successful backup/update records supersede older documentation that says
  no installation or maintenance execution has occurred. They do not prove full recovery acceptance.
- The custom root is the main operational trap. Use installation metadata and explicit config roots;
  do not infer active paths from default examples or old installer directories.
- Capacity is currently adequate for catalog data, but repeated full local backups dominate the
  installation size. No cleanup, retention change or deletion of recovery material is authorized
  merely by this observation.
- Whole-work deletion currently needs the authorized SSH operator fallback. Dedicated remote
  deletion/API-key CLI work should follow the existing validation, audit and review boundaries.
- Reboot behavior, off-machine backup recovery, firewall/router policy, leaf-certificate renewal,
  video-library contents, Jellyfin, playback and transcoding were not tested. Empty directories,
  hardware specifications and healthy HTTP responses do not prove those features.

No services, configuration, catalog rows, credentials or system packages were changed for this
documentation inspection. Only the project documentation was edited; SSH was closed afterward.
