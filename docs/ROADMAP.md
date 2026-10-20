# Nahhasio roadmap and task inventory

Updated 2026-10-18. **Current milestone: 0.1 Alpha, a reliable base.**
[PROJECT.md](PROJECT.md) owns confirmed scope. This is the long-term inventory, not a promise
that all tasks ship in Alpha or a fixed v1.0 specification. Linux is the only client through v1.0;
other platforms follow later. No website ships in the delivered product.

For the short page-by-page product checklist, see [FEATURES.md](FEATURES.md). This document
retains implementation, storage, deployment and acceptance tasks.

## Status and use

- The inventory contains **280 tasks across 21 areas**, with stable `NH-*` IDs.
- An unchecked task may have implementation but still need integration/acceptance; it does not
  necessarily mean code is absent. The existing work editor is committed as `8aa716a`.
- `DECISION` items require scope/behavior decisions. Some decisions below are now recorded in
  PROJECT.md; completing their checklist entry means documenting/implementing the chosen result.
- Not every work has or needs downloaded media. The approximately 70 Arabic-dubbed supplied
  works need an independent existing-file library path.
- A checkbox does not authorize an unattended implementation, catalog/schema change or commit.

## 0.1 Alpha foundation shortlist — catalog first

Aqua's clarified priority is database/catalog, images and tracking first. Playback, server
retention, device video and saved-work browsing build on that foundation. These are proposed
checkpoints; detailed implementation order stays subject to review.

- [x] **A01** Jellyfin supplies stored media; Nahhasio owns catalog, images and tracking.
- [ ] **A02** Agree file organization; implement confirmed client streaming, explicit server downloads, whole-work policy and progress/watched offline sync.
- [ ] **A03** Connect the Linux client to a chosen LAN server through the login/server UI.
- [ ] **A04** Establish server identity, version/capabilities and connection/session ownership.
- [ ] **A05** Keep the basic admin/family-user account flow reliable on a separate server.
- [ ] **A06** Scan/link existing videos to catalog work/part/episode identities with manual review.
- [ ] **A07** Play an authorized server file through the native player with seeking/audio/subtitles.
- [ ] **A08** Configure persistent PostgreSQL/artwork/library paths and recovery boundaries.
- [ ] **A09** Build initial Podman and AppImage artifacts without assuming the development checkout.
- [ ] **A10** Improve the highest-priority admin/login/Downloads flows in reviewed slices.
- [ ] **A11** Define explicit Alpha installation/update/backup steps and known limitations.
- [ ] **A12** Run the consolidated Alpha acceptance on isolated data and the target environment.

## Approved three-phase transition — 2026-10-18

The review decisions and execution checklist are in [SCHEMA-FOUNDATION.md](SCHEMA-FOUNDATION.md):
schema/preservation → API and whole client → Nahhasio agent tools/skills. Each phase returns for
review. Phase 1 is committed as `990b704`; the 2026-10-19 existing-screen integration and remaining
Phase 2 runtime items are recorded there. No runtime feature is complete merely because its table
or basic read view exists.

## Required review before Podman deployment

After server connection/login and Saved Works/offline use, complete a detailed schema and logic
review. Cover catalog/work/part/episode identity, relationships, constraints/indexes, vocabularies,
images/assignments and filesystem paths, accounts/profiles/devices/sessions, tracking/offline sync,
media versions/tracks, download/job ownership, editorial revisions and deletion/recovery behavior.
Inspect actual consumers, obsolete/duplicate concepts, performance and migration history. Present
proposed changes with rationale, compatibility/backfill/recovery impact and priorities; retain
catalog UUIDs, user history and artwork. No speculative live cleanup is implicit approval.

Deployment review must cover trusted container/AppImage sources, pinned base images/actions,
release provenance/signatures/digests, least privilege and secrets, persistent volumes, verified
independent backup/restore, explicit migrations, compatibility checks and upgrade health gates.
Define rollback honestly: an older binary may not support a migrated database. Keep an approved
recovery path and stage upgrades against restored data before the family server. Initial Alpha
updates are explicit/confirmed; automatic updates wait for these safeguards and approval.

## Saved-work and playback requirements clarified by Aqua

- [ ] **S01** Save a complete authorized work snapshot and relevant artwork/parts/episode data.
- [ ] **S02** Open/search/browse saved works without a connection to the home server.
- [ ] **S03** Keep Save work independent of downloading video, server retention and favorites.
- [ ] **S04** Resolve permitted torrents from saved identities with internet but no home server.
- [ ] **S05** Play downloaded device video when both home server and internet are unavailable.
- [ ] **S06** Prefer an available selected device/server file without requiring its original torrent.
- [ ] **S07** Store/enforce whole-work files-only policy independently of search/peer failures.
- [ ] **S08** Verify and register completed server downloads against stable catalog episode IDs.
- [ ] **S09** Manage audio/subtitles per media version; preserve originals by default.
- [ ] **S10** Track per-device snapshot readiness/retained files instead of trusting a saved flag.
- [ ] **S11** Refresh cached metadata and sync approved tracking changes with conflict rules.
- [ ] **S12** Keep server/account cache ownership, provider secrets and durable source identities clear.

These clarify intended behavior; Alpha checkpoint sizing remains to be agreed. Client-only torrent streaming, explicit server-run acquisition jobs, whole-work files-only policy
and progress/watched/unwatched offline updates are confirmed. There are no per-part/episode
source-policy overrides or offline ratings/notes mutations in the initial scope.

## Saved Works implementation checkpoint — 2026-10-18

Server connection/login is committed as `626d3ef`. The next approved checkpoint implements
native account/server-scoped work snapshots and referenced artwork, explicit local library access
from login/account menu, saved work browsing/search, existing work-page reuse, client torrent
resolution from saved identities, device-file playback, position/resume and a persistent
progress/watched queue. Reconnect uses owner-scoped compare-and-write with a reviewed conflict
choice. This original checkpoint did not add a schema migration, server acquisition job, Jellyfin
adapter or automatic completion policy; the approved three-phase schema transition supersedes that limit. See DEVELOPMENT.md for ownership, limits and recovery boundaries.

Implementation/static checks and consolidated runtime acceptance are separate: restart/offline,
interrupted writes, cross-account switching, real peer resolution and concurrent sync need the
agreed acceptance pass. Whole-work torrent/files-only policy is now stored/projected and enforced before client torrent lookup;
legacy unscoped videos remain explicitly playable rather than silently claimed. The detailed
the approved schema/API transition and trusted-update/recovery review precede Podman.

## Future work: promote selectively

Complete remaining catalog/admin pages and website retirement; provider imports and asset tools;
advanced maintenance/revisions/restoration; durable server acquisition; offline sync; automatic
subtitle retrieval; optional Jellyfin/transcoding; richer profiles/policies; statistics/graphs;
production update automation and mature release compatibility. These are valuable backlog items,
not prerequisites for every Alpha checkpoint.

LAN is the confirmed initial network scope. Public access/VPN and non-Linux clients remain future.
Guided explicit Alpha upgrades are the default; scheduled automatic upgrades can follow recovery.
The initial accounts are admin and family user; more profiles/policy systems are optional future.
Jellyfin-specific tasks below are conditional on the chosen integration, not mandatory Alpha work.

## Suggested long-term grouping

Catalog/database/images/tracking → complete admin workflows and server storage → source selection,
server files/torrent playback and download destinations → saved-work/device offline experience →
release/connection/deployment integration and consolidated acceptance.
Aqua's chosen checkpoint order governs actual work. The grouping can evolve without rewriting
history or turning unchecked tasks into implicit approval.

## Task inventory

Total: **280 tasks across 21 areas**.

### 00. Scope, decisions and documentation

- [ ] **NH-00-01** Confirm the Fedora Atomic variant, hardware, drives and installation ownership.
- [ ] **NH-00-02** Confirm LAN/VPN/public access and the HTTPS certificate approach.
- [ ] **NH-00-03** Confirm family accounts, viewing profiles and child-policy requirements.
- [ ] **NH-00-04** Confirm manual/confirmed/scheduled server and desktop update policy.
- [ ] **NH-00-05** Confirm which optional capabilities are required for v1.0.
- [ ] **NH-00-06** Record that v1.0 supports the Linux client only and ships no website.
- [ ] **NH-00-07** Record the approximately 70 Arabic-dubbed works as existing server-file sources.
- [ ] **NH-00-08** Inventory active Markdown, code consumers, incoming links and obsolete guidance.
- [ ] **NH-00-09** Consolidate the product direction into one project guide and one release checklist.
- [ ] **NH-00-10** Consolidate development commands, ports, native boundaries and test isolation.
- [ ] **NH-00-11** Consolidate Fedora installation, storage, upgrade and restore instructions.
- [ ] **NH-00-12** Choose the old-note/archive policy and remove superseded active plans accordingly.
- [ ] **NH-00-13** Update AGENTS.md and first-party skill references to current documentation.
- [ ] **NH-00-14** Retain domain/cataloging rules, migration history and material preservation evidence.
- [ ] **NH-00-15** Check documentation links and distinguish implemented code from accepted behavior.

### 01. Server selection and connection

- [ ] **NH-01-01** Expose server identity, display name, API version and supported capabilities.
- [ ] **NH-01-02** Design the add/select/edit/remove server interface in the reviewed desktop language.
- [ ] **NH-01-03** Validate and normalize server URLs through a fixed native connection operation.
- [ ] **NH-01-04** Support configured HTTPS certificates and explain certificate failures clearly.
- [ ] **NH-01-05** DECISION: support the chosen LAN/VPN/public access model and any discovery mechanism.
- [ ] **NH-01-06** Persist server connections and identify the selected server across client restarts.
- [ ] **NH-01-07** Associate sessions, caches, jobs and saved metadata with a server instance ID.
- [ ] **NH-01-08** Cancel requests and isolate data when changing servers.
- [ ] **NH-01-09** Show connection checks, unreachable/offline status and retry behavior.
- [ ] **NH-01-10** Show incompatible client/server versions with an actionable upgrade message.
- [ ] **NH-01-11** Handle server restarts and network loss without losing recoverable user state.
- [ ] **NH-01-12** Remove development-only network error wording from the packaged client.
- [ ] **NH-01-13** Keep server secrets out of browser state and prevent credentials crossing server boundaries.

### 02. Authentication, accounts, profiles and permissions

- [ ] **NH-02-01** Complete the server-selection/login/logout session flow.
- [ ] **NH-02-02** Persist native session credentials using appropriate secure desktop storage.
- [ ] **NH-02-03** Implement safe session expiry, reauthentication and explicit device/session revocation.
- [ ] **NH-02-04** Provide an explicit initial-owner setup and recovery process.
- [ ] **NH-02-05** Require production credentials instead of shipping development demo passwords.
- [ ] **NH-02-06** Complete administrator account creation/edit/disable/password workflows.
- [ ] **NH-02-07** Complete user profile/avatar/password flows against the selected server.
- [ ] **NH-02-08** DECISION: complete multiple viewing profiles and profile switching if required.
- [ ] **NH-02-09** DECISION: implement required child/family content policy controls.
- [ ] **NH-02-10** Apply authorization consistently to catalog, images, media, jobs and mutations.
- [ ] **NH-02-11** Define permissions for server download/import/delete, offline download and administration.
- [ ] **NH-02-12** Handle disabled/banned/demoted users and ownership rules.
- [ ] **NH-02-13** Keep viewing profiles, accounts, devices and library policy distinct.
- [ ] **NH-02-14** Complete login UX: keyboard/focus, pending state, validation and useful errors.

### 03. Storage and media identities

- [ ] **NH-03-01** Define persistent roots for PostgreSQL, artwork, library media, subtitles and staging.
- [ ] **NH-03-02** Define permissions and SELinux labels for the Fedora container mounts.
- [ ] **NH-03-03** Inspect/reuse current media_files, media_tracks and job schemas before adding tables.
- [ ] **NH-03-04** Identify library files independently of machine-specific absolute filesystem paths.
- [ ] **NH-03-05** Model multiple file/audio/quality versions of the same catalog item.
- [ ] **NH-03-06** Retain Arabic-dub/version labels independently of the catalog title language.
- [ ] **NH-03-07** Inspect duration, container, codecs and audio/subtitle track metadata.
- [ ] **NH-03-08** Provide safe server-side file selection within explicitly configured roots.
- [ ] **NH-03-09** Handle file moves, renamed paths, duplicates and missing storage roots.
- [ ] **NH-03-10** Show filesystem availability, used/free space and actionable permission errors.
- [ ] **NH-03-11** Separate temporary/staging/cache files from completed library files.
- [ ] **NH-03-12** Define protected deletion, unlinking and recovery behavior.
- [ ] **NH-03-13** Preserve catalog and viewing identities when files move or external services rescan.
- [ ] **NH-03-14** Prepare additive schema changes with rehearsal/backfill/rollback where necessary.

### 04. Arabic-dubbed library ingest

- [ ] **NH-04-01** Inventory the supplied Arabic-dubbed video files and their existing catalog linkage.
- [ ] **NH-04-02** Confirm naming/layout, series/season/episode numbering and film/special handling.
- [ ] **NH-04-03** Build a selected-root import scan and a dry-run preview.
- [ ] **NH-04-04** Match files to existing work/installment/episode IDs using available evidence.
- [ ] **NH-04-05** Provide manual matching for ambiguous names, specials and multi-episode files.
- [ ] **NH-04-06** Keep uncertain matches pending; never silently attach them to guessed episodes.
- [ ] **NH-04-07** Detect duplicate files and already imported files without duplicate catalog records.
- [ ] **NH-04-08** Inspect and label available Arabic/other audio tracks and embedded subtitles.
- [ ] **NH-04-09** DECISION: provide desktop-to-server upload if copying/scanning alone is insufficient.
- [ ] **NH-04-10** Import/move/copy according to a chosen policy with restart-safe progress.
- [ ] **NH-04-11** Allow adding new files to already existing works without torrent/source data.
- [ ] **NH-04-12** Provide rescans and missing-file reconciliation without removing watched history.
- [ ] **NH-04-13** Make linked files available to the library/playback workflow.
- [ ] **NH-04-14** Record import results, failures and recovery actions.
- [ ] **NH-04-15** Validate the Arabic-dubbed collection mapping before the home-server cutover.

### 05. Artwork and images

Current checkpoint: Linux gallery/table, filters, paging, uploads, assignment/primary/unlink,
protected record deletion and reviewed canonical filename cleanup are implemented. Old paths
retain hard links and resolve the original asset identity. FEATURES.md records source completion;
isolated mutation/rollback and final desktop acceptance remain pending. No automatic purge runs.

- [ ] **NH-05-01** Keep asset identity and owner assignments as distinct records.
- [ ] **NH-05-02** Use stable asset IDs and server-independent references in desktop/network contracts.
- [ ] **NH-05-03** Retain originals and hash-based deduplication.
- [ ] **NH-05-04** Generate bounded thumbnails/variants appropriate for cards, posters and backgrounds.
- [ ] **NH-05-05** Provide image caching/ETags and avoid repeatedly loading full-size originals.
- [ ] **NH-05-06** Complete image library search, filters, paging and assignment inspection.
- [ ] **NH-05-07** Complete upload, replace, select-primary, unlink and restore/recovery workflows.
- [ ] **NH-05-08** Retain provider/source information and distinguish curated from fetched images.
- [ ] **NH-05-09** Reuse assets safely across works, parts, people and studios.
- [ ] **NH-05-10** Show missing/corrupt assets and orphan candidates.
- [ ] **NH-05-11** Define safe cleanup accounting for assignments, drafts and retained revisions.
- [ ] **NH-05-12** Keep generated variants reproducible and originals recoverable.
- [ ] **NH-05-13** Preserve legacy artwork paths while adding any new storage identifiers.
- [ ] **NH-05-14** Back up and restore artwork together with database references.

### 06. Complete work, structure, bulk and JSON editors

- [ ] **NH-06-01** Accept the committed work editor and latest approved desktop design.
- [ ] **NH-06-02** Complete work create/read/review/save behavior across full documents.
- [ ] **NH-06-03** Complete episode/part metadata, ordering, scoring and override workflows.
- [ ] **NH-06-04** Preserve existing UUIDs and reject cross-owner structure IDs.
- [ ] **NH-06-05** Keep episode deletion checks and define a deliberate whole-part/work deletion workflow.
- [ ] **NH-06-06** Complete credits, relationships, external IDs, artwork and awards editing.
- [ ] **NH-06-07** Complete multi-work selection, field/scope projection and hidden-value preservation.
- [ ] **NH-06-08** Complete JSON syntax/contract validation, import/export and structured tree editing.
- [ ] **NH-06-09** Preserve drafts through review failures, conflicts and network errors.
- [ ] **NH-06-10** Protect unsaved navigation, including changes to selected IDs/search on the same route.
- [ ] **NH-06-11** Connect before/after review to atomic authorized saves and recoverable revision records.
- [ ] **NH-06-12** Clean up superseded core editor API/native methods and duplicate contracts.
- [ ] **NH-06-13** Replace the private Node worker with shared Rust services before release (chosen 2026-10-19).
- [ ] **NH-06-14** Ensure provider/library operations used by editors work without the website process.

### 07. Other catalog administration

- [ ] **NH-07-01** Complete people and studio record editors and artwork assignment.
- [ ] **NH-07-02** Complete planets/worlds editor and work membership.
- [ ] **NH-07-03** Complete vocabulary/translation management and slug/reference validation.
- [ ] **NH-07-04** Complete roles/credits management and linked-record inspection.
- [ ] **NH-07-05** Complete award organizations, categories and ceremonies.
- [ ] **NH-07-06** Complete cross-work relationships and external identity management.
- [ ] **NH-07-07** Provide useful cross-work installment and episode management.
- [ ] **NH-07-08** Complete score/analysis and evidence/reference workflows using existing domain rules.
- [ ] **NH-07-09** Provide server pagination, filters and URL-preserved navigation for each catalog view.
- [ ] **NH-07-10** Apply consistent review/save/delete/error/empty/pending behavior.
- [ ] **NH-07-11** Protect links and show affected records before destructive changes.
- [ ] **NH-07-12** DECISION: implement statistics and relationship graphs to the agreed v1.0 scope.
- [ ] **NH-07-13** Replace all existing website catalog workflows needed for retirement.

### 08. Provider configuration and metadata imports

- [ ] **NH-08-01** Provide protected TMDB/Fanart/other supported provider configuration.
- [ ] **NH-08-02** Provide connection/credential checks without displaying secrets.
- [ ] **NH-08-03** Complete explicit metadata/artwork search and record matching.
- [ ] **NH-08-04** Preview imports and preserve manually curated Arabic/editorial fields.
- [ ] **NH-08-05** Resolve external IDs and avoid duplicate catalog entries.
- [ ] **NH-08-06** Handle quotas, unavailable providers, retries and partial results.
- [ ] **NH-08-07** Log safe import outcomes and retain enough provenance to review changes.
- [ ] **NH-08-08** Complete accepted episode/season metadata import workflows.
- [ ] **NH-08-09** Keep provider clients server-owned and callable without the website.
- [ ] **NH-08-10** Remove unused provider/legacy API dependencies only after their consumers are replaced.

### 09. Validation, revisions and data tools

- [ ] **NH-09-01** Complete catalog validation rules and actionable issue lists.
- [ ] **NH-09-02** Provide reviewed repair operations rather than automatic destructive startup cleanup.
- [ ] **NH-09-03** Complete revision history with actor, time and before/after changes.
- [ ] **NH-09-04** Define restoration for full work documents versus raw record revisions.
- [ ] **NH-09-05** Provide guarded deletion/recycle/recovery workflows where needed.
- [x] **NH-09-06** Complete safe schema/table browsing and scoped record inspection.
- [ ] **NH-09-07** Apply explicit table/column/operation permissions to data tools.
- [ ] **NH-09-08** Prevent generic table tools from bypassing business or ownership invariants.
- [ ] **NH-09-09** Provide documented import/export boundaries and input-size limits.
- [ ] **NH-09-10** Preserve atomic batch mutations and stale-write conflict detection.
- [ ] **NH-09-11** Retain audit history without leaking credentials or private tokens.
- [ ] **NH-09-12** Keep the single migration history and test data changes on restored copies.

### 10. Jellyfin connection and library matching

- [ ] **NH-10-01** Confirm whether an existing Jellyfin instance/library must be retained.
- [ ] **NH-10-02** Configure server connection, protected credentials and connection checks.
- [ ] **NH-10-03** Define Jellyfin library and user mappings without conflating Nahhasio accounts.
- [ ] **NH-10-04** Inspect/reuse jellyfin_servers and jellyfin_items mappings.
- [ ] **NH-10-05** Implement an initial library scan and incremental reconciliation.
- [ ] **NH-10-06** Match Jellyfin items/files to catalog identities using provider IDs and file evidence.
- [ ] **NH-10-07** Provide manual resolution for unmatched and conflicting items.
- [ ] **NH-10-08** Handle Jellyfin item-ID/path changes and missing items without deleting catalog data.
- [ ] **NH-10-09** Expose connection state, last scan, failures and rescan controls.
- [ ] **NH-10-10** Recover when Jellyfin is offline or credentials expire.
- [ ] **NH-10-11** Keep curated Nahhasio classification/Arabic metadata authoritative.
- [ ] **NH-10-12** DECISION: define one-way versus two-way progress synchronization and conflict ownership.
- [ ] **NH-10-13** Reconcile Arabic-dubbed versions and multiple files for one catalog episode.
- [ ] **NH-10-14** Ensure Jellyfin access cannot bypass required family/media authorization.

### 11. Server playback and viewing state

- [ ] **NH-11-01** Obtain authorized playback sources from completed server-library files.
- [ ] **NH-11-02** Prefer an available approved library version and let users choose other versions.
- [ ] **NH-11-03** Implement range requests, seeking and interrupted stream recovery.
- [ ] **NH-11-04** Feed remote playback through the contained native player/gateway boundary.
- [ ] **NH-11-05** Keep credentials out of exposed media URLs and logs.
- [ ] **NH-11-06** Support audio/subtitle track metadata and selection for remote library files.
- [ ] **NH-11-07** DECISION: implement Jellyfin remux/transcoding and quality selection if required for v1.0.
- [ ] **NH-11-08** Recover cleanly when the selected server or Jellyfin becomes unavailable.
- [ ] **NH-11-09** Persist progress/watched state under the chosen account/profile/server identity.
- [ ] **NH-11-10** Keep manually watched state distinct from playback-derived completion.
- [ ] **NH-11-11** Preserve resume positions across client/server restarts.
- [ ] **NH-11-12** Prevent concurrent sync/update events from overwriting newer progress silently.

### 12. Durable server downloads and jobs

- [ ] **NH-12-01** Implement server torrent acquisition only after an explicit Download to server request; automatic acquisition remains future scope.
- [ ] **NH-12-02** Implement server-owned job records, scheduling, progress and state transitions.
- [ ] **NH-12-03** Persist jobs through server/container restarts.
- [ ] **NH-12-04** Provide pause/cancel/retry and actionable terminal error states.
- [ ] **NH-12-05** Enforce ownership and administrator controls for server jobs.
- [ ] **NH-12-06** Define download staging, disk reservations/limits and destination roots.
- [ ] **NH-12-07** Verify completed files before making them available in the library.
- [ ] **NH-12-08** Identify/attach downloads to existing work/episode identities.
- [ ] **NH-12-09** Commit safe completed-file placement and recover interrupted imports.
- [ ] **NH-12-10** Trigger/reconcile Jellyfin library scanning after import.
- [ ] **NH-12-11** Keep server acquisition independent from the existing-file Arabic-dub workflow.
- [ ] **NH-12-12** Expose queue/history and safe logs without leaking source credentials.
- [ ] **NH-12-13** Keep media-transfer logic independent of the GTK client.

### 13. Subtitles and Arabic audio

- [ ] **NH-13-01** Confirm Arabic-dubbed and non-dubbed audio/subtitle defaults.
- [ ] **NH-13-02** Discover/select embedded subtitle tracks and local sidecar subtitles.
- [ ] **NH-13-03** Support Jellyfin-provided subtitle discovery and authorized delivery.
- [ ] **NH-13-04** Implement an OpenSubtitles provider behind a replaceable server-owned interface.
- [ ] **NH-13-05** Provide search, result details, manual selection and download errors.
- [ ] **NH-13-06** Match subtitles using work/episode/release/file evidence rather than title alone.
- [ ] **NH-13-07** Retain language, format, source and forced/hearing-impaired flags.
- [ ] **NH-13-08** Support Arabic display, ASS styling/fonts and encoding handling.
- [ ] **NH-13-09** Persist selected subtitles and per-file timing offsets appropriately.
- [ ] **NH-13-10** Include selected subtitles when downloading server media for offline viewing.
- [ ] **NH-13-11** DECISION: add automatic retrieval, retry/backoff and missing-subtitle jobs if required.
- [ ] **NH-13-12** DECISION: evaluate additional providers/Bazarr only against actual coverage needs.
- [ ] **NH-13-13** Support manual import when no usable provider match exists.
- [ ] **NH-13-14** Keep provider quota/authentication handling and credentials on the server.
- [ ] **NH-13-15** Clearly distinguish supplied subtitles from any future generated/transcribed subtitles.

### 14. Downloads page and offline library

- [ ] **NH-14-01** Redesign Downloads using the reviewed desktop layout/components.
- [ ] **NH-14-02** Clearly separate this-device downloads from home-server jobs.
- [ ] **NH-14-03** Show destination, progress, speed, size, status, errors and recovery actions.
- [ ] **NH-14-04** Support downloading completed server-library media for offline viewing.
- [ ] **NH-14-05** Preserve device queue recovery, pause/resume/retry and safe cancellation.
- [ ] **NH-14-06** Provide storage location/free-space settings and missing-location recovery.
- [ ] **NH-14-07** Keep offline metadata/artwork/subtitles available with saved video files.
- [ ] **NH-14-08** Scope offline records and queued sync to the original server/account/profile.
- [ ] **NH-14-09** Define offline playback access and logout/account-switch behavior.
- [ ] **NH-14-10** Synchronize queued progress and watched/unwatched changes after reconnecting; preserve manual watched semantics.
- [ ] **NH-14-11** Support removal of device copies without deleting server-library originals.
- [ ] **NH-14-12** Handle partial files, verification failures and interrupted exports.
- [ ] **NH-14-13** Keep download preparation independent from player/playback sessions.
- [ ] **NH-14-14** Provide searching/filtering/history for large saved and queued collections.

### 15. Desktop viewing and administration experience

- [ ] **NH-15-01** Apply current design consistently to login, profiles, Downloads and remaining approved pages.
- [ ] **NH-15-02** Provide server/connection status and useful notifications for recoverable failures.
- [ ] **NH-15-03** Complete navigation between viewing and admin areas with server-enforced access.
- [ ] **NH-15-04** Keep catalog density, Arabic/RTL focus order and consistent labels.
- [ ] **NH-15-05** Complete relevant narrow-window and keyboard/focus restoration behavior.
- [ ] **NH-15-06** Preserve player controls, audio/subtitle menus, seeking and fullscreen behavior.
- [ ] **NH-15-07** Provide clear media availability and version/dub information on work pages.
- [ ] **NH-15-08** Show local/server source choices without implying torrents are required.
- [ ] **NH-15-09** Handle loading/empty/error states without whole-catalog client fetches.
- [ ] **NH-15-10** Keep desktop UI dependencies and API boundaries ready for future clients without building them.
- [ ] **NH-15-11** Document remaining platform/input/rendering limits honestly.

### 16. Server operations and backups

- [ ] **NH-16-01** Complete server settings and integration status pages.
- [ ] **NH-16-02** Provide library/storage usage, job status and safe operational logs.
- [ ] **NH-16-03** Provide account/device/session administration and audit visibility.
- [ ] **NH-16-04** Implement explicit consistent database backup procedures.
- [ ] **NH-16-05** Back up artwork/configuration/secrets with the appropriate storage policy.
- [ ] **NH-16-06** DECISION: choose whether video files need separate backup or a documented recovery source.
- [ ] **NH-16-07** Define backup retention, destination, failures and last-success reporting.
- [ ] **NH-16-08** Implement and rehearse restore to a separate server/database.
- [ ] **NH-16-09** Verify restored UUIDs, counts, links, artwork and viewing state.
- [ ] **NH-16-10** Provide pre-upgrade backup/preflight and maintenance status.
- [ ] **NH-16-11** Ensure updates/restarts do not silently run migrations or seed/cleanup data.
- [ ] **NH-16-12** Document recovery from unavailable storage, failed migration and failed update.

### 17. Fedora Atomic deployment

- [ ] **NH-17-01** Build a versioned server container with every required runtime dependency.
- [ ] **NH-17-02** Prove the installed server/editor/migration runtime works with Node absent.
- [ ] **NH-17-03** Provide Quadlet/systemd units with the chosen rootless/service ownership.
- [ ] **NH-17-04** Configure PostgreSQL networking, persistent volumes and readiness ordering.
- [ ] **NH-17-05** Configure artwork/media/subtitle/staging mounts with Fedora permissions/SELinux labels.
- [ ] **NH-17-06** Configure HTTPS and the approved network exposure.
- [ ] **NH-17-07** Keep private database credentials/provider keys out of images and committed files.
- [ ] **NH-17-08** Implement readiness/health/version endpoints suitable for deployment tooling.
- [ ] **NH-17-09** Handle graceful shutdown, startup recovery and service restart policies.
- [ ] **NH-17-10** Document Fedora firewall, boot startup and any GPU/transcoding device permissions.
- [ ] **NH-17-11** Provide explicit owner setup and one-time migration commands.
- [ ] **NH-17-12** Install locally from documented release artifacts without relying on devenv/source checkout.
- [ ] **NH-17-13** Prove reboot recovery and persistent library/database availability.

### 18. Server updates and compatibility

- [ ] **NH-18-01** Publish immutable versioned container tags/digests to the chosen registry.
- [ ] **NH-18-02** Define stable release channels and supported client/API compatibility.
- [ ] **NH-18-03** Provide a release/migration manifest and current/update version reporting.
- [ ] **NH-18-04** Implement verified automatic server application updates, gated by compatibility, backup/recovery and explicit schema maintenance.
- [ ] **NH-18-05** Run preflight checks and backups before schema-affecting updates.
- [ ] **NH-18-06** Run schema migrations explicitly with a maintenance lock and recoverable logs.
- [ ] **NH-18-07** Keep safe schema compatibility with the previous supported client/server where required.
- [ ] **NH-18-08** Validate readiness after updating and report failed activation.
- [ ] **NH-18-09** Provide application-image rollback and a separate database recovery plan.
- [ ] **NH-18-10** Document that container rollback cannot automatically undo schema/data migrations.
- [ ] **NH-18-11** DECISION: define Jellyfin/PostgreSQL update ownership separately from Nahhasio updates.

### 19. AppImage and GitHub release pipeline

An initial x86_64 AppImage is built locally; `bin/nahhasio-appimage` and the draft-release
workflow implement packaging. The local preview uses the dev profile; CI uses release.
The checkboxes below retain supported-platform/runtime, CI and publication acceptance gates.

- [ ] **NH-19-01** Build an early AppImage prototype and establish the supported Linux baseline.
- [ ] **NH-19-02** Package GTK/libadwaita/WebKitGTK/mpv and required runtime assets correctly.
- [ ] **NH-19-03** Inspect native dynamic libraries, glibc compatibility, graphics/audio and codec dependencies.
- [ ] **NH-19-04** Include desktop metadata, icon and application identity.
- [ ] **NH-19-05** Run without the repository/devenv or development port assumptions.
- [ ] **NH-19-06** Connect a packaged client to a separately running server through the chooser.
- [ ] **NH-19-07** Build reproducible release artifacts in GitHub CI.
- [ ] **NH-19-08** Publish versioned AppImages, checksums/signatures and release notes.
- [ ] **NH-19-09** Implement verified automatic AppImage updates with atomic replacement, failure recovery and persistent-state preservation.
- [ ] **NH-19-10** Keep user connections/settings/downloads across desktop updates.
- [ ] **NH-19-11** Handle unsupported server versions and failed/partial client updates.
- [ ] **NH-19-12** Validate Wayland/XWayland behavior on the chosen supported systems.
- [ ] **NH-19-13** Document launch/runtime requirements, including any AppImage/FUSE limitations.
- [ ] **NH-19-14** DECISION: target additional Linux architectures only if required for v1.0.

### 20. Consolidated acceptance and website retirement

- [ ] **NH-20-01** Run the meaningful consolidated browser/native/API regression after implementation phases.
- [ ] **NH-20-02** Use restored disposable databases for mutation, migration and rollback acceptance.
- [ ] **NH-20-03** Exercise all admin/member/profile/policy permission paths.
- [ ] **NH-20-04** Exercise create/edit/bulk/JSON/delete/restore, stale edits and failed transactions.
- [ ] **NH-20-05** Exercise the supplied Arabic-dubbed library and uncertain/missing/duplicate-file scenarios.
- [ ] **NH-20-06** Exercise remote direct play, selected audio/subtitles, resume and network loss.
- [ ] **NH-20-07** Exercise required Jellyfin sync/transcoding and unavailable-service recovery.
- [ ] **NH-20-08** Exercise server/device downloads, disk-full cases and restart recovery.
- [ ] **NH-20-09** Exercise offline playback and reconnection under the agreed access policy.
- [ ] **NH-20-10** Exercise Fedora boot, update, failed-update recovery and independent backup restore.
- [ ] **NH-20-11** Exercise freshly installed/released AppImages and upgrade compatibility.
- [ ] **NH-20-12** Inspect real GTK layouts/focus/RTL/input behavior; distinguish fixtures from physical input.
- [ ] **NH-20-13** Compare every existing website workflow against its accepted client replacement.
- [x] **NH-20-14** Retire the web dashboard, Hono API and their development/build wiring (2026-10-20).
- [ ] **NH-20-15** Remove unused legacy API/worker/provider/contract code only after consumer inventory.
- [ ] **NH-20-16** Update active guides and commands to the final server/Linux-client product.
- [ ] **NH-20-17** Publish v1.0 artifacts, installation/update/restore guides and known limitations.
