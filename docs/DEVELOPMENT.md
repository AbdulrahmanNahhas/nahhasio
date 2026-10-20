# Development guide

Read [PROJECT.md](PROJECT.md) for scope and [ROADMAP.md](ROADMAP.md) for current priorities.
Use the repository's Nix/devenv environment: Node 24, pnpm 11.11.0, Rust, GTK/libadwaita,
WebKitGTK6, mpv, libtorrent and Chromium. Never inspect `/saved/nixos-config` without permission.

## Repository map

| Path                           | Responsibility                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| apps/server                    | Rust/Axum/SQLx authentication, bounded catalog/viewer API and authorized administration                                               |
| apps/linux/src                 | GTK/WebKit lifecycle, contained assets, native network/session, player/device media                                                   |
| apps/linux/ui                  | React/Vite viewing/admin UI, TanStack Router/Query, Tailwind/shadcn                                                                   |
| crates/native-player           | Isolated GTK/libmpv adapter and diagnostic examples                                                                                   |
| crates/media-transfer          | UI-independent torrent engine and durable device state                                                                                |
| crates/catalog-core            | Shared Rust database pool, schema discovery, local operator operations, redaction and explicit Drizzle-compatible migration execution |
| crates/cli                     | Compiled `nahhasio` operator binary; database/migrations, whole-work documents and shared editor operations                           |
| packages/api-contract          | Single OpenAPI definition, generator and validated TypeScript contract                                                                |
| packages/contracts             | Shared work/editor schemas and domain contracts                                                                                       |
| packages/database              | PostgreSQL schema, sole Drizzle migration ledger, explicit recovery tools                                                             |
| packages/domain, packages/i18n | Scoring/policy/taxonomy and labels                                                                                                    |
| packages/cli                   | CLI, SQL helpers and shared full-document reconciliation                                                                              |
| apps/web, apps/api             | Transitional dashboard/legacy API and still-consumed provider/media helpers                                                           |

The installed Rust server executes all editor, provider and artwork operations through
`crates/catalog-core/src/editor`; it does not launch Node or load TypeScript source. The private
Node worker has been removed. Legacy helpers remain only for the transitional dashboard and
development CLI consumers. Node/pnpm are still development/build dependencies for React.
Schema ownership does not move from Drizzle to a second SQLx tree.

### Rust operator CLI checkpoint

Build with `devenv shell -- cargo build --locked -p nahhasio-cli`; the executable is
`target/debug/nahhasio`. It runs outside the checkout and needs no Node process. To install a
release binary on the operator's PATH, use `cargo install --locked --path crates/cli` in the
development environment. `DATABASE_URL` is required; no database is implicitly selected.

Implemented: health, live schema/enums, generic resource list/get/create/update/delete,
name/alias/foreign-key resolution, typed filters, bounded pages, row-count statistics, single
result-producing SQL statements and explicit migration manifest/status/apply. Outputs include
compact tables, JSON, NDJSON and CSV. Writes require `--write` or `--dry-run`; multiple matching
rows additionally require `--yes` to commit. Dry runs execute constraints/audits and roll back.
Mutations use serializable transactions; audit failure prevents commit. Authentication/audit
tables and secret fields require dedicated operations rather than generic edits. Schema/table output masks
known secret fields; database errors expose SQLSTATE rather than sensitive record diagnostics.
The CLI remains a trusted local operator tool with direct database credentials, not a client API.

`sql` accepts one SELECT or a data-modifying statement with RETURNING. The result CTE prevents
transaction-control/multiple statements from escaping rollback; DDL belongs to explicit migration
execution. SQL results and generic pages are capped at 500 rows. `stats` supports the ten catalog report presets and typed group-by/metrics using the same
filters as ordinary reads. Reports are bounded; JSON aggregate values are numbers. The native CLI also supports `work schema`,
`work template`, `work export <reference>` and `work apply --file document.json --mode merge|replace`
with `--dry-run` or `--write`; `--create-only` refuses an existing work. Merge preserves omitted
list members; replace reconciles supplied lists. Neither mode silently creates missing vocabulary or people; the explicit operator-only
`--create-missing` flag may create those references inside the same transaction. Installment
removal remains blocked pending a separate dependency review. Inputs also accept a positional
file or `--input-json`; the older inline `--json <document>` form is normalized to input JSON.
`editor <operation> --file input.json` shares People/Studios, work, artwork/provider and reference
contracts with the server. Editor audit identity requires `NAHHASIO_CLI_ACTOR`; ticket-based editor
review/save additionally needs the same private 32-byte hex `NAHHASIO_EDITOR_SECRET` across commands.
Server tickets instead use a process-local random key and expire after 15 minutes. Do not print
these environment values. The public `bin/nahhasio`, compatibility `bin/arcadia` and workspace scripts now invoke the
compiled Rust tool, without an implicit database or Node fallback. Build the debug binary first;
`NAHHASIO_CLI_BIN` selects another installed/release binary. `help --json` describes commands and
flags; `schema --resources` lists resource aliases. `work template/schema` and help need no database.
`media ingest <file-or-approved-provider-url>`, `media assign <asset>` and `media purge` share server
artwork guards. Media commands require `--write`/`--dry-run`; purge commits additionally need
`--yes` and retain physical files for recovery. Dry runs roll back database changes but may leave
recoverable orphan image bytes. Actor references resolve by UUID, slug or display name.
TypeScript CLI source remains only for transitional consumers and isolated parity comparisons.

Migrations embed the sole `packages/database/drizzle/` history in the binary, compare applied
hashes/timestamps, refuse gaps/unknown/newer histories and unjournalled nonempty databases, and
use the existing `(23103,1000)` PostgreSQL maintenance lock. No `_sqlx_migrations` ledger is added.
They run only through `nahhasio migrate apply --dry-run` or `--write`, never application startup.
The server shares database connection setup, schema discovery and redaction with this library.
All six Planets operations now use `crates/catalog-core/src/planets.rs` through the existing
authenticated editor endpoint. Definitions and membership edits retain stale-revision checks,
dependency/deletion guards, deterministic locks and atomic audit/revision writes. Read operations
use repeatable-read transactions; writes revalidate/lock the admin session inside serializable
transactions. Revisions are opaque fingerprints; forms loaded before this backend transition
must reload/review if their old fingerprint is rejected. The transitional web dashboard retains
its existing TypeScript services until its replacement is accepted. People/Studios and work
reviews rehearse in savepoints and roll back; saves recheck revisions and authorizations. Work
saves also compare the persisted document against the reviewed result. Foreign-key checks include
composite keys before deleting episodes. Artwork registration uses bounded signature/dimension
checks, exclusive files and content hashes; renames retain hard links and old-path resolution.
Database rollback does not undo file creation: failed imports may leave recoverable orphan files,
never overwrite or remove catalog artwork.

Rust provider operations retain TMDB, Fanart and AniList behavior. Keys remain server environment
configuration (`TMDB_API_READ_ACCESS_KEY`, `FANART_API_KEY`); authenticated masked key management
in the desktop remains a separate task. HTTPS requests have fixed provider endpoints, no redirects,
time/size limits and a shared connection pool. Uploads need `NAHHASIO_MEDIA_ROOT` and optional
`NAHHASIO_PUBLIC_MEDIA_ROOT` in deployment; checkout-relative defaults are development convenience.
Input schemas are checked-in generated data from the existing Zod contracts, with semantic guards
in Rust. `pnpm typecheck` checks schema drift; regenerate with
`pnpm --filter @arcadia/cli generate:rust-editor`. Old open reviews must reload after this transition.

## Run/build

```sh
devenv processes list
devenv up postgres server
devenv shell -- nahhasio-client
devenv up
```

`devenv up` currently includes the transitional website; it is a development process, not the
product target. Use `devenv up postgres server web` when checking that surface. The optional
Hono reference API uses `devenv --profile reference-api up`. Avoid duplicate processes.

| Service                          | Port  |
| -------------------------------- | ----- |
| PostgreSQL                       | 23102 |
| Rust API                         | 23103 |
| Transitional website             | 23100 |
| Optional Hono API                | 23101 |
| Desktop Vite                     | 23110 |
| Isolated player browser fixtures | 23112 |

```sh
devenv shell -- pnpm --filter @nahhasio/linux-ui dev
devenv shell -- pnpm --filter @nahhasio/linux-ui build
devenv shell -- cargo build --locked -p nahhasio-linux
devenv shell -- cargo build --locked -p nahhasio-server
devenv shell -- pnpm client:generate
```

Native production serves contained `nahhasio://app/` assets. Development origin is exactly
`http://127.0.0.1:23110/`. `NAHHASIO_UI_URL` selects development UI; `NAHHASIO_UI_DIR` selects
an explicit packaged bundle directory. A production build is not proof that a running GTK
instance loaded it: fully quit/relaunch after bridge changes. Restart only the affected server
with `devenv processes restart server` when an endpoint change needs activation.

## Client/UI boundary

Rust owns HTTP/session secrets, player and storage. UI calls typed bounded native operations;
no bearer/private admin token, arbitrary native command, browser server fetch or remote UI.
Hash routes retain native packaging semantics. Never hand-edit `routeTree.gen.ts` or generated
API code; regenerate through the owning scripts. Server enforces permissions on every operation.

Native session credentials persist in private, server-bound native storage. The login and account
menu provide saved-server selection and connection checks (see the checkpoint below). Native
configuration accepts HTTPS or loopback HTTP; home-server certificate provisioning remains a
deployment decision rather than disabling TLS/session checks.

## Current media behavior and limits

The existing player accepts local files and Nahhasio's contained loopback media gateway. It has
actual audio/subtitle track selection and manual external SRT/ASS/SSA/VTT subtitles. Automatic
provider retrieval and a completed server-file library workflow are pending.

Existing Torrentio source configuration uses `NAHHASIO_TORRENTIO_URL`/`NAHHASIO_TORRENTIO_CONFIG`,
falling back to `NAHHASIO_STREAM_ADDON_URL`/`NAHHASIO_STREAM_ADDON_CONFIG`. Keep private configuration
in ignored server/native environment, never UI/argv/logs. Source selection is explicit; download
must not attach mpv or call play/preview as a side effect. Source availability is not guaranteed.

Source matching preserves season ordinal semantics, excludes movies/specials, and does not round
fractional episode numbers to another episode. Supplied server files need an independent import
path; IMDb/Torrentio identifiers are not required for them.

Device state uses XDG state storage; retained videos normally use `~/Videos/nahhasio` (see
OPERATIONS.md). Transfer/source caches, retained videos and future server files are distinct.
The media core must not depend on UI/GTK types. Unknown mappings/failed transfers stay errors;
never simulate completion. Do not execute downloaded files.

Keep native script/config/ytdl and protocol/format restrictions. HLS/DASH are not established
by the current contained-file/gateway path; any future streaming/transcoding adapter needs its
own validated integration. Synthetic/native render checks do not establish hardware/input/HDR
or public torrent-transfer reliability.

## Data and learning

PostgreSQL is canonical. Preserve catalog IDs and user/media links. Startup does not migrate,
seed, import or clean data. CLI is `./bin/nahhasio`; apply the nahhasio-db skill for catalog data
operations. Mutation/migration verification uses restored disposable databases.

Aqua owns selected Rust-learning exercises. Supply stable exercise IDs, interfaces, hints and
acceptance criteria; do not wire todo/panic/fake success into a working flow or implement an
exercise without the required request. Technical UI/API/setup work remains within approval.

Checks and isolation are in [TESTING.md](TESTING.md); runtime operations in
[OPERATIONS.md](OPERATIONS.md). Report implementation/build/activation/acceptance distinctly.

## Admin image library checkpoint

The Linux `/admin/images` route uses server pagination and typed editor RPC for asset lists,
details, bounded owner lookup, upload, primary assignment, unlink and protected record deletion.
Admin/session authorization is rechecked inside mutation transactions; audit records retain the
before state. Assignment compares the previously selected primary assignment and asset IDs.
Deleting an unused record retains its physical file for recovery and refuses current assignments,
derived variants and saved editorial-revision references. There is no automatic file purge.

File health checks use the configured server artwork directory, enforce canonical path containment
and inspect existence/readability/size, not image decoding or hash integrity. Ordinary lists check
only their page. Explicit health filters scan matching candidates before pagination with bounded
concurrency; more than 10,000 candidates require narrowing the filters. No schema migration is
introduced. Desktop visual/keyboard acceptance and isolated mutation verification remain pending;
static/build results do not establish those behaviors.

Artwork name cleanup reviews the current page (24 candidates, RPC ceiling 50). Clear owner/role
links produce a Unicode-safe work/entity slug, optional installment position/episode number,
role and short asset UUID. Ambiguous/unlinked/problem files are skipped. Confirmation recomputes
names and checks the reviewed path/hash, then verifies file SHA-256 and serializes rename batches.
The new filename is a hard link in the same folder; the registered path/name changes atomically
in PostgreSQL. Old hard links remain for revisions, saved paths and recovery without duplicate
image bytes. Editor/reference resolution recognizes those aliases through rename audit records.
Legacy assignment cleanup and CLI orphan purge retain renamed assets for explicit future cleanup.
Filesystems without hard-link support fail without falling back to copying or overwriting.
A failed/interrupted batch may leave unregistered new hard links, but the database transaction
rolls back and original files stay intact; retry can reuse the same inode. No automatic unlink job
runs. Permanent removal of old filenames is intentionally deferred until reference-safe cleanup.

Shared overlay compatibility rules preserve official primitives and focus behavior, replace
Dialog/AlertDialog zoom keyframes with lifecycle-driven opacity transitions, remove modal
backdrop blur, disable drawer height interpolation and honor reduced motion. Image details retain
content while closing and use a stable three-column desktop loading layout with the already listed
asset preview, stacking preview first on narrow screens. Upload/rename success uses the shared
Base UI toaster at the logical end (bottom left in Arabic RTL).
Native smoothness remains a physical GTK/WebKit review item, not a build claim.

The Tailwind base layer assigns uncolored borders to `--border`; official primitives such as
TableRow and Toast rely on that default. Explicit semantic border/focus utilities still win.
Do not fix recurring bright outlines by editing individual registry components.

The JSON reference schema uses coalesced PostgreSQL generation metadata: ordinary columns have
null identity_generation, so boolean OR must not leak null into the typed generated flag.
Schema-response parsing stays strict but reports readable errors. The reference panel mounts
only when expanded. JSON drafts retain same-route protection when selected IDs change. Works
selection survives search, filters, paging and admin route changes in a session-only query cache
scoped by server/user. Page selection adds/removes only the visible records, without the old 30-work cap. Select-all returns IDs/names for all matching results from
a single read-only API snapshot. Floating actions stay available for empty/error results; a searchable review dialog
shows selected names incrementally and permits individual removal. Logout/server switching clears this
state. Editors consume the full session selection through `selection=works`, avoiding truncated
UUID URLs. Work read/review contracts no longer cap record count; request-byte limits and
review/revision/transaction guards remain in force. The compact bottom bar has clear, review
and one direct JSON editing action. Select-all toggles to deselect-all and removes only the
current matching results. Filters use a popover, and pagination shows the visible range with direct page entry. This is a UI/introspection correction, with no database migration/write.

## People and Studios administration checkpoint

`/admin/people` and `/admin/studios` use one paginated typed entity service and editing Drawer.
Both are enabled; Planets/Awards stay disabled pending their reviewed steps. Lists default to
most linked works. Studios use square logos and organization roles; People use portraits and
person roles.
The single Drawer covers existing entity fields, aliases/languages, portrait selection/upload,
direct work/role editing, contribution order/primary state and new-role creation. Up/down arrows
reorder contribution cards and persist their numeric positions. This uses the existing contribution
position, which also orders contributors inside work details; it is not a separate viewer-library
sort setting. People, Organizations and Works share compact two-row controls, a filters popover,
selection review and one direct JSON action. Selection is scoped by server/account and entity kind,
survives search/page/route changes, and remains session-only. Explicit select-all loads only IDs/names
from the same SQL predicates as the paginated list; normal browsing makes no extra membership request.
People/Organizations have no selection/JSON record-count cap; request/ticket-byte limits, revisions,
authorization and transactional reconciliation still apply. Deletion retains its 50-record batch
limit and existing impact/count review, behind a separate menu. JSON handoff reads the session
selection instead of long UUID URLs. Loading skeletons match portrait/logo/table views; search
has a clear action, and date/number formatters are reused. Filters include exactly one linked
work. No schema is added. External identities currently belong to titles/installments, not
entities; no entity identity model or birth/country data is invented.

Mutations recheck admin sessions, lock work roots before entities, preserve retained alias IDs and
old artwork assignments, and record audit/editorial snapshots. Individual/batch deletion reviews
dependencies and revisions, requires typed-count confirmation and explicit credit-removal consent,
and blocks other incoming FK/polymorphic evidence references. Deletion is atomic and removes
entity records, aliases, credits and artwork links; works and physical assets/files remain.

The typed JSON adapter uses canonical English work names and role names, with completion,
reference lists and readable previews. Missing/ambiguous names, duplicate credits and foreign
aliases are rejected. Account-bound signed review plans expire after 15 minutes; saves recheck
revisions inside one transaction. People and Studios are active consumers, while Planets/Awards
need separate typed adapters. Reference cards show searchable value chips, per-group copy and
whole-reference copy. Options fetch only names/IDs and
years, bounded at 5,000 works. Read-only list/options/JSON/dependency/review calls have been
exercised on the live catalog without writes; mutation and native UI acceptance remain pending.

Work/entity/JSON saves and entity deletion share catalog cache invalidation, including entity
details and artwork ownership. Retired standalone linked-work/delete operations were removed;
the Drawer reads credits with entity details, and single deletion uses the batch deletion service.
JSON import catches file-read failures, and unsaved alias rows retain stable session identities.

## Planet membership movement checkpoint

`/admin/planets` provides a source/selection/destination workflow, including works with no planet,
poster cards, source search and pagination. Selection spans pages, up to 50 works per batch.
The review shows each work's current and resulting memberships. Moving removes only the source
membership and adds the destination; removing from the source preserves all other memberships.
Existing destination ranks are preserved, new memberships have no featured rank, and no work,
artwork or other catalog data is deleted. Source changes reset selection with confirmation.

The existing schema supports multiple planets per work. `planets.display_order` orders planet
choices, while `title_planets.featured_rank` is optional per-membership ranking. This checkpoint
does not add ordering controls or planet-definition create/edit/delete. Mutations recheck admin
sessions and expected work/membership revisions, lock work roots in UUID order, verify the active
destination and save the whole batch in a serializable transaction with audit/revision snapshots.
No schema migration or live mutation test is required for implementation; isolated mutation and
native acceptance remain pending.

## Planet definitions checkpoint

The movement page's “تعريف الكواكب” button opens a definition list and a single editing Drawer.
Create/edit covers Arabic/English names, slug, description, emoji icon, primary/secondary colors,
planet display order and active status. Existing planets own icons/colors, not image assignments;
this checkpoint does not invent a planet artwork model. Numeric display order concerns planets,
not featured work ranks. Saves have a local before/after review and server revision comparison,
preserve the planet UUID and all work memberships, and record audit/editorial snapshots.

Deleting an empty planet requires its exact saved slug. Server checks all incoming FK references
and polymorphic evidence in the same serializable transaction, refusing linked planets. Users
can move works away or deactivate instead. Unsaved close/back/navigation guards and explicit
reload support conflict recovery. Planet membership ordering remains a future task. This stage
uses static/build and read-only definition checks; no live catalog mutations are used for testing.

## Downloads/device-video library checkpoint

Downloads has transfer and device-library tabs with search, status counts/filters, incremental
display and work grouping. Transfer rows expose progress, rate, peers, ETA, destination and
pause/resume/cancel actions. Completed exports remain visible in the library after queue removal
or torrent-cache cleanup. The storage section shows the configured native video root, registered
available-video bytes and filesystem free space, plus the existing guarded cache cleaner.

New exports retain a versioned local descriptor (catalog target, display title, work title and
poster asset reference) inside the existing transfer `target` field; legacy target-only records
remain readable. This is not a full saved-work snapshot or offline artwork cache. Work-page
metadata/artwork still depend on the server; cold offline application startup/account isolation
and progress sync belong to the later Saved Works checkpoint.

Native actions accept registered torrent/file identities, never arbitrary caller paths. Direct
saved-video playback does not request the catalog or search torrents. It participates in the
player command/poll ordering guard. Folder opening resolves an available registered file.
Queue cancellation retains published videos; removing a library record retains its physical file.
Physical deletion has a separate typed confirmation and refuses unsafe/size-mismatched paths;
local playback must be closed first. Recovery never overwrites a destination, and can reselect
a source when a missing/blocked job cannot resume. Export publication and these mutations share
a gate so a canceled intent cannot publish concurrently. Saved-record removal also supports
exports whose old torrent job was already removed by cache cleanup.

Changes require a freshly built/relaunched native client; UI hot reload cannot add Rust bridge
commands to an old process. Static checks/builds are used at this stage; live download/deletion,
native input/animation and offline-startup acceptance remain separate.

## Client persistence and AppImage delivery

Login now persists a native-only server-bound token in `session.json`, with a private directory
(0700), a private file (0600), atomic replacement and expiry checking. Passwords are never saved.
Logout and unauthorized server replies remove the current server's stored session. Switching
server addresses does not send an old server's token to the new server. Storage errors surface
instead of silently claiming login will survive a restart. Sign in once after upgrading the old
in-memory client; its existing login cannot be recovered from disk.

On an ephemeral NixOS installation, preserve these **whole directories**, using persistent mounts:

- `$XDG_STATE_HOME/nahhasio`, normally `~/.local/state/nahhasio`: session, `jobs.sqlite3` and its
  WAL/SHM companions, torrent metadata/resume/export records, and `payloads/` for partial jobs.
- The configured Videos directory's `nahhasio/`, normally `~/Videos/nahhasio`: exported videos
  and legacy torrent payloads. `NAHHASIO_VIDEO_ROOT` overrides this location.
- The AppImage wherever it is installed, for example `~/Applications/`.

Preserve the state and video roots together. Do not move/change an existing video root by changing
the environment: the engine deliberately refuses a mismatched stored root. Symlink replacements
are rejected by storage guards; use bind mounts for impermanence. These are client paths; server
PostgreSQL/artwork backups and future Podman volumes have separate ownership. Full saved-work
snapshots, offline login/startup and tracking sync remain the later Saved Works checkpoint.

Build an optimized package with `devenv shell -- bash bin/nahhasio-appimage`. For a quick local
preview using the dev build, set `NAHHASIO_PACKAGE_PROFILE=dev`. Output is
`dist/client/Nahhasio-0.1.0-x86_64.AppImage` plus SHA-256. The packaging flake pins Nixpkgs and
nix-appimage, packages only the binary/UI, gathers the native ELF runtime closure and includes
GTK schemas, icons, TLS certificates, WebKit helpers and media libraries. The launcher retains
the development client's NixOS host-loader compatibility handling. No server, catalog, artwork,
credentials or development `.env` is included.

Run `chmod +x Nahhasio-0.1.0-x86_64.AppImage` then launch it. The current server defaults to
`http://127.0.0.1:23103/`; `NAHHASIO_SERVER_URL=https://your-server/` overrides it. The server
chooser/LAN connection checkpoint is still pending; non-loopback HTTP remains disallowed.
The package embeds the production UI and needs neither the checkout nor Vite to load it.

Shadow's NixOS AppImage handler extracts into `$XDG_CACHE_HOME/appimage-run`, normally
`~/.cache/appimage-run`. This regenerable runtime cache also needs disk space: the ephemeral
home was too full for the first extraction. Use a persistent cache directory when launching,
for example `XDG_CACHE_HOME=/your/persistent/cache ./Nahhasio-0.1.0-x86_64.AppImage`.
Do not put the extracted runtime into the client state/video directories.

`.github/workflows/linux-release.yml` builds an optimized AppImage and checksum on manual
dispatch or `v*` tags. Manual runs supply a downloadable Actions artifact; tags create a **draft**
prerelease for review. CI execution and publication are separate from local artifact creation.
No automatic client updater or published release is implied by this workflow.

The AppImage uses our own static Bubblewrap AppRun instead of the bundler's chroot launcher.
It mounts bundled Nix objects read-only, includes the host GPU/loader closure on NixOS to retain runtime
libraries, and lets WebKit create its own nested sandbox. Fontconfig has an explicit bundled
configuration and fonts. Neither WebKit sandboxing nor host kernel protections are disabled.
The launcher requires unprivileged user namespaces. Real object mounts keep WebKit's nested
sandbox paths resolvable without chroot, overlayfs or links outside its allowed filesystem.
This remains initially a NixOS preview: Fedora/non-NixOS graphics, audio/video and fresh-install
acceptance must be reviewed before calling it a generally supported Linux release.

## Server connection and login checkpoint

The client stores up to eight canonical root URLs and aliases in private versioned
`connections.json` under the existing device state root. User selection persists across launches;
an explicit `NAHHASIO_SERVER_URL` overrides it for that launch. URL validation accepts HTTPS or
loopback HTTP only, never embedded credentials, paths, fragments or queries. A missing scheme
means HTTPS. TLS verification stays enabled; this checkpoint does not add self-signed certificate
bypass/import or settle the later deployment certificate provisioning decision.

`GET /api/v1/server/info` exposes bounded product/name/version/API metadata only. Set
`NAHHASIO_SERVER_NAME` for the display name. Native probes verify protocol compatibility and
readiness without sending credentials. Login probes again before credentials are sent. This
endpoint requires the new API build; old servers report an actionable compatibility error.
The connection address is the current session boundary, not a new durable server UUID.

Native sessions now use `session-<sha256-of-canonical-url>.json` per server with atomic private
writes. The previous `session.json` remains readable; a successful new login replaces only its
matching legacy session. Logout/remove clears only that server's credentials. Connections and
sessions remain native-owned; passwords are never saved. Saved videos/jobs are not deleted by
switching. Full per-account/server offline cache ownership remains the next checkpoint.

Connection switching takes an exclusive shell operation guard, waits at most eight seconds for
in-flight catalog/media work, refuses active playback and clears native source candidates. Each
request snapshots an immutable transport, preventing token/base mixing. The UI cancels queries,
clears all private/native query data, rejects old-connection replies, resets media selections and
restores the new server's session. Renaming connections works offline; removing an inactive
connection has an explicit local confirmation. Choose another server before removing the active
one. To change an address, add a new connection rather than transferring credentials to a new URL.

The sign-in screen uses original bundled SVG cinema artwork rather than exposing catalog posters
before authentication. It supports Arabic/RTL, narrow/short windows, live connection status and
changing servers during session restoration. The account menu also exposes connection management.
Static checks, production UI/native builds and the live metadata/readiness endpoint passed.
The refreshed AppImage and visual design still need Aqua's review; consolidated cross-server
mutation, offline and deployment acceptance remain separate. No catalog migration or live
mutation suite is part of this checkpoint.

## Saved Works and offline checkpoint

Server connection/login is committed as `626d3ef`. Saved work data lives beneath
`$XDG_STATE_HOME/nahhasio/saved/<server-url-hash>/<account-id-hash>/` (the default state root
remains `~/.local/state/nahhasio`). Keep that state directory and the separately configured
video directory persistent. No browser storage, credentials in snapshots or second database
is introduced. URL identity is the current connection boundary; a durable server identity and
address-change/certificate recovery belong to the forthcoming database/deployment review.

Saving is an explicit native background operation. It reads the authorized full work projection,
tracking snapshot and referenced artwork through fixed endpoints, with six bounded image requests
at a time. A private versioned work document and catalog entry are published after image writes
complete. A failed refresh retains the prior snapshot; partial image files can remain for retry.
Limits are 1,000 works per account/server namespace, 2,000 referenced images and 512 MiB of image
data per save, with bounded individual documents. These are safety limits, not storage targets.
The original metadata projection retains linked display data, parts/episodes and source identities;
private provider configuration and session tokens are excluded. Refresh is explicit and retains
pending viewing changes. Saving never downloads video or changes favorites/server retention.

The login screen offers explicit local library selection for the selected server's known accounts.
This is access to private files on the current OS user's device, not an offline authentication
grant. The offline shell exposes saved works and device downloads, not administration/account
mutation screens. No server token is sent while reading offline data. Normal HTTPS/auth guards
remain in force after reconnecting. Library/profile transitions use the same exclusive operation
guard as server switching and clear UI caches/source candidates.
Login/logout also take the exclusive guard. A native revision captured when a bridge request
arrives rejects queued work after an account/server/library transition; progress writes carry
their originating account/server scope as well. Late requests cannot inherit the new transport.

Downloads separates saved work data, transfer jobs and device videos. The saved work page reuses
the viewing UI, hides uncached discussion and disables favorites; watched/unwatched remains
available. Local source lookup uses stable work/part/episode IDs without requiring an IMDb ID or
integer torrent episode number. Permitted torrent resolution still runs on the client and needs
internet plus an available provider mapping. Whole-work source-policy storage/projection is still
a pre-existing roadmap gap; this checkpoint does not invent per-part policy or a Jellyfin adapter.

New download records carry a server/account namespace for automatic work/file matching. Legacy
unscoped records and videos remain on disk and can be played explicitly from device videos;
they are not silently attributed to a server/account. Catalog-linked local playback retains its
identity when its saved metadata and download record match. The device-video list remains a
device-level file management view; it is not an account authorization boundary.

Saved works record playback position roughly every ten seconds and before an ordinary player
close. Resume uses the local snapshot, avoiding a server dependency. Watched edits and progress
are absolute per-unit entries in the private work document; ratings/notes/favorite edits are not
queued offline. Bulk watched applies to the units in the saved snapshot. Playback does not
automatically mark completion. Pending edits survive metadata refresh and prevent accidental
snapshot removal. Removal confirms local metadata/artwork deletion and retains videos/server data.

`PATCH /api/v1/works/{id}/tracking` reuses existing account playback tables with owner-scoped
transactions and target validation. It preserves unrelated progress/manual/subtitle fields and
uses the cached server `updatedAt` for optimistic concurrency. Identical retries are idempotent;
changed server state produces a conflict. Native sync sends at most five units per request batch,
retains unacknowledged edits and runs after a verified login to the same owning account/server.
Conflict flags persist. The review compares device/server watched and progress values, requires
explicit confirmation, and binds resolution to the reviewed server-state fingerprint. A later
server edit needs a fresh review. Server-deleted/restructured targets and corrupt local documents
remain explicit recovery errors; they are never silently discarded.

Implementation checks use formatting/lint/type checks and native/production builds. Full native
offline/reconnect, filesystem-failure and concurrent-account acceptance remains for the agreed
consolidated acceptance; no live family-catalog mutation tests run during this checkpoint.

## Browse preferences and membership grouping

Browse remembers applied filters, year range, sorting, grouping, works/installments and display
options through native `browsePreferences.load/save`. Rust owns version-1 private atomic files
under the existing device state root, scoped by hashes of the canonical server URL and account.
Eight named presets share that scope. Search text is temporary; an explicit navigation query
takes precedence over the last view. A bare Browse entry restores it. Reset restores Browse
defaults without deleting named presets. Invalid versions/data and storage failures surface
in the page; browser localStorage remains disabled. No database migration is required.

The filter drawer has labelled desktop categories and horizontal category navigation in narrow
windows. Selected facet values sort first; closing discards the draft and applying remembers it.
Planet, genre, country and studio grouping expands all matching memberships before pagination.
An entry carries its server-assigned `groupKey`, so a work can appear once in each applicable
group. Totals count grouped results; absent memberships have an explicit unassigned group.
Planet groups follow planet display order, with unassigned works last.

Focused checks cover preference parsing, native file round-trips/account-server isolation and
synthetic SQL membership totals and page boundaries without catalog reads or mutations. Fresh
server and desktop processes are required for the new API grouping and native preferences;
UI hot reload alone cannot add these capabilities. GTK appearance and hands-on restart review
remain separate from static/build and fixture checks.

### Browse refresh and loading follow-up

Packaged entry reloads accept local hash-route fragments while retaining scheme/host/path and
query guards; successful document commits clear the native recovery overlay. The native Browse
validator now accepts the four membership grouping modes as well as the server/API contract.
Regression tests cover refreshing a packaged hash URL and new groups reaching authorization
rather than being rejected as invalid input.

Results and skeletons share one responsive grid definition. Poster, banner and logo loading
placeholders follow the selected layout/size; table view uses placeholder rows and reduced
motion is respected. Presets live inside the Browse toolbar, show view summaries, support
updating an existing name and show pending/error/success feedback. Saved Works adds a clear
search action, result count and compact card placeholders. Hands-on GTK refresh remains a
separate acceptance check after relaunching the freshly built native process.

## Schema integration checkpoint — 2026-10-19

Phase 1 is committed as `990b704`; see SCHEMA-FOUNDATION.md for the Phase 2 checklist and limits.
The canonical contract includes policy/dubs/trailers, episode stills, contribution languages, playback
revisions, stable server identity and native installation registration. Regenerate editor-operation
schemas with `pnpm --filter @arcadia/cli exec tsx src/editor/generate-api.ts`, then `pnpm client:generate`.
Never edit the generated client directly.

Production administrator sessions may read `/api/v1/admin/database/schema` and bounded
`/api/v1/admin/database/{table}` pages. This replaces a client-side need for the private development
SQL token. Protected columns are projected as `[protected]`; secret-shaped nested payload keys and
connection parameters are scrubbed. Existing admin routes host the inspector; specialized editors
retain transactional/reviewed writes. No arbitrary SQL/write operation is exposed through this view.

`POST /api/v1/me/device` registers a private installation UUID and associates the current session.
`installation.json` and `server-identities.json` live under the existing private native state root.
Address aliases of the same verified server retain the original catalog/download/preferences scope;
URL-scoped session credentials are not copied between addresses. Replaced identities or two
independent cache roots require review instead of an automatic merge. Preserve the entire existing
`XDG_STATE_HOME/nahhasio` directory, not individual new files.

Unsaved-work playback uses a bounded tracking-only pack. It is excluded from the Saved Works list,
and it contains no proactively fetched artwork. Its progress queue/conflicts use the same owner
and revision rules as saved works. Manual flags win over automatic completion at 90 percent.
Episode stills are ordinary server media assets with episode assignments and source evidence.
YouTube links open the system browser after explicit activation; external pages never load in the
privileged WebView.

After native/API changes, restart only the managed server and fully quit/relaunch the desktop.
UI hot reload cannot install new bridge commands. Existing AppImages are unchanged by a local
source build and must be rebuilt separately. Physical GTK input, external-browser launch, real TMDB
credentials, cross-address/restart acceptance and Jellyfin/file playback remain distinct checks.

### Focused verification result

The disposable restored-catalog API run passed 276 assertions, including all 75 table reads and
member tracking. Browser fixture captures at 1440×1000 and 520×900 were inspected. The fresh native
executable and packaged bundle passed nine focused checks at 1440×793 CSS pixels, DPR 2, including
login/new admin controls/logout, with no JS/CSP errors or unexpected mock routes. The private
artifact manifest and captures are under `data/previews/work-review/phase2-complete-episodes-1440`
and `phase2-manifest.json`; browser captures are under `data/previews/phase2-schema`. They are
ignored and have no production credentials. The old broad driver used stale screen assumptions;
its failed runs do not replace this final focused result.

The UI deduplicates Zod and initializes its interpreter before importing the application. Official
overlays receive the existing document style nonce. ScoreComparison passes labels to ChartConfig
and uses its existing theme colors directly; it no longer requests redundant inline styles from
the vendored chart. These fixes preserve CSP and reviewed presentation. The native environment
still reported an unavailable accessibility bus and a Vulkan surface warning; no physical-input,
compositor smoothness, real-provider import, cross-address/restart or playback claim follows.

### Agent CLI

Run `./bin/nahhasio help --json`, `./bin/nahhasio work schema --json` and
`./bin/nahhasio schema <table> --json` for command/input/live database discovery.
Skills are `nahhasio-db` and `nahhasio-cataloging`. The old executable is a compatibility alias;
internal `@arcadia/*` workspace dependencies and the PostgreSQL database name remain unchanged.
List pages default to 50 with a maximum of 500; use `--offset` and `--count` for complete reads.
`NAHHASIO_CLI_ACTOR`, `NAHHASIO_MEDIA_ROOT` and `NAHHASIO_PUBLIC_MEDIA_ROOT` are preferred;
legacy environment variables remain fallbacks. This trusted local CLI does not provide remote
user authorization. See `docs/SCHEMA-FOUNDATION.md` for deferred runtime work.

### Device video storage — 2026-10-20

`NAHHASIO_MEDIA_ROOT` is server artwork configuration. The native client's retained video override
is now `NAHHASIO_VIDEO_ROOT`; its default remains the XDG Videos directory plus `nahhasio`.
The variables must not share ownership: inheriting server artwork configuration previously made
Downloads fail the transfer store's recorded-root check. Existing transfer records/files are not
reset or moved. If an older installation deliberately used a custom video root through the old
variable, set `NAHHASIO_VIDEO_ROOT` to that same directory. The transfer engine still refuses an
unreviewed root change. A fresh client process is required after this Rust change.
