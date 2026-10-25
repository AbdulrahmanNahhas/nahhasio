# AGENTS.md

## Installed client correction — 2026-10-25

Aqua approved replacing AppImage with Flatpak for Fedora Atomic and other Linux hosts. Nix/devenv
remains development-only. Preserve the rootless server/recovery work. Flatpak/Software owns client
updates; no custom client executable downloader or host-command escape. Use packaging/flatpak/README.md
for current delivery. Historical AppImage requirements below are superseded for this checkpoint.
Aqua subsequently required continuing without agents; do the remaining work in the main chat.

## Active delivery authorization — 2026-10-25

Aqua authorized merging the current branch into local main and implementing all four phases
in docs/DEPLOYMENT.md before consolidated runtime tests. Parallel agents are explicitly authorized.
For this checkpoint the older per-phase/visible-change review stops below are superseded; retain
compile/static checks during coding and defer runtime installation acceptance until code is ready.
Jellyfin/files-only playback and player/provider testing are outside this release. Do not mutate
the live catalog, install on the family PC, publish/push releases or create new implementation
commits merely from this authorization. Development stays independent on Shadow after transfer.

## Project and review boundary

Nahhasio is a private Arabic-first family media server, administration dashboard, and playback
client project. The GitHub repository is AbdulrahmanNahhas/nahhasio; historical @arcadia workspace and database names remain compatible.
Read `docs/PROJECT.md` for the current Alpha direction and long-term target and `docs/ROADMAP.md` for the proposed
task inventory, then `docs/DEVELOPMENT.md` for implementation context.
Current milestone is 0.1 Alpha; not all future roadmap tasks are Alpha requirements.
The target is Fedora Atomic/Podman server + Linux Flatpak client only, with no shipped website.
Approximately 70 Arabic-dubbed works use existing/server-stored files, independently of torrents.
Treat tasks marked DECISION as unresolved until Aqua answers; future client platforms follow v1.0.
Complete one phase, report verification and limits, and stop for Aqua's review. Do not begin
another phase until Aqua asks to continue. The old v0.3.5 plans are historical references.

## Current Linux direction and approval checkpoints

Read `docs/PROJECT.md`, `docs/ROADMAP.md` and `docs/design-rules.md` for current decisions.
The Linux client uses Rust GTK4/libadwaita, WebKitGTK, React/Vite/TypeScript and libmpv.
Preserve Aqua's reviewed desktop design. The retired web dashboard and Hono API are removed;
there is no website runtime. Initial access is LAN,
with admin/family-user accounts. Nahhasio owns catalog/images/tracking; Jellyfin supplies stored
media for native playback. Existing folders are scanned/linked without moving originals.

For this transition, Aqua explicitly requires confirmation after each step or visible change.
Work only within the approved step, show the concrete result and actual checks, then stop.
If Aqua rejects a design, discuss the direction before another implementation pass. Do not
continue polishing, propagate changes, delete a client, or start another milestone silently.
Permission already given for the current step covers its necessary implementation and checks.
Do not create commits without Aqua's explicit confirmation for that checkpoint. Include the actual
command in command-approval requests so Aqua can see what will run.

Earlier checkpoints: image-library checkpoint committed as `d787dd9`; JSON/selection polish
committed as `83f94b0`. People Drawer/credits/selection/JSON/deletion,
then the shared Studios editor, with most-works sort and contribution/reference UX improvements.
Aqua authorized code-quality cleanup and committed People/Studios as `7363237`.
Planet membership movement/assignment was committed as `e439b66`; planet definitions were
committed as `080948b`. Downloads provides queue UX and a grouped local-video library, native
play/folder/recovery/removal actions and storage information. Aqua approved the Downloads design
and authorized fixing its old-process bridge error, committing the changes, private login
persistence, and an early downloadable AppImage/release pipeline. Update documentation with
actual artifact/runtime/CI limits; no release publication or push has been requested.
Aqua committed current card/watched design as `3d12c96` and approved the server connection/login
checkpoint with a cinematic desktop login redesign, committed as `626d3ef`. The approved transition is now three phases, specified in docs/SCHEMA-FOUNDATION.md:
(1) preserved schema migration with backup/restored rehearsal, (2) API/whole-client integration
and Rust runtime administration parity, (3) Nahhasio agent CLI/database/cataloging skills.
Aqua authorized committing the current Phase 2 integration and proceeding directly with Phase 3
CLI/skills, then committing Phase 3. Other phase transitions and commits still require confirmation.
Aqua explicitly chose a local backup under this persistent project's data/backups for the local
schema checkpoint. Independent recovery remains required before production deployment.
Podman foundation and then admin overview follow these phases.
Preserve Aqua's current design.

Current Rust runtime checkpoint (2026-10-19): `crates/catalog-core` shares bounded read-only
pool setup, schema discovery, redaction, guarded operator operations and explicit migrations;
`crates/cli` builds the compiled `nahhasio` binary. All six Planets editor operations now use
shared Rust through the existing authenticated API, with transactional session revalidation,
revision/dependency checks and atomic audit/revision writes. CLI/database and API fixtures passed
on disposable PostgreSQL, including continuation of all 31 migrations with Drizzle in both
directions and Planets operations with the Node worker unavailable. The transfer engine now
enforces the desktop video-filename policy for selection, reads and export; valid video content
and decoder/network safety still need separate validation. No live catalog mutation occurred.
Aqua approved committing this checkpoint and updating these instructions/skills. This does not
authorize publishing/pushing releases or claim Fedora/AppImage installation acceptance.

The installed Nahhasio server runtime is now Rust-only: People/Studios, whole-work reconciliation,
artwork and providers use `crates/catalog-core/src/editor`; the Node subprocess is removed.
The compiled CLI has whole-work schema/template/export/apply and shared `editor` operations,
with guarded writes. The public `bin/nahhasio` launcher now runs the compiled Rust CLI. It supports catalog report
presets/aggregations, media convenience commands, explicit missing-reference imports and JSON
discovery. Keep explicit database selection and write guards; purge retains physical artwork. Preserve API/client
design. Continue isolated PostgreSQL/artwork checks via `bin/test-rust-catalog`; provider credentials,
real Fedora installation and native UI acceptance remain separate. No live catalog writes occurred.
Node/pnpm may remain on development/build machines for React. Jellyfin is playback/streaming
only, with the minimum media identity/track information needed for delivery; never import its
metadata/artwork as catalog authority or synchronize tracking. Provider keys stay server-owned,
managed through authenticated desktop administration with write-only updates and masked status.
Automatic server updates and host-managed Flatpak client updates are the approved target; implement verified artifacts,
compatibility, recovery and state preservation before enabling them. Schema maintenance remains
explicit, never application startup; PostgreSQL/Jellyfin upgrades have separate ownership.
Product priority is database/catalog, images and tracking first. Save work caches metadata/artwork;
server and device video downloads remain separate. Torrent streaming is the main online source;
linked files support completed downloads and deliberately non-torrent works. Torrent streaming
runs on the client only; the server runs acquisition jobs only after explicit Download to server
requests. Files-only/torrent policy is whole-work, with no part/episode overrides initially.
Offline mutations are progress and watched/unwatched only. Jellyfin is the confirmed stored-media backend, with no Jellyfin tracking synchronization.
Whole-work dub metadata, a dubbing-studio organization role, one planet per work, server-owned
episode stills and YouTube trailer links are approved. Do not add edition/version systems,
alternate episode listings or extra availability-label UI.
Use focused compile/static checks during implementation and consolidated acceptance later;
no repeated full suites for small changes, and no mutation tests on the live family catalog.

## Current database baseline — 2026-10-20

Aqua explicitly approved replacing the old migration chain with a baseline of the current database.
`packages/database/drizzle/0000_current_catalog.sql` plus its single snapshot/journal is now the only
active starting point; future changes are additive. The old chain is retained in Git and the private
`data/backups/current-baseline-2026-10-20` recovery checkpoint, not a second migration tree.
A consistent full dump, configured artwork archive and exact old/new migration sources were saved.
Restored rehearsal preserved all 75 public tables and schema, verified all 1,055 artwork hashes and
23 rolled-back constraint assertions; both migration runners and editor fixtures passed. Live adoption
changed only the Drizzle ledger, with locked before/after public-data equality checks. Native status
reports one applied baseline and no pending migrations. Do not rerun the retired creation SQL on the
populated catalog or rehash a ledger to bypass validation. Follow `docs/BASELINE.md`.
The earlier 31-migration fixture results above are historical. Independent recovery, remaining
transactional authorization/readiness fixes and Fedora/native acceptance are still separate gates.
No commit, release publication or push is authorized merely by the baseline adoption.

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
`devenv up` starts PostgreSQL, the Rust API and GTK desktop with dependency ordering. Do not inspect `/saved/nixos-config` without Aqua's permission.

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
Production setup/auth and device, sync, and job authorization remain future work.
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
