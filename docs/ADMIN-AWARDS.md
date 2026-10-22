# Awards administration — exploration revision, 2026-10-22

## Current experience

The organization rail sits on the **left** of the result workspace, opposite the main administration
navigation on the right. Narrow windows collapse organization selection and the filter panel.
The existing Maia/Mist tokens, Arabic fonts, RTL behavior and official primitives remain intact.

Recognitions open in a compact poster-card view, with a table alternative. Both show the work,
release year, award organization, category, award year, winner/nominee status, part scope and source.
Cards additionally show featured status and notes, with actions for full details, the viewing page
and the work's Awards editor. Missing posters use the existing Artwork fallback; registered poster
bytes travel through the native artwork gateway. External source links accept HTTP(S) only.

Filters are URL-owned and run on the server **before** pagination:

- Organization, searchable category and ceremony reference pickers, and award year.
- Winner/nominee, featured-only and documented/missing-source filters.
- Text search including the work name; newest/oldest/name ordering.
- Grid/table presentation, removable category/ceremony/year filters and a reset action.

Changing organizations or definition tabs clears recognition filters. Clicking a category opens
its recognitions; clicking a ceremony's year opens that organization's recognitions for the year,
including entries without a ceremony link. A year button on a recognition retains other filters but
clears a specific ceremony. Browser Back restores the preceding filter/view state.

Definition tables retain editing and full-record inspection. Organization/category/ceremony names
open related results, and definition rows show recognition, distinct-work and winner counts.
Organization descriptions are expandable to keep browsing compact.

## Editing and ownership

Organizations, categories and ceremonies have strict shared validation, before/after review,
unsaved-draft protection, stale-record rejection and linked-record deletion guards. Successful
mutations write audit and editorial revision records in the same transaction. The existing bounded,
authenticated Rust editor facade revalidates/locks administrator sessions for mutations.

Recognition creation/removal and editing use the work editor's Awards section, preserving part
ownership, ordering, featured status, notes and sources in its existing reconciliation flow.
Definition changes retain historical recognition display strings. UUIDs and timestamps are readable
system fields. No schema migration, live catalog read/write, commit, push or server restart was
performed for the exploration revision.

## Verification

- Four Playwright journeys passed against a freshly built production preview on isolated port
  **23119**, using Nix Chromium at **1440×1000** and **520×900**. The private config is
  `/tmp/nahhasio-awards-v2.config.mjs`; the committed spec is
  `apps/linux/ui/tests/admin-awards.spec.ts`.
- Coverage includes save review, failed-save draft retention, Escape protection, left-rail geometry,
  loaded poster images, category/year navigation, grid/table switching, featured filtering, reset,
  browser history and narrow-window overflow/collapse. The existing Planets keyboard/search journey
  also passes. Screenshots use explicitly synthetic catalog/poster fixtures, not family data.
- Current focused `editor_postgres` acceptance passed on a fresh migrated, socket-only PostgreSQL
  cluster. It verifies all filter dimensions, combined filters, invalid years, enriched work/poster
  fields, CRUD, authorization, revisions, dependencies and audit parity. The harness requires the
  existing `/tmp/nahhasio-catalog.*` isolation guard. The earlier first-checkpoint full
  `bin/test-rust-catalog` pass remains historical evidence, not a rerun for this revision.
- `pnpm check` passed lint, repository formatting and workspace TypeScript checks, then stopped on
  the existing deprecated `fetch_update` call in `crates/media-transfer/src/lib.rs:461`.
  Focused catalog/server Clippy with warnings rejected passed. Final UI build/type checks also pass
  as part of the isolated preview run.
- Private desktop/narrow screenshots under ignored `data/previews/admin-awards-explore*.png` were
  inspected. Final GTK/WebKit visual/physical-input acceptance was **not** established. The earlier
  first-checkpoint native probe navigated synthetic views at 708×793 but produced no compositor
  screenshots, and does not certify this revision. No CSP/auth/origin guard was relaxed.

## Source boundaries

- `packages/contracts/src/admin-awards.ts`: definition validation and filter contracts.
- `crates/catalog-core/src/editor/awards.rs`: bounded server reads and guarded writes.
- `apps/linux/ui/src/features/admin/awards/`: queries, filters, results, page and definition editor.
- OpenAPI, Rust validation and native TypeScript call bindings are generated from shared contracts.
