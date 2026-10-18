# AGENTS.md

## Project and review boundary

Nahhasio is a private Arabic-first family media server, administration dashboard, and playback
client project. The Git repository remains Arcadia during the rewrite.
Read `docs/PROJECT.md` for the current Alpha direction and long-term target and `docs/ROADMAP.md` for the proposed
task inventory, then `docs/DEVELOPMENT.md` for implementation context.
Current milestone is 0.1 Alpha; not all future roadmap tasks are Alpha requirements.
The target is Fedora Atomic/Podman server + Linux AppImage client only, with no shipped website.
Approximately 70 Arabic-dubbed works use existing/server-stored files, independently of torrents.
Treat tasks marked DECISION as unresolved until Aqua answers; future client platforms follow v1.0.
Complete one phase, report verification and limits, and stop for Aqua's review. Do not begin
another phase until Aqua asks to continue. The old v0.3.5 plans are historical references.

## Current Linux direction and approval checkpoints

Read `docs/PROJECT.md`, `docs/ROADMAP.md` and `docs/design-rules.md` for current decisions.
The Linux client uses Rust GTK4/libadwaita, WebKitGTK, React/Vite/TypeScript and libmpv.
Preserve Aqua's reviewed desktop design. Website/legacy libraries remain transitional consumers
until replacement acceptance; no website ships in the delivered product. Initial access is LAN,
with admin/family-user accounts. Jellyfin/library-adapter choice is pending, not mandatory Alpha.

For this transition, Aqua explicitly requires confirmation after each step or visible change.
Work only within the approved step, show the concrete result and actual checks, then stop.
If Aqua rejects a design, discuss the direction before another implementation pass. Do not
continue polishing, propagate changes, delete a client, or start another milestone silently.
Permission already given for the current step covers its necessary implementation and checks.
Do not create commits without Aqua's explicit confirmation for that checkpoint. Include the actual
command in command-approval requests so Aqua can see what will run.

Current implementation: image-library checkpoint committed as `d787dd9`; JSON/selection polish
committed as `83f94b0`. Current approved checkpoint: People Drawer/credits/selection/JSON/deletion,
then the shared Studios editor, with most-works sort and contribution/reference UX improvements.
Aqua authorized code-quality cleanup and committed People/Studios as `7363237`.
Planet membership movement/assignment was committed as `e439b66`; planet definitions were
committed as `080948b`. Downloads provides queue UX and a grouped local-video library, native
play/folder/recovery/removal actions and storage information. Aqua approved the Downloads design
and authorized fixing its old-process bridge error, committing the changes, private login
persistence, and an early downloadable AppImage/release pipeline. Update documentation with
actual artifact/runtime/CI limits; no release publication or push has been requested.
Aqua committed current card/watched design as `3d12c96` and approved the server connection/login
checkpoint with a cinematic desktop login redesign. Complete this checkpoint for review. The
subsequent order is full Saved Works/offline use, then a detailed database-schema/application-logic
and trusted-update/recovery review **before** Podman foundation, then admin overview. Do not start those stages silently. Awards and work-membership ordering
remain future tasks.
Preserve Aqua's current design.
Product priority is database/catalog, images and tracking first. Save work caches metadata/artwork;
server and device video downloads remain separate. Torrent streaming is the main online source;
linked files support completed downloads and deliberately non-torrent works. Torrent streaming
runs on the client only; the server runs acquisition jobs only after explicit Download to server
requests. Files-only/torrent policy is whole-work, with no part/episode overrides initially.
Offline mutations are progress and watched/unwatched only. Library adapter and file organization
remain open; do not confuse files-only playback with a mandatory Jellyfin dependency.
Use focused compile/static checks during implementation and consolidated acceptance later;
no repeated full suites for small changes, and no mutation tests on the live family catalog.

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
- `apps/web`: dashboard-only TanStack Start/Vite application, TanStack Router/Query, Tailwind 4, app-specific shadcn Base UI.
- Removed website/deployment references remain recoverable at `d77096f:reference/` in Git.
- `crates/native-player`: isolated GTK/libmpv adapter and diagnostic examples.
- `crates/media-transfer`: UI-independent torrent engine and durable device state.
- `apps/api`: previous Hono API, kept until Rust endpoints pass behavior/data checks.
- `packages/database`: existing PostgreSQL schema and the single migration history.
- Other `packages/*`: existing contracts, domain rules, vocabulary, and database CLI.

`apps/linux` contains the Rust GTK shell; `apps/linux/ui` is the separate React/Vite viewing UI.
The rejected Kotlin prototype was retired after a committed checkpoint. Do not create empty packages. Share media behavior in UI-independent Rust and network
contracts through the existing single generated OpenAPI definition.

## Development and checks

Use the repository's Nix/devenv environment: Node 24, pnpm 11.11.0, and Rust.
`devenv up` starts PostgreSQL, the Rust API, dashboard and GTK desktop with dependency ordering. The reference Hono API is available
with `devenv --profile reference-api up`. Do not inspect `/saved/nixos-config` without Aqua's permission.

- `pnpm lint`: Oxlint, the generic anti-slop plugin, and six shadcn design-system rules.
- `pnpm format` / `pnpm format:check`: Oxfmt, the authoritative formatter and import sorter.
- `pnpm typecheck`: TypeScript workspace checks.
- `pnpm check:rust`: new Rust workspace formatting and Clippy with warnings rejected.
- `pnpm check`: all the above. Run before handoff.
- `pnpm build`: TypeScript/website builds and new Rust workspace build.
- `cargo test --workspace --locked`: Rust unit tests, with no live catalog writes.
- `pnpm test:e2e`: new website Playwright journeys; use Chromium from Nix on this machine.

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

## Website rules

These shadcn/TanStack composition rules apply to `apps/web`, the administration dashboard.
The separate viewing-client UI uses its own reviewed design tokens/components and responsive
layout. Preserve accessible labels, keyboard focus/navigation, RTL, reduced motion and typed
HTTP/native-bridge boundaries there as well. The future admin area uses the client
visual language and server-enforced permissions; do not embed the website UI.

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
  TanStack Start server functions bridge the dashboard to private backend operations; route SSR is disabled.
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
`data/nahhasio.db` is a retained SQLite recovery candidate. Recovery tools require an explicit
`ARCADIA_V1_DB_PATH`. Backups and recovery artwork are private and never committed.

The existing CLI is `./bin/arcadia` and talks directly to PostgreSQL. Use the `arcadia-db` skill
for live catalog reads/writes and the `arcadia-cataloging` skill for editorial classification.
Preserve the current Better Auth identity/password ownership during Rust migration; verify
hash compatibility with fixtures before cutover. Do not weaken existing production auth guards.
The legacy test bypass requires both `NODE_ENV=test` and `ARCADIA_MOCK_AUTH=true`.
Do not log secrets, database connection strings, password hashes, or session tokens.

Rust database sessions default to read-only. Explicitly authorized local development catalog
operations require the private server token; writes opt into transactional read-write mode.
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

Aqua now wants administration in the Linux client, retaining its UI language, then website
retirement. The website remains the working dashboard until replacement parity is verified. Cover existing editorial/admin workflows, TMDB, Fanart, images, raw table
inspection, JSON/bulk editing, maintenance, revisions, users/devices, and server operations.
UI routes may be prepared before their services; pending actions must stay visibly disabled.
Do not claim full database control from UI layouts. Connect authorization and transactional
mutations before enabling them. The Linux work page, torrent playback
and device downloads are implemented with documented limits. Jellyfin/home-server jobs and admin
migration follow their own authorization and review.
