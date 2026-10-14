# Development guide

Read [PROJECT.md](PROJECT.md) for scope and [ROADMAP.md](ROADMAP.md) for current priorities.
Use the repository's Nix/devenv environment: Node 24, pnpm 11.11.0, Rust, GTK/libadwaita,
WebKitGTK6, mpv, libtorrent and Chromium. Never inspect `/saved/nixos-config` without permission.

## Repository map

| Path                           | Responsibility                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| apps/server                    | Rust/Axum/SQLx authentication, bounded catalog/viewer API and authorized administration |
| apps/linux/src                 | GTK/WebKit lifecycle, contained assets, native network/session, player/device media     |
| apps/linux/ui                  | React/Vite viewing/admin UI, TanStack Router/Query, Tailwind/shadcn                     |
| crates/native-player           | Isolated GTK/libmpv adapter and diagnostic examples                                     |
| crates/media-transfer          | UI-independent torrent engine and durable device state                                  |
| packages/api-contract          | Single OpenAPI definition, generator and validated TypeScript contract                  |
| packages/contracts             | Shared work/editor schemas and domain contracts                                         |
| packages/database              | PostgreSQL schema, sole Drizzle migration ledger, explicit recovery tools               |
| packages/domain, packages/i18n | Scoring/policy/taxonomy and labels                                                      |
| packages/cli                   | CLI, SQL helpers and shared full-document reconciliation                                |
| apps/web, apps/api             | Transitional dashboard/legacy API and still-consumed provider/media helpers             |

Do not remove legacy helpers until their consumers are replaced. The full work editor calls a
fixed Rust facade/private Node worker; containers need that source/runtime dependency until it
is intentionally replaced. Schema ownership does not move from Drizzle to a second SQLx tree.

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

Native session credentials now persist in private, server-bound native storage; server-selection
UX is pending. Native server configuration accepts HTTPS or loopback HTTP; LAN trust/connection UX
must be designed deliberately rather than disabling origin/TLS/session checks.

## Current media behavior and limits

The existing player accepts local files and Nahhasio's contained loopback media gateway. It has
actual audio/subtitle track selection and manual external SRT/ASS/SSA/VTT subtitles. Automatic
provider retrieval and a completed server-file library workflow are pending.

Existing Torrentio source configuration uses `NAHHASIO_TORRENTIO_URL`/`NAHHASIO_TORRENTIO_CONFIG`,
falling back to `ARCADIA_STREAM_ADDON_URL`/`ARCADIA_STREAM_ADDON_CONFIG`. Keep private configuration
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
seed, import or clean data. CLI is `./bin/arcadia`; apply the arcadia-db skill for catalog data
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
selection remains page-scoped and appears in floating bottom actions; editing receives only the
explicit selected UUIDs. This is a UI/introspection correction, with no database migration/write.

## People and Studios administration checkpoint

`/admin/people` and `/admin/studios` use one paginated typed entity service and editing Drawer.
Both are enabled; Planets/Awards stay disabled pending their reviewed steps. Lists default to
most linked works. Studios use square logos and organization roles; People use portraits and
person roles.
The single Drawer covers existing entity fields, aliases/languages, portrait selection/upload,
direct work/role editing, contribution order/primary state and new-role creation. Up/down arrows
reorder contribution cards and persist their numeric positions. This uses the existing contribution
position, which also orders contributors inside work details; it is not a separate viewer-library
sort setting. List selection
persists across pages (50 records); JSON editing accepts 30. Filters include exactly one linked
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
  and legacy torrent payloads. `NAHHASIO_MEDIA_ROOT` overrides this location.
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
