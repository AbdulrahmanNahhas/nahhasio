# Schema, application and agent-tool transition

Approved by Aqua on 2026-10-18. This is three reviewed phases, in order. Each phase ends with
actual verification, known limits and a review checkpoint. No commit is implied.

## Phase 1 — schema and preservation

Completed on the live development database, 2026-10-18: 75 public tables, 30 applied migrations.
The local backup/restored rehearsal preserved the original columns and all rows in 71 tables;
23 disposable integrity assertions passed and every fixture rolled back. Static `pnpm check`
passed; the media-transfer C++ bridge still emits an existing generated-code compiler warning.
This is schema acceptance, not API/client/runtime parity. Phase 1 is committed as `990b704`.
The Phase 2 existing-screen integration is committed as `9bd5122`; its remaining runtime work
is deferred below. Aqua authorized Phase 3 tooling now, separately from those runtime tasks.

- [x] Back up PostgreSQL and artwork in the persistent project `data/backups/` directory.
- [x] Verify archive checksums, restore a disposable database and compare all original data.
- [x] Replace only the never-applied TVDB removal proposal with the Nahhasio foundation migration.
- [x] Retain existing TVDB columns/values, UUIDs, artwork paths, identities, notes and history.
- [x] Add server identity, device registry, selected library roots and YouTube trailers.
- [x] Add whole-work torrent/files-only policy, dub languages and dubbing notes.
- [x] Permit custom contribution roles and add an organization dubbing-studio role.
- [x] Enforce one planet per work; retain the membership's featured rank on unchanged assignments.
- [x] Add the episode `still` artwork role; retain existing assignments and assets.
- [x] Extend files, embedded/external subtitle tracks, device downloads, jobs and playback revisions.
- [x] Strengthen nullable uniqueness, variant ownership, awards and same-work comment replies.
- [x] Keep one canonical personal rating with compatibility synchronization for review writers.
- [x] Verify valid/invalid writes only on a disposable database; roll back every fixture.
- [x] Apply the exact rehearsed migration explicitly and verify original-table content afterward.

Aqua chose a backup on this machine for this local development checkpoint. It covers migration
recovery, not loss of the whole machine. An independent copy remains a deployment requirement.
Private dumps, artwork archives, fingerprints and rehearsal/apply receipts must never be committed.

### Explicit maintenance

Run inside `devenv shell`; these tools are never called from application startup:

```sh
cd packages/database
node --import tsx scripts/foundation-checkpoint.ts backup /absolute/project/data/backups/unique-checkpoint
node --import tsx scripts/foundation-checkpoint.ts rehearse /absolute/project/data/backups/unique-checkpoint
node --import tsx scripts/foundation-checkpoint.ts apply /absolute/project/data/backups/unique-checkpoint
```

The rehearsal restores the dump, validates the artwork archive, migrates the restored database,
exercises constraints in a rolled-back transaction, and compares every original column's content.
The apply step requires matching backup checksums, an exact migration/acceptance receipt and an
unchanged live baseline. It does not automatically revert a migrated live database on failure.
Stop and inspect failures. Never restore an older dump over newer catalog edits without review.

Normal migration commands no longer rehash/merge artwork. The legacy recovery command is
`pnpm --filter @arcadia/database db:prepare-legacy-media` and requires its own reviewed backup.
The explicit migration runner uses a shared advisory maintenance lock.

Database functions/triggers are owned by the same Drizzle SQL migration history as the tables.
They cover language-array validation, role/entity compatibility, playback revisions and rating
compatibility. Drizzle table snapshots alone do not describe those functions. Keep their SQL in
the migration history; do not introduce a second SQLx migration ledger.

## Phase 2 — API and whole-client integration

- [x] Update the single OpenAPI definition and regenerate its client; keep native boundaries typed.
- [x] Fix active-member tracking, progress for unsaved works, 90% automatic completion and offline parity.
- [x] Restrict ordinary viewers to published/non-private works across all queries and projections.
- [x] Use stable server/device identities while migrating existing URL-scoped device state safely.
- [x] Wire policy, dubbing, trailers and episode stills through details, browse, filters and administration.
- [x] Update full work/JSON/bulk documents without dropping omitted or unrelated data.
- [x] Select/upload episode stills or preview/import TMDB stills; retain them as Nahhasio assets.
- [ ] Capture episode stills from available video files.
- [x] Record image provenance with existing source evidence and preserve manually chosen artwork.
- [ ] Link existing video folders without moving originals; use Jellyfin only as the media backend.
- [ ] Play in Nahhasio with device → server file → permitted torrent preference and a source chooser.
- [x] Keep progress/watched data entirely in Nahhasio; do not synchronize Jellyfin tracking.
- [ ] Replace the remaining runtime Node editor/provider/artwork worker with Rust before deployment.
- [x] Add authenticated, bounded backend reads and simple views for unfinished product areas.
- [x] Inventory all tables against consumers; do not manufacture records to make a table look used.
- [x] Keep authentication secrets and private operations out of raw client table views.
- [ ] Consolidate regression/native acceptance after integration; do not claim full parity from layout.

Rust runtime migration started 2026-10-19: a compiled operator CLI and shared Rust pool/schema/
redaction/migration services are implemented. Planets definition and membership operations now
use shared Rust behind the existing authenticated editor API, including transactional session
revalidation, stale-revision checks, dependency guards and audit/revision records. The isolated
acceptance script exercises these with the Node worker unavailable and checks Drizzle/Rust ledger
continuation in both directions. Whole-work reconciliation, People/Studios, artwork/providers and
full operator CLI parity remain; the worker-removal checkbox is intentionally still open.

### Phase 2 integration checkpoint — 2026-10-19

Aqua authorized the Phase 1 commit and the existing-screen integration. No new route/page was added.
This integration checkpoint is committed as `9bd5122`. Existing work editing includes whole-work source
policy, dub languages/notes, ordered YouTube trailers, credit languages and per-episode stills.
Episode images use the existing native artwork boundary in work details, episode lists and player
selection; TMDB imports record source evidence and manual/upload/library choices remain explicit.
People/Studios share role/language filters and preserve credit languages through normal/JSON edits.
Public entity directories expose the recorded contribution roles and languages. Browse receives
policy, dubbing and role facets. Members see published/non-private works only.

All 75 tables are inspectable from existing admin sections, with pagination/search, full row details
and field/type/nullability/default/enum metadata. Secrets are masked in the server projection before
any response; nested audit/job payloads are scrubbed. These are read views, not generic write tools
or claims that every future service/job is operational. Existing dedicated editors remain the write
boundary. Backups, updates, graph, validation and statistics actions remain unavailable.

Tracking-only device records now cover unsaved works without listing them as saved metadata.
Absolute queued changes carry revisions, retain conflict choices and apply 90% automatic completion
without overriding manual watched/unwatched choices. Registration associates sessions and tracking
with a durable installation. Server identity maps new verified addresses to the original storage
namespace; existing videos/preferences/packs retain their paths. Credentials stay address-scoped.
Conflicting independent local libraries or a changed server identity fail closed without deletion.

A restored disposable catalog acceptance checked all 75 table reads and generated-column flags,
secret masking/admin isolation, work review/save/reload (policy/dubs/trailers/episode still), public
projections/facets, People/Studios filtering, device registration, member tracking, retry behavior,
manual override and draft exclusion: **276 assertions passed**. No family catalog mutation was used.
Fresh UI, server and Linux builds pass. Browser fixtures at 1440×1000 and 520×900 produced six
reviewed captures with no page errors or narrow work-page overflow. A focused packaged GTK/WebKit
run at 1440×793 CSS pixels, DPR 2 passed all nine checks, including login, new work fields, episode
image controls, table inspector/drawer and logout, with zero JS/CSP errors and unexpected routes.
This is a focused integration pass, not physical input/GPU/playback or full Phase 2 acceptance.

Remaining Phase 2 work is explicit: video-derived still capture, folder scanning/linking and the
Jellyfin/native server-file source workflow, and removal of the remaining private Node editor/
provider/artwork worker after Rust parity. The broader phase is not complete. Aqua authorized proceeding with Phase 3 tools while retaining
these runtime tasks for later. A table view does not complete these runtime services or deployment acceptance.

### Complete database coverage boundary

Every table must have a documented service owner. A basic read view is not an implemented mutation,
job executor, recovery operation or family feature. Internal tables need real backend use, not public
record dumps. Counts/schema/status can be shown where rows would expose credentials or private data.

| Tables                                                                                                                                                                                                   | Owner and intended exposure                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `titles`, `installments`, `episodes`, `installment_scores`                                                                                                                                               | Catalog/editor; authorized viewer projections and admin editors.                                                             |
| `title_aliases`, `title_trivia`, `title_relations`, `external_identities`, `source_evidence`                                                                                                             | Catalog references/relations; admin inspection and selected viewer fields.                                                   |
| `genres`, `tones`, `tags`, `countries`, `vocabulary_labels`, `title_genres`, `title_tones`, `title_tags`, `title_countries`                                                                              | Vocabulary/editor/filter services.                                                                                           |
| `entities`, `entity_aliases`, `roles`, `contributions`, `organization_relations`                                                                                                                         | People/studios and credits; whole-work credits only.                                                                         |
| `planets`, `title_planets`                                                                                                                                                                               | Planet definitions and single-planet membership.                                                                             |
| `award_organizations`, `award_categories`, `award_ceremonies`, `award_recognitions`                                                                                                                      | Awards service; basic admin reads before the full editor.                                                                    |
| `media_assets`, `media_asset_assignments`                                                                                                                                                                | Server image library, including episode stills and generated variants.                                                       |
| `media_files`, `media_tracks`, `library_roots`, `jellyfin_servers`, `jellyfin_items`                                                                                                                     | Server media service; admin path/configuration reads, authorized viewer playback projections.                                |
| `title_trailers`                                                                                                                                                                                         | Work trailers; validated YouTube IDs, language, primary choice and ordering.                                                 |
| `server_instance`, `devices`, `account_downloads`                                                                                                                                                        | Server/device ownership; own-device operations and bounded admin views.                                                      |
| `accounts`, `account_preferences`, `account_title_states`, `account_playback_states`, `account_view_history`                                                                                             | Account/personal services; own-account reads and mutations. View history means catalog visits, not a new playback-event log. |
| `auth_users`, `auth_accounts`, `auth_sessions`, `auth_verifications`, `account_invites`                                                                                                                  | Authentication/invitations; public/admin projections omit passwords, tokens, hashes and secret verification material.        |
| `account_capabilities`, `account_content_policies`, `account_admin_restrictions`, `account_title_blocks`, `account_tag_blocks`, `account_genre_blocks`, `account_entity_blocks`, `account_planet_blocks` | Authorization; enforced services and redacted admin policy inspection. Unsupported policies remain fail-closed.              |
| `title_reviews`, `title_comments`, `review_reactions`, `comment_reactions`, `notifications`                                                                                                              | Family discussion/inbox; private or published projections, never unrestricted cross-account dumps.                           |
| `collections`, `collection_contributors`, `collection_items`, `saved_views`, `title_follows`                                                                                                             | Account/family library organization and follows.                                                                             |
| `family_recommendations`, `family_events`, `family_event_candidates`, `family_event_votes`                                                                                                               | Family recommendations/events; keep the existing schema and start with authorized basic reads.                               |
| `background_jobs`, `audit_logs`, `editorial_revisions`                                                                                                                                                   | Administration and recovery; bounded, redacted admin views. A visible job row does not imply its worker exists.              |

Do not add editions, alternate episode lists, extra availability-label UI, chat/household/friendship
tables, additional client platforms or a shipped website. Preserve the reviewed desktop design.

## Phase 3 — Nahhasio agent tools and guidance

- [x] Make `nahhasio` the public CLI name and update discoverable commands/help/examples.
- [x] Update the database skill to the Nahhasio name and new schema/API workflows.
- [x] Update the cataloging skill for dub credits, whole-work policy, one planet and image ownership.
- [x] Provide name/alias/UUID lookup, structured schema/reference discovery and bounded pagination.
- [x] Improve actionable structured errors, JSON input/output, dry runs, review/apply and idempotency.
- [x] Keep destructive operations explicit and preserve recovery sources and private credentials.
- [x] Inventory/retire remaining Arcadia-facing names without accidentally changing database identity,
      catalog UUIDs, persisted device paths, package dependencies or migration history.

Podman foundation follows the approved phases. Production acceptance still requires independent
recovery, trusted artifacts, migration compatibility and a real target-host check.

### Phase 3 tooling checkpoint — 2026-10-19

The public entry is `./bin/nahhasio`; `bin/arcadia` remains a silent compatibility wrapper.
Agent skills are now `nahhasio-db` and `nahhasio-cataloging`. Public help/examples use Nahhasio;
`work schema --json` exposes the current input schema without a database connection. New resource
aliases cover server/device/library roots/trailers/files/tracks/downloads/Jellyfin and playback.
Lists are bounded to 1–500 rows (default 50) with offsets; invalid apply modes fail explicitly.
Existing name/alias/UUID resolution, transactional dry runs, audited writes and export/apply remain.
The template includes new fields and no fabricated provider ID; health omits connection credentials.
Preferred audit/artwork environment variables use NAHHASIO names with legacy fallbacks.

Internal workspace package scopes, database name, UUIDs, artwork paths, migration history and
legacy recovery/auth variables remain intentionally compatible. No catalog data was changed for
this tooling checkpoint. The earlier Phase 2 runtime tasks remain unchecked; this checkpoint does
not imply production, Jellyfin playback or worker parity.

Verification: `pnpm check` passed (lint, formatting, TypeScript, Rust formatting/Clippy; existing
C++ bridge warning remains). Focused read-only CLI checks discovered all 75 tables, resolved the
10 new aliases, exported a real work, validated the work template/export against the current
contract, checked JSON help/compatibility output and rejected invalid pagination/apply mode.
Both skills passed YAML frontmatter/name validation using the installed YAML parser (the bundled
Python validator lacked PyYAML). No live catalog write or repeated application suite was run.
