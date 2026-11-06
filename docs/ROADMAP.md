# Nahhasio roadmap and task inventory

Current delivery order (2026-10-25): [the four-phase deployment checkpoint](DEPLOYMENT.md)
owns the rootless installation, recovery/transfer, signed updates and maintenance checkpoint.
The code is implemented; complete build and installation acceptance remains pending.
Direct stored-file playback and the wider admin backlog follow this release. Player/provider
testing is not a release phase. Historical unchecked entries are not an implementation audit.

Updated 2026-10-25. **Current milestone: 0.1 Alpha, a reliable base.**
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

- [x] **A01** Nahhasio supplies stored-media streaming directly; Jellyfin is retired. Catalog, images and tracking remain authoritative.
- [ ] **A02** Agree file organization; implement confirmed client streaming, explicit server downloads, whole-work policy and progress/watched offline sync.
- [ ] **A03** Connect the Linux client to a chosen LAN server through the login/server UI.
- [ ] **A04** Establish server identity, version/capabilities and connection/session ownership.
- [ ] **A05** Keep the basic admin/family-user account flow reliable on a separate server.
- [ ] **A06** Scan/link existing videos to catalog work/part/episode identities with manual review.
- [ ] **A07** Play an authorized server file through the native player with seeking/audio/subtitles.
- [ ] **A08** Configure persistent PostgreSQL/artwork/library paths and recovery boundaries.
- [ ] **A09** Build initial Podman and Flatpak artifacts without assuming the development checkout.
- [ ] **A10** Improve the highest-priority admin/login/Downloads flows in reviewed slices.
- [ ] **A11** Define explicit Alpha installation/update/backup steps and known limitations.
- [ ] **A12** Run the consolidated Alpha acceptance on isolated data and the target environment.

## Current hosting priority

Follow [DEPLOYMENT](DEPLOYMENT.md): build and accept signed artifacts, install rootless Fedora
services, rehearse recovery, transfer the verified catalog, then verify reboot/LAN/updates. Schema
and Rust-service foundations are implemented; their historical phase plan is in Git. No playback
or provider test phase is required for this release. Remaining administration work follows hosting.

The future remote operator CLI uses a server URL and API key from Shadow, backed by authorized
HTTPS catalog operations. It is deferred; the existing CLI is still a direct-database operator.

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

## Future work: promote selectively

Complete remaining catalog/admin pages; provider imports and asset tools;
advanced maintenance/revisions/restoration; durable server acquisition; offline sync; automatic
subtitle retrieval; optional future transcoding; richer profiles/policies; statistics/graphs;
production update automation and mature release compatibility. These are valuable backlog items,
not prerequisites for every Alpha checkpoint.

LAN is the confirmed initial network scope. Public access/VPN and non-Linux clients remain future.
Guided explicit Alpha upgrades are the default; scheduled automatic upgrades can follow recovery.
The initial accounts are admin and family user; more profiles/policy systems are optional future.
The former Jellyfin integration is replaced by direct Nahhasio delivery; installed media acceptance remains separate from source checks.

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

### 10. Managed server media (decision updated 2026-11-04)

- [x] **NH-10-01** Inspect the old library, retain the three selected collections and retire Jellyfin.
- [x] **NH-10-02** Define managed roots and an explicit worker/API installation preparation command.
- [x] **NH-10-03** Keep viewer access, device downloads and administrator acquisition separate.
- [x] **NH-10-04** Reuse library_roots, media_files, media_tracks and background_jobs; retain historical Jellyfin tables.
- [ ] **NH-10-05** Accept full scans and reconciliation on the installed library.
- [x] **NH-10-06** Provide explicit work/part/episode file mapping and filename suggestions.
- [x] **NH-10-07** Review creation of missing catalog parts/episodes before acquisition.
- [x] **NH-10-08** Preserve catalog/tracking when files are missing, replaced or retired.
- [ ] **NH-10-09** Complete installed library coverage, rescan and job observability acceptance.
- [x] **NH-10-10** Report unavailable server files independently of internet providers.
- [x] **NH-10-11** Keep curated Arabic metadata and artwork authoritative.
- [x] **NH-10-12** Keep tracking in Nahhasio; no Jellyfin progress synchronization.
- [x] **NH-10-13** Support multiple file records without introducing an edition/version model.
- [ ] **NH-10-14** Accept native streaming, device isolation and revoked access on installed artifacts.

### 11. Server playback and viewing state

- [ ] **NH-11-01** Obtain authorized playback sources from completed server-library files.
- [ ] **NH-11-02** Prefer an available approved library version and let users choose other versions.
- [ ] **NH-11-03** Implement range requests, seeking and interrupted stream recovery.
- [ ] **NH-11-04** Feed remote playback through the contained native player/gateway boundary.
- [ ] **NH-11-05** Keep credentials out of exposed media URLs and logs.
- [ ] **NH-11-06** Support audio/subtitle track metadata and selection for remote library files.
- [ ] **NH-11-07** DECISION: implement future remux/transcoding and quality selection if required for v1.0.
- [ ] **NH-11-08** Recover cleanly when the selected server becomes unavailable.
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
- [ ] **NH-12-10** Publish verified imported files directly to Nahhasio media inventory.
- [ ] **NH-12-11** Keep server acquisition independent from the existing-file Arabic-dub workflow.
- [ ] **NH-12-12** Expose queue/history and safe logs without leaking source credentials.
- [ ] **NH-12-13** Keep media-transfer logic independent of the GTK client.

### 13. Subtitles and Arabic audio

- [ ] **NH-13-01** Confirm Arabic-dubbed and non-dubbed audio/subtitle defaults.
- [ ] **NH-13-02** Discover/select embedded subtitle tracks and local sidecar subtitles.
- [ ] **NH-13-03** Support authorized stored-file subtitle discovery and delivery if required later.
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
- [ ] **NH-18-11** DECISION: define media-worker/PostgreSQL update ownership separately from Nahhasio updates.

### 19. Flatpak and signed release pipeline

Flatpak supersedes the initial AppImage prototype. See [the supported packaging guide](../packaging/flatpak/README.md).
The historical prototype remains recoverable in Git; no installed acceptance is implied by source checks.

- [ ] **NH-19-01** Build the x86_64 Flatpak against the supported GNOME SDK baseline.
- [ ] **NH-19-02** Verify runtime GTK/WebKitGTK and bundled mpv/torrent/helper dependencies.
- [ ] **NH-19-03** Inspect native ABI, graphics/audio and codec dependencies.
- [ ] **NH-19-04** Validate desktop metadata, icon and stable application identity.
- [ ] **NH-19-05** Run without the repository/devenv or development port assumptions.
- [ ] **NH-19-06** Connect the installed client to a separate LAN server through the chooser.
- [ ] **NH-19-07** Accept the cached conventional Flatpak Builder CI pipeline.
- [ ] **NH-19-08** Publish signed Flatpak commits/repository metadata and versioned release notes.
- [ ] **NH-19-09** Verify Software/Flatpak update behavior under the chosen host policy.
- [ ] **NH-19-10** Preserve client state and device videos across updates; review legacy state imports separately.
- [ ] **NH-19-11** Handle unsupported API versions and failed/partial client updates.
- [ ] **NH-19-12** Validate Wayland/XWayland behavior on supported systems.
- [ ] **NH-19-13** Validate portal file selection and minimal filesystem permissions.
- [ ] **NH-19-14** DECISION: add other Linux architectures only if needed.

### 20. Consolidated acceptance and website retirement

- [ ] **NH-20-01** Run the meaningful consolidated browser/native/API regression after implementation phases.
- [ ] **NH-20-02** Use restored disposable databases for mutation, migration and rollback acceptance.
- [ ] **NH-20-03** Exercise all admin/member/profile/policy permission paths.
- [ ] **NH-20-04** Exercise create/edit/bulk/JSON/delete/restore, stale edits and failed transactions.
- [ ] **NH-20-05** Exercise the supplied Arabic-dubbed library and uncertain/missing/duplicate-file scenarios.
- [ ] **NH-20-06** Exercise remote direct play, selected audio/subtitles, resume and network loss.
- [ ] **NH-20-07** Exercise required stored-media delivery and unavailable-service recovery.
- [ ] **NH-20-08** Exercise server/device downloads, disk-full cases and restart recovery.
- [ ] **NH-20-09** Exercise offline playback and reconnection under the agreed access policy.
- [ ] **NH-20-10** Exercise Fedora boot, update, failed-update recovery and independent backup restore.
- [ ] **NH-20-11** Exercise freshly installed/released Flatpaks and upgrade compatibility.
- [ ] **NH-20-12** Inspect real GTK layouts/focus/RTL/input behavior; distinguish fixtures from physical input.
- [ ] **NH-20-13** Compare every existing website workflow against its accepted client replacement.
- [x] **NH-20-14** Retire the web dashboard, Hono API and their development/build wiring (2026-10-20).
- [ ] **NH-20-15** Remove unused legacy API/worker/provider/contract code only after consumer inventory.
- [ ] **NH-20-16** Update active guides and commands to the final server/Linux-client product.
- [ ] **NH-20-17** Publish v1.0 artifacts, installation/update/restore guides and known limitations.

## Media implementation checkpoint — 2026-11-06

### Full media review requested November 6 — source/runtime audit closed

Review the complete media change set from `e2e0d95` through the current tree, including untracked
feature files. New visual feedback updates this list without replacing reliability work. Keep
unrelated edits and Rust exercises intact; use synthetic/disposable data while Fedora is offline.
The source and disposable-fixture audit is complete. Packaged/native and operational acceptance
remain explicit release gates below; checked audit items do not imply live deployment.

- [x] Admin entry/navigation: work-first library, installment/episode coverage, useful filters,
      incoming/unmatched files, direct editing and clear import entry points.
- [x] Episode/file presentation: compact balanced cards, contextual artwork controls, grouped file
      actions, preserved metadata and accessible desktop/narrow behavior. Browser revision verified at 1440, 520 and 360 pixels; physical native acceptance remains pending.
- [x] Import journeys: server folders, client uploads and YouTube preview/mapping/review/results;
      make completed uploads discoverable without manually entering a staging folder.
- [x] Viewer/device source/runtime audit: explicit sources, saved details, independent videos/
      transfers/storage, offline packs/video fixtures, account isolation and cleanup ownership.
      The browser tour and scoped native download fixtures passed; packaged acceptance stays below.
- [x] Editorial language badges: work languages, nullable installment overrides, inherited effective
      languages and work-page union. These do not change source policy or player preferences.
- [x] Server/worker audit: leases/restart, cancellation, provenance, path boundaries, verification,
      partial publication, trash/restore and bounded resource use. Durable upload verification,
      missing-video/companion cleanup, actual retained trash bytes, purge tombstones and post-commit
      restore replay are covered by the disposable media suite. Foreign roots and changed bytes
      fail safely. Historical file IDs, catalog fields and explicit watched/progress state survive.
- [x] Native source/runtime audit: transfer resume, changed-source checks, deterministic subtitle
      staging, cancellation/scope boundaries, companion cleanup and byte accounting. Scoped fixture
      checks passed at the preceding checkpoint; native Rust is unchanged by missing-file cleanup.
- [x] Local handoff audit: static checks, focused server/native/browser regressions, the additive
      migration rehearsal, full screenshot tour and the preceding Flatpak SDK build are recorded.
      The new cleanup changes still need final release packages and installed acceptance.

Remaining 0.2.0 release gates:

- [ ] Build final versioned server/worker/client artifacts from the completed source checkpoint.
- [ ] Complete packaged native playback/download/offline and physical input/focus acceptance.
- [ ] Rehearse the final operational upgrade and independent backup/restore on restored data.
- [ ] When Fedora is available, review/register the three retained collections and accept live playback.
- [ ] Obtain the separate commit/publication/installation authorizations and deliver the release.

The user clarified that languages are editorial per-work badges, with installment overrides and a
combined work-page display. They are unrelated to preferred torrent/provider/player audio.

The initial source checkpoint is committed as `1d75527`. The subsequent 0.2.0 work remains
uncommitted and undeployed, in the main chat without subagents. Do not repeat the destructive family-server cleanup. Preserve the
unrelated media-review skill edit and the existing 0.1.3 upgrade notes in FAMILY-SERVER.md.
Committing, publishing and installing the new application builds still require separate authorization.
No live catalog writes or additional family-server changes were made in this continuation.

Implemented source includes authenticated original-file streaming/native relay, scoped server-file
device downloads, admin inventory/import/job controls, YouTube preview and reviewed episode metadata,
native resumable uploads, verification/reassignment and seven-day trash. Folder selection now exposes
both incoming files and unregistered files beneath the configured library's series/movies roots,
with stable pagination and traversal/symlink checks. Reviewed imports create readable UUID directories;
existing directory identities and journal destinations survive title/number edits.

Exact import request replays return their original job. Exact already-saved editor reviews can be
retried without another catalog mutation; later edits still conflict. Duplicate episode selections
and overlapping queued imports are rejected. The singleton worker serializes imports within one
work and checks provenance before another YouTube acquisition. Completed items survive failures;
job results show individual failures and retry skips registered items. Interrupted copies verify
the retained prefix, and interrupted restores reconcile verified destination bytes. Journal writes
are atomic and synced. Tool cancellation kills the process group, clears inherited credentials,
and monitors acquisition capacity. Unreceipted YouTube remux outputs are retained separately.

Administration now has work coverage/missing-unit views, source/availability filters, file inspection,
trash usage, phase labels and work-editor import/manage entry points. Uploads fingerprint native
source bytes and verify SHA-256 before publication; readable upload names support episode suggestions.
Device download paths are isolated by server/account. A download waits for its viewing pack; failed
pack refresh retains the previous valid pack. Long media responses use a separate trusted transport
with an idle timeout, rather than the ordinary API's 15-second total deadline.

Work-specific media links now use the existing structure editor. Canonical episode rows keep
their metadata/artwork controls and show a compact file status with paginated copies/actions on
demand. Bounded server summaries include episodes with no file, available/multiple copies,
missing/unverified files, active imports and trash. New draft episodes cannot receive files until
saved. Movies retain installment-owned files. Mixed seasons need no extra policy: allow internet
sources for the work and attach files only where available. Whole-work files-only remains explicit.

The media installer remains explicit and shares the signed image override. Backups stop the worker
when the API is inactive and restore the previous service states. Restored pending media jobs need
review before retry, preserving newer files/journals instead of replaying old side effects.
The initial media-file slice added no migration. The later editorial language model adds
`0002_editorial_languages.sql`, rehearsed through both canonical migration runners. Existing title
and installment fields survive its backfill; nullable installment overrides do not alter IDs or
source policy. Reverting an applied language schema requires a coordinated restore of the pre-update
backup and compatible binaries, not ledger changes or deleting columns from a populated server.

The 0.2.0 continuation adds matching subtitle receipts, canonical external-track registration,
authorized subtitle streaming/native relaying, scoped device companion downloads, and companion
trash/restore/purge. SRT/ASS/SSA/VTT companions are attached for playback; SUB/IDX companions are
preserved without claiming automatic paired-format playback. Reviewed replacement checks an
already imported alternative before retiring the old copy. YouTube selection supports duplicate
exclusion, reordering, bulk numbering and explicit thumbnail preview. Device batch selection is
explicit and saves its viewing pack once before queueing files.

The local browser connection rejected the newly advertised `storedMedia` capability; the canonical
contract and development adapter now cover it. Local API/worker launchers prepare isolated media
roots. A stopped local development stack was restarted; the family server's HTTPS readiness was
healthy and no production update was made. Fixture browser tests can run on port 23113 while the
interactive review remains on 23110.

Focused verification passed: the disposable media runtime including subtitle ranges, canonical
track registration and reviewed replacement; native interruption/resume/account-isolation/offline
video and subtitle fixtures; four production-preview browser media tests; 71 UI unit tests; and
17 offline release/host-tool tests. Lint, formatting, TypeScript and workspace Rust Clippy passed.
The mixed-batch retry check also passed: completed items survive a later missing source and retry
registers only the unfinished item. Actual package acceptance is tracked separately below.

Project tooling now includes Deno, Podman, Flatpak Builder and AppStream. An unpublished prototype OCI image
built with the pinned release Rust toolchain, and its unprivileged tool check confirmed yt-dlp
2026.10.26, Deno 2.9.7 and FFmpeg/ffprobe. Actual preview and acquisition/remux of a short public
sample succeeded with these packaged tools, outside any catalog. This prototype predates the last external-track
registration change and does not certify the final candidate. The isolated Flatpak SDK is under
`.flatpak-user`; the local SDK build now completes AppStream composition, repository export and
bundle creation. AppStream is declared in devenv, and the build wrapper creates its output directory
before export. This is an unpublished development build, not installed/native acceptance or the
versioned 0.2.0 release. Container build temporary layers must use
the persistent project disk, since Shadow's default `/var/tmp` shares the small ephemeral root.

November 6 verification passed: repository checks, 71 UI unit tests, 10 API-contract tests,
the disposable media runtime (including a genuinely removed disk file and bounded episode status
queries), and five focused browser tests. The shared workspace was checked at 1440 and 520 pixels,
including mixed seasons, movies, multiple copies, restoration, saved-identity guards and preserving
unsaved catalog drafts. Six fixture-backed screenshots are retained privately for the user's review.
The local demo API/worker and browser were restarted; Fedora was not contacted in this pass.

Remaining delivery work:

1. Exercise remaining retry/provenance, disk/cancellation and worker restart boundaries. Existing local
   subtitle files have not been deleted. The user accepted the general UI review; functional changes
   to the shared episode/file view have their own fixture checks.
2. Finish transfer/storage acceptance and verify saved work, downloads, sidecar selection and
   seeking in the freshly packaged native client, with networking disabled for offline playback.
3. Rehearse media-enabled backup/update/restore on restored disposable data and actual containers.
   Build the final OCI and Flatpak artifacts with pinned release inputs. Offline host-tool tests
   and a prototype image do not establish installed worker lifecycle acceptance.
4. Review the three retained collections against catalog episodes before live normalization or
   registration, then obtain installation authorization for the prepared builds. Physical input,
   target Fedora acceptance and installed Flatpak behavior remain separate from scripted diagnostics.

Verification in this continuation: repository `pnpm check`, workspace Rust tests, disposable
`bin/test-server-media`, the complete `bin/test-rust-catalog` preservation/migration/export suite,
17 offline packaging tests and three focused browser media tests passed. The media API fixture
includes library-root pagination, ranges/HEAD, import replay/conflict, a real FFmpeg-probed import,
interrupted restore, trash/purge accounting, upload hash rejection and administrator revocation.
The native transfer fixture covers interruption/resume/restart, a body exceeding 15 seconds,
account path isolation, offline saved details/video and failed-image pack refresh.

Fresh native-diagnostics binary and production Vite bundle passed `--home-smoke` using a private,
authenticated loopback fixture: gateway origin/HEAD/range checks, real mpv playback, Arabic audio,
embedded subtitles, seek/fullscreen and advancing frames. The first unauthenticated UI harness did
not mount the player; the corrected authenticated harness passed. Captures were inspected. This is
not an installed Flatpak test or physical keyboard/GPU smoothness certification. CUDA/a11y/Vulkan
warnings remain recorded in the ignored native logs. Keep private manifests, fixtures and captures
out of Git.

November 6 full-review evidence: the broad folder/upload/YouTube/jobs/device screenshot tour and
37 browser regressions passed, including language override/inheritance and all six episode-file
states. The disposable media suite verified expired-lease worker restart after upload publication,
corrupt upload retry, staging cleanup, and intentional purge exclusion from active inventory. The
editor suite verified language union and restored inheritance through authenticated APIs; both
migration runners accepted all three migrations. Static lint/format/TypeScript/workspace Clippy
passed. The local demo was backed up and restarted with the additive migration; before/after
fingerprints of all preexisting work/installment fields matched. These results do not establish
current OCI/Flatpak installation, physical GTK input or live family-server acceptance.

Stopping checkpoint requested November 6: the latest local Flatpak SDK build completed, including
AppStream composition and bundle export. It remains an unpublished development bundle with the
existing 0.1.3 version, not the final 0.2.0 release. Current browser coverage includes all 19 admin/
episode cases (the updated inventory-navigation case passed in its focused rerun), alongside the
37 viewer/import/device regressions. Canceled uploads resume from their acknowledged offset in the
disposable runtime suite. No commit, release publication or family-server installation occurred.
Before 0.2.0, finish packaged native acceptance and the restored-data upgrade/backup/restore
rehearsal; review remaining failure-state cleanup and perform the live three-work mapping only
when the family server is available.

Missing-registration cleanup completion: the existing seven-day trash flow accepts genuinely
absent managed video files and records missing companions instead of fabricating them. Remaining
registered subtitles are verified and retained; restoration of an absent video restores its
registration as missing. Trash reports actual retained bytes. Purge preserves file history while
removing active availability. Component-wise absence checks reject symlinks and I/O errors; file
operations require the active configured root and preserve changed/conflicting bytes. Journals
precede mutations, directory updates are synced before the database commit, and job audit receipts
make restore replay safe after a commit. No schema migration or production mutation is required.
