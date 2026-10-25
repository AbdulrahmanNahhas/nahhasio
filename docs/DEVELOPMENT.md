# Development guide

Read [PROJECT](PROJECT.md) for scope and [DEPLOYMENT](DEPLOYMENT.md) for hosting. Use the
repository Nix/devenv environment on Shadow: Node 24, pnpm 12.9.0, Rust, GTK/libadwaita,
WebKitGTK6, mpv, libtorrent and Chromium. Nix is not required by installed clients or servers.
Do not inspect `/saved/nixos-config` without Aqua's permission.

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
| tools/catalog-reference        | Development-only TypeScript export/report oracle and acceptance scripts                                                               |

The installed Rust server executes all editor, provider and artwork operations through
`crates/catalog-core/src/editor`; it does not launch Node or load TypeScript source. The private
Node worker has been removed. Only isolated export/report comparison helpers remain under `tools/catalog-reference`. Node/pnpm are still development/build dependencies for React.
Schema ownership does not move from Drizzle to a second SQLx tree.

## Run/build

```sh
devenv processes list
devenv up
devenv --profile dev up
devenv up client
```

`devenv up` starts PostgreSQL and the Rust API only. For everyday UI development, use
`devenv --profile dev up` (short form: `devenv -P dev up`). The native process manager starts
Vite alongside the backend, waits for both HTTP readiness probes, then builds and launches
the GTK client with `NAHHASIO_UI_URL=http://127.0.0.1:23110/`. React/CSS edits update through
Vite HMR without rebuilding the UI bundle. The native launcher retains the same process-local
graphics compatibility settings as the built client.
Both modes explicitly share the existing `.devenv/state/postgres` catalog; the dev profile
does not create a separate empty database.

Rust changes still require a rebuild/restart: use `devenv --profile dev processes restart client`
for the shell or `devenv --profile dev processes restart server` for the API. Fully quit any
separately launched GTK instance first so single-instance activation cannot retain an old shell.
Use `devenv up client` for the backend plus the built UI, or
`devenv shell -- nahhasio-client` for the built desktop alone.

When switching modes or changing `devenv.nix`, stop the old manager first with `devenv down`
(use `devenv --profile dev down` if it was started with that profile), then run the new command.
An existing manager retains its original process definitions. Avoid running the two modes
simultaneously against the same PostgreSQL data directory and fixed ports. Startup never
migrates or seeds the catalog; no website or Node API process is started.

| Service                          | Port  |
| -------------------------------- | ----- |
| PostgreSQL                       | 23102 |
| Rust API                         | 23103 |
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

## Direct-database operator CLI

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
these environment values. The public `bin/nahhasio` and workspace scripts invoke the
compiled Rust tool, without an implicit database or Node fallback. Build the debug binary first;
`NAHHASIO_CLI_BIN` selects another installed/release binary. `help --json` describes commands and
flags; `schema --resources` lists resource aliases. `work template/schema` and help need no database.
`media ingest <file-or-approved-provider-url>`, `media assign <asset>` and `media purge` share server
artwork guards. Media commands require `--write`/`--dry-run`; purge commits additionally need
`--yes` and retain physical files for recovery. Dry runs roll back database changes but may leave
recoverable orphan image bytes. Actor references resolve by UUID, slug or display name.
The former TypeScript CLI entry point and editors are removed. `tools/catalog-reference` retains
only the export/report oracle and acceptance helpers; it is never shipped or used by the server.

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
must reload/review if their old fingerprint is rejected. The old web dashboard and Hono API are retired. People/Studios and work
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
`pnpm --filter @arcadia/contracts generate:rust-editor`. Old open reviews must reload after this transition.

## Native and interface boundary

Rust owns HTTP/session secrets, server trust, player and storage. React calls typed, bounded
native operations; it never receives session tokens or arbitrary native command access. The
packaged origin is `nahhasio://app/`; development allows exactly `http://127.0.0.1:23110/`.
Hash routes preserve native packaging. Generate `routeTree.gen.ts` and API types through their
owning scripts; never edit them manually. The server enforces current permissions.

Private native state binds sessions to server/account identities. Saved server connections retain
trusted CA/fingerprint and normal HTTPS chain/hostname checks. Loopback HTTP is development-only.
Switching server/account scopes query caches, snapshots, downloads and queued tracking updates.
Stored state is not a proof that cached artwork or video bytes remain available.

The interface uses TanStack Router/Query and shadcn Base UI Maia/Mist. Preserve the reviewed design,
RTL, keyboard behavior, reduced motion, semantic tokens and typed boundaries. Follow the applicable
repository skills for interface work. [CLIENT](CLIENT.md) owns current feature behavior;
[design-rules](design-rules.md) owns composition rules.

## Catalog and authorization

Shared Rust editor/provider/artwork services live in `crates/catalog-core/src/editor`; the server
and compiled CLI do not spawn Node workers. Whole-work review/save validates ancestry, references,
dependencies and revision fingerprints. Saves revalidate authorization in their transaction and
write audit/revision records atomically. Reviews loaded before incompatible changes must reload.

`apps/server/src/auth/write.rs` owns consistent identity/account/session/device write locks.
Viewer visibility/policies and device revocation are checked under those locks. Login issuance
also locks identity/account so password rotation cannot race into a surviving stale session.
Read requests retain their middleware/snapshot model. Future writers must follow this lock order.

Artwork uses bounded signatures/dimensions, hashes and exclusive files. Rename preserves old
paths/hard links. PostgreSQL rollback cannot remove newly created bytes: failed imports or dry
runs can leave recoverable unassigned files. Purging unused records retains physical recovery files.
Never rewrite asset IDs or delete files merely to resolve root selection.

Input schemas are generated from shared Zod contracts. `pnpm typecheck` checks drift; regenerate
with `pnpm --filter @arcadia/contracts generate:rust-editor` and, for network contracts,
`pnpm client:generate`. `packages/api-contract/openapi.json` is the single network definition.

## Storage, accounts and offline use

`NAHHASIO_MEDIA_ROOT` and `NAHHASIO_PUBLIC_MEDIA_ROOT` configure server artwork. Client video uses
only `NAHHASIO_VIDEO_ROOT`, normally `~/Videos/nahhasio`; do not let server artwork variables change
it. Native durable state belongs to XDG storage. Root mismatches must stay recoverable errors,
not trigger automatic moves or transfer-state resets. Flatpak maps these locations to its sandbox;
see [packaging](../packaging/flatpak/README.md) before importing old device state.

Saved Works retains server/account-scoped work snapshots/artwork and durable source identities.
Metadata readiness, downloaded-video readiness and account saved intent are distinct. Offline
mutations are progress and watched/unwatched only. Reconnection resolves current ownership and
conflicts; never silently overwrite newer tracking or claim an unrelated account's local files.

Profiles and avatars use authorized account services and native artwork transport. Preserve
account/identity links. Member activity projections must omit passwords, sessions, private paths,
invite secrets and raw settings. Broader account/device management remains a separate feature.

[Operations](OPERATIONS.md) owns private provider settings, LAN trust and preflight.
[Database](DATABASE.md) and [baseline](BASELINE.md) own preservation and migration rules.

## Media runtime

Source selection is explicit; browsing a work does not initiate playback/download. Torrent,
anime-direct and provider embeds have separate native adapters. The media core is UI-independent.
Download must not attach mpv as a side effect. Device retained files, engine cache, saved metadata
and server library storage are distinct. Unknown mappings and failed transfers remain errors.

[Streaming](STREAMING.md) documents provider isolation/diagnostics and [anime direct](ANIME-DIRECT.md)
documents the bounded Python helper. These client features do not imply server acquisition or
stored-file delivery. Player/provider testing and Jellyfin/files-only playback are outside the
current hosting release. Do not relax protocol/CSP/TLS/auth restrictions for a provider failure.

## Build and verification

```sh
devenv shell -- pnpm check
devenv shell -- pnpm build
devenv shell -- cargo test --workspace --locked
```

Use focused disposable checks for relevant risks and consolidated installation acceptance after
implementation. Documentation-only changes need format/link checks. [TESTING](TESTING.md) owns
commands and native/browser distinctions. No mutation test may use the family catalog.

The conventional release pipeline builds the client in the pinned GNOME Flatpak SDK and the server
as a Rust-only OCI image. Use `bin/nahhasio-flatpak` for a local client build; build/sign/publication
instructions are in [packaging/flatpak](../packaging/flatpak/README.md). The Python utilities in
`packaging` are active build/install/recovery tools, not a second web runtime.

## Development after transfer and learning

Keep the checkout and a small independent local database/artwork sample on Shadow.
[Development packs](../packaging/development/README.md) omit production passwords, sessions,
provider keys, devices and personal tracking. They never replace the current laptop catalog
automatically. Retain the original full private recovery copy through verified cutover.

Aqua owns selected Rust-learning exercises. Supply stable exercise IDs, interfaces, hints and
acceptance criteria. Preserve the working app; do not wire `todo!`, panics or fake success into
normal paths or complete exercises without the requested authorization.

The future remote operator CLI will use a server URL and API key over HTTPS from Shadow. It is
not implemented by the current direct-database CLI or installed host wrapper. See the deferred
boundary in [PROJECT](PROJECT.md).
