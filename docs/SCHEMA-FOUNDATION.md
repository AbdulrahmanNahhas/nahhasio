# Schema, application and agent-tool transition

Approved by Aqua on 2026-10-18. This is three reviewed phases, in order. Each phase ends with
actual verification, known limits and a review checkpoint. No commit is implied.

## Phase 1 — schema and preservation

Completed on the live development database, 2026-10-18: 75 public tables, 30 applied migrations.
The local backup/restored rehearsal preserved the original columns and all rows in 71 tables;
23 disposable integrity assertions passed and every fixture rolled back. Static `pnpm check`
passed; the media-transfer C++ bridge still emits an existing generated-code compiler warning.
This is schema acceptance, not API/client/runtime parity. Phases 2 and 3 remain pending.

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

- [ ] Update the single OpenAPI definition and regenerate its client; keep native boundaries typed.
- [ ] Fix active-member tracking, progress for unsaved works, 90% automatic completion and offline parity.
- [ ] Restrict ordinary viewers to published/non-private works across all queries and projections.
- [ ] Use stable server/device identities while migrating existing URL-scoped device state safely.
- [ ] Wire policy, dubbing, trailers and episode stills through details, browse, filters and administration.
- [ ] Update full work/JSON/bulk documents without dropping omitted or unrelated data.
- [ ] Import episode images from providers or capture available video; retain them as Nahhasio assets.
- [ ] Record image provenance with existing source evidence and preserve manually chosen artwork.
- [ ] Link existing video folders without moving originals; use Jellyfin only as the media backend.
- [ ] Play in Nahhasio with device → server file → permitted torrent preference and a source chooser.
- [ ] Keep progress/watched data entirely in Nahhasio; do not synchronize Jellyfin tracking.
- [ ] Replace the remaining runtime Node editor/provider/artwork worker with Rust before deployment.
- [ ] Add authenticated, bounded backend reads and simple views for unfinished product areas.
- [ ] Inventory all tables against consumers; do not manufacture records to make a table look used.
- [ ] Keep authentication secrets and private operations out of raw client table views.
- [ ] Consolidate regression/native acceptance after integration; do not claim full parity from layout.

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

- [ ] Make `nahhasio` the public CLI name and update discoverable commands/help/examples.
- [ ] Update the database skill to the Nahhasio name and new schema/API workflows.
- [ ] Update the cataloging skill for dub credits, whole-work policy, one planet and image ownership.
- [ ] Provide name/alias/UUID lookup, structured schema/reference discovery and bounded pagination.
- [ ] Improve actionable structured errors, JSON input/output, dry runs, review/apply and idempotency.
- [ ] Keep destructive operations explicit and preserve recovery sources and private credentials.
- [ ] Inventory/retire remaining Arcadia-facing names without accidentally changing database identity,
      catalog UUIDs, persisted device paths, package dependencies or migration history.

Podman foundation follows the approved phases. Production acceptance still requires independent
recovery, trusted artifacts, migration compatibility and a real target-host check.
