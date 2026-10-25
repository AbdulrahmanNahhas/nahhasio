# AGENTS.md

## Current work and authorization — 2026-10-25

Aqua authorized all four code phases in docs/DEPLOYMENT.md before consolidated runtime acceptance.
Player/provider testing, Jellyfin and files-only playback are outside this release. Preserve the
reviewed UI. Aqua subsequently required working without sub-agents; continue in the main chat.

Aqua authorized committing the Flatpak checkpoint, revising Markdown and removing obsolete
material. Do not alter unrelated edits or private data. This does not authorize pushing, release
publication, family-PC installation or live catalog mutation. Keep development independent on
Shadow after transfer. Future remote catalog administration should use a local CLI with server URL
and API key over HTTPS; defer implementation. SSH is not the routine catalog-editing target.

## Project boundaries

Read docs/PROJECT.md, docs/ROADMAP.md and docs/DEVELOPMENT.md. Current milestone is 0.1 Alpha;
the future roadmap is not a release checklist. Fedora Atomic/rootless Podman is the server target;
Linux Flatpak is the client through v1.0. Nix/devenv is development-only. No website ships.
GitHub repository: AbdulrahmanNahhas/nahhasio; historical @arcadia workspace and database names
remain compatible. Treat unresolved decisions as unresolved.

The server is Rust/Axum/SQLx. Shared catalog/editor/provider/artwork services live in
crates/catalog-core; crates/cli provides the compiled direct-database operator. No Node worker is
installed. PostgreSQL is canonical. Preserve UUIDs, account ownership, notes/scores, tracking,
artwork paths and the sole packages/database/drizzle history. Application startup never migrates,
seeds, imports or cleans. Future migrations are additive and rehearsed on restored disposable data.

Read docs/BASELINE.md before recovery: the approved baseline preserves all existing data and
replaces only the old migration ledger. Its private data/backups/current-baseline-2026-10-20
checkpoint retains original dump, artwork and exact old/new sources. Never rerun retired creation
SQL against populated data or rehash a ledger to bypass validation. Keep independent recovery
before production cutover. Private backups and retained SQLite recovery candidates are not caches.

The client is GTK4/libadwaita/WebKitGTK, React/Vite and libmpv. Flatpak/Software owns client
updates; no custom executable downloader or host-command escape. Use packaging/flatpak/README.md.
The server uses signed manifests, compatibility/backup/readiness gates and explicit schema
maintenance. PostgreSQL major upgrades are separately owned. Report source/static, SDK-build and
installed/native acceptance separately.

Provider keys stay server-owned, write-only through authenticated settings and masked on reads.
Catalog, images and tracking belong to Nahhasio. Stored-media integration is deferred; Jellyfin
must never replace its metadata/artwork or synchronize tracking. Save work, client playback,
Download to server and Download to device remain separate. Client torrents run on the client;
server acquisition needs an explicit request. Files-only policy is whole-work. Offline mutations
are progress and watched/unwatched only. Keep one planet per work, whole-work dub metadata,
dubbing contributions, episode-owned stills and YouTube trailers. No edition/version system.

Do not inspect /saved/nixos-config without asking Aqua. Use persistent project locations for
retained work. Use compile/static checks while coding and focused disposable runtime checks when
needed; do not run mutation tests on the family catalog. New work/visible redesigns outside the
approved scope and new commits need explicit authorization. Historical receipts remain in Git.

## Rust learning ownership

Aqua has nearly completed the Rust Book. For today's initial minimal runnable GTK client,
the agent may implement the Rust needed for a working shell, login and main library page.
After that reviewed baseline, Aqua practices the client Rust through small Rustlings-style tasks.
The agent owns UI/UX, API/database work, setup and organization; it supplies interfaces, guidance,
acceptance checks and reviews instead of automatically completing Aqua's client Rust exercises.

- Put a stable exercise ID, goal, allowed tools/crates, constraints, documentation links and
  acceptance criteria in task comments. Explain how the task fits the actual application.
- Ask short concept questions when useful; give progressively stronger hints, and let Aqua attempt
  the solution. Full solutions follow an explicit request, not an unattended subagent rewrite.
- Keep the working application intact while exercises are unfinished. Do not wire `todo!`,
  panics or simulated success into normal user flows. Prefer an isolated exercise/test module.
- Explain Rust changes and review reasoning, ownership/lifetimes, errors and async behavior.
- Subagents inherit these boundaries. Do not delegate Aqua's exercise implementation to them.

## Monorepo boundaries

- `apps/server`: Rust/Axum/Tokio/SQLx server, in the root Cargo workspace.
- Removed website/deployment references remain recoverable at `d77096f:reference/` in Git.
- `crates/native-player`: isolated GTK/libmpv adapter and diagnostic examples.
- `crates/media-transfer`: UI-independent torrent engine and durable device state.
- `crates/catalog-core`: shared Rust catalog/database services and Drizzle-compatible explicit migration runner.
- `crates/cli`: compiled Rust operator CLI; database, work/media, report and discovery operations.
- `tools/catalog-reference`: development-only export/report oracle and acceptance helpers; never ship it.
- `packages/database`: existing PostgreSQL schema and the single migration history.
- Other `packages/*`: shared contracts/generators, domain rules, vocabulary and OpenAPI bindings.

`apps/linux` contains the Rust GTK shell; `apps/linux/ui` is the separate React/Vite viewing UI.
The rejected Kotlin prototype was retired after a committed checkpoint. Do not create empty packages. Share media behavior in UI-independent Rust and network
contracts through the existing single generated OpenAPI definition.

## Development and checks

Use the repository's Nix/devenv environment: Node 24, pnpm 12.9.0, and Rust.
`devenv up` starts PostgreSQL and the Rust API. `devenv -P dev up` adds Vite and GTK with
dependency ordering. Do not inspect `/saved/nixos-config` without Aqua's permission.

- `pnpm lint`: Oxlint, the generic anti-slop plugin, and six shadcn design-system rules.
- `pnpm format` / `pnpm format:check`: Oxfmt, the authoritative formatter and import sorter.
- `pnpm typecheck`: TypeScript workspace checks.
- `pnpm check:rust`: new Rust workspace formatting and Clippy with warnings rejected.
- `pnpm check`: all the above. Run before handoff.
- `pnpm build`: desktop/shared tooling checks and Rust workspace build.
- `cargo test --workspace --locked`: Rust unit tests, with no live catalog writes.
- `pnpm test:e2e`: Linux UI browser fixtures; use Chromium from Nix on this machine.

Use the approved lean checkpoint policy. Run meaningful runtime suites when needed for acceptance
or unresolved risks; do not repeat full suites for each small change. Documentation-only work
requires link/format checks, not application tests.
Database mutation tests require a disposable migrated/restored database. Default test commands
can include integration suites: never point them at the live family catalog.
Keep commits focused and conventional. Include actual checks and material limitations in reports.

## Desktop client verification

Follow `docs/TESTING.md` for commands, native smoke isolation and reporting.
Browser Playwright checks are not GTK/WebKit verification. At consolidated visible desktop acceptance, test
both the fixture-backed browser UI and the freshly built packaged native client; inspect
screenshots and verify RTL arrows, Tab/Enter/Escape, focus restoration and narrow layouts.
Keep private captures/fixtures ignored, never use the live catalog for mutation tests, and
never relax CSP/origin/auth guards to make a test pass. Record the tested bundle/binary and
actual viewport. Synthetic events and software-rendered smoke do not prove physical input,
GPU smoothness or playback. Fully quit/relaunch GTK after bridge changes; single-instance
activation can silently keep the old executable alive.

## Desktop UI rules

These shadcn/TanStack composition rules apply to `apps/linux/ui`, including administration.
Preserve the reviewed design tokens/components, accessible labels, keyboard focus/navigation,
RTL, reduced motion and typed native-bridge boundaries. Permissions are enforced by the server.

Follow the `shadcn` skill and `docs/design-rules.md`. Components use the official `@shadcn`
registry; retrieve current docs before composing them, inspect generated output, and install
only components that have consumers in the dashboard. Aqua explicitly approved the full official
component set for the desktop. Read the `nahhasio-desktop-ui` skill there; preserve its palette,
static utility presentation and typed native boundary. Do not hand-edit vendored primitives to
fix caller errors.

- Use component variants/sizes and semantic theme tokens. Caller classes control layout.
- Use Field/FieldGroup, full Card composition, and Empty/Alert/Badge for their respective roles.
- Group select/menu items correctly; every dialog has a title and every field an accessible label.
- Use logical RTL utilities, gaps, `size-*`, `cn`, and configured Lucide icons with `data-icon`.
- Keep native link semantics and keyboard/screen-reader behavior. Respect reduced motion.
- No raw colors, arbitrary values, inline styles, unrecognized classes, dynamic class construction,
  or component appearance overrides in new app source. Run the six `@shadcn/lint` rules.
- No suppression comments or extension of the legacy anti-slop allowlist in new source.
- No web player, Tauri bridge, global DOM navigation scanner, or whole-catalog fetch.
  The typed native bridge connects the Vite desktop to the Rust API; no Start/SSR runtime.
- Put feature queries/UI together, keep route entries small, use server pagination, URL filters,
  typed query factories, request cancellation, and targeted cache invalidation.
- Do not copy remote state into effect-driven local state. Do not introduce persistent state
  without deciding its owner, scope, migration, and invalidation.

Do not hand-edit `routeTree.gen.ts` or `packages/api-contract/src/generated.ts`.
Prefer workspace imports over cross-package relative imports. Use strongly typed TypeScript;
parse untrusted HTTP/import data at boundaries rather than weakening internal types.

## Database preservation and authentication

PostgreSQL is the source of truth. Preserve all catalog UUIDs, identity/ownership links,
notes, scores, relations, explicit watched state, playback progress, and artwork paths.
`packages/database/drizzle/` is the only migration history. Never add a second migration tree.
Changing data access to SQLx does not replace migration ownership or regenerate the schema.

Startup never runs migrations, seeds, imports, or cleanup jobs. Make schema changes additive,
rehearse/backfill on restored copies, verify counts/content/constraints, and define rollback.
Before a live cutover, secure a verified independent backup of both PostgreSQL and artwork.
`data/nahhasio.db` is a retained SQLite recovery candidate. Recovery tools require explicit
`ARCADIA_V1_DB_PATH` and absolute `ARCADIA_V1_ARTWORK_ROOT` selections. Backups and recovery artwork are private and never committed.

The public catalog CLI is `./bin/nahhasio` (compiled Rust). Build it with
`devenv shell -- cargo build --locked -p nahhasio-cli`; it uses `target/debug/nahhasio` unless
`NAHHASIO_CLI_BIN` selects another binary. `DATABASE_URL` is explicit, never guessed. It supports
generic database operations, whole-work/media operations, reports, discovery and migrations.
Writes require `--write`/`--dry-run`, multi-row generic commits need `--yes`, and SQL mutations
require RETURNING. Media purge removes guarded unused records while retaining recovery files.
`NAHHASIO_MEDIA_ROOT` configures server artwork; `NAHHASIO_VIDEO_ROOT` configures client videos.
Do not reset transfer state or move retained files to resolve a storage-root mismatch.
Use the `nahhasio-db` skill
for live catalog reads/writes and the `nahhasio-cataloging` skill for editorial classification.
Preserve the current Better Auth identity/password ownership during Rust migration; verify
hash compatibility with fixtures before cutover. Do not weaken existing production auth guards.
Do not log secrets, database connection strings, password hashes, or session tokens.

Rust database sessions default to read-only; authorized writes explicitly opt into read-write
transactions. Dedicated client editors use admin sessions, revalidated/locked within mutations.
The debug-only local HTTP administration surface requires the private server token. The Rust
CLI is a trusted local PostgreSQL operator and uses database credentials, not that HTTP token.
Test it with `devenv shell -- bash bin/test-rust-catalog`; this owns a disposable socket-only
cluster and never uses family data. Its fixtures do not prove live cutover or desktop acceptance.
Production auth, device and implemented mutation paths revalidate current authorization; future
writers must follow the same transaction locks. Installed acceptance remains pending.
Keep user identity, viewing profile, device, and library policy as distinct concepts.

## Rust and playback

Keep unsafe code out of the server workspace. Use bounded pools/timeouts, structured tracing,
clear feature boundaries, graceful shutdown, and ordinary transactional SQL.
The media core must not depend on Tauri/GTK or UI types. Platform players use adapters.
The selected new Linux player uses libmpv through an isolated native adapter; measure its actual
Wayland/XWayland/GPU/subtitle behavior. Inspect the working legacy Tauri player in Git history
before rewriting transfer/player logic. Device downloads, saved metadata/source packs, and home-library downloads
are different workflows with different ownership and recovery behavior.

## Current product order

Administration lives in the Linux client, retaining its reviewed UI language. The web dashboard
and Hono API were retired in the approved cleanup checkpoint. Cover existing editorial/admin workflows, TMDB, Fanart, images, raw table
inspection, JSON/bulk editing, maintenance, revisions, users/devices, and server operations.
UI routes may be prepared before their services; pending actions must stay visibly disabled.
Do not claim full database control from UI layouts. Connect authorization and transactional
mutations before enabling them. The Linux work page, torrent playback
and device downloads are implemented with documented limits. Jellyfin/home-server jobs and admin
migration follow their own authorization and review.
