# Nahhasio project guide

Client delivery correction (2026-10-25): Flatpak replaces AppImage for installed Linux clients.
Nix is development-only. [The Flatpak guide](../packaging/flatpak/README.md) owns the supported
build/repository/host-update boundaries; historical AppImage acceptance notes below remain history.

## Current release checkpoint — 2026-10-25

Aqua authorized the four-phase family-PC delivery in [DEPLOYMENT.md](DEPLOYMENT.md): rootless
Fedora Atomic Quadlets, backup/restore and catalog transfer with independent laptop development,
verified server/Flatpak delivery, then app maintenance controls. Code all four phases before
consolidated installation acceptance; there is no per-phase approval stop for this checkpoint.
Player/provider testing is removed from this release sequence. Jellyfin and files-only playback
are deferred, as are unrelated catalog/admin tools. This dated scope supersedes older checkpoint
ordering and mandatory Jellyfin/playback acceptance language below. The real catalog moves only
after a verified transfer; development remains on Shadow. No release publication/push is implied.

Updated 2026-10-18. This document owns the current product direction. [ROADMAP.md](ROADMAP.md)
owns the large task inventory and Alpha/future priorities. Older plans are recoverable in Git.

## Product and release scope

**We are building 0.1 Alpha now.** The goal is a reliable base; completing the entire future
roadmap is not an Alpha release requirement. **The database/catalog, images and tracking are the
primary product.** Playback and source/download workflows sit on top of those identities.
Not every catalog work needs a video or a download.

The product is one home server and desktop clients. The server target is **Fedora Silverblue 44
with Podman**; the only client through v1.0 is **Linux**, released as a **Flatpak from a signed repository**. There is no website in the delivered product. Android, Windows, macOS and
possible Android TV clients are future work after v1.0. Keep portable APIs/media logic without
building those clients now.

Aqua reports a Dell Optiplex Micro, possibly 3070, and 16 GB RAM. The exact model, CPU/GPU and
memory type are unverified. Storage can be expanded later. Do not choose GPU/transcoding or
hardware-specific settings from the uncertain model. There is no reason to change the OS for
current planning; verify the host before deployment.

## Confirmed Alpha use

- **Home network only.** Public access and VPN are future scope.
- **Family use with an admin account and a user account.** Multiple profiles, separate accounts
  for every family member and child-policy systems are not initial requirements.
- English audio is the normal preference; Arabic subtitles are preferred. Arabic audio is used
  when available and Spanish audio may also be selected. Language choices belong to playback
  preferences and actual tracks; they do not require separate catalog entries for every language.
- Aqua wants automatic updates for the installed server and Linux Flatpak. Deliver verified
  artifacts, compatibility checks, recovery and persistent-state preservation before enabling
  unattended installation. Schema changes still use an explicit coordinated migration operation;
  process startup never migrates. PostgreSQL/Jellyfin version upgrades have separate ownership.
- Torrent streaming is the main online playback source. Existing/server files are also first-class,
  including deliberately non-torrent works. A catalog record can have no available video.
- Keep Save work (local metadata/artwork), Download to server and Download to this device
  as distinct actions. Saving a work must not start a video download.
- Keep the reviewed desktop design, improve login/server selection and Downloads, and continue
  moving administration into the client in reviewable steps.
- Delete obsolete guides from the checkout after consolidating useful facts; Git retains history.

## Agreed checkpoint order — 2026-10-18

1. Server connection/login, including the reviewed desktop UI.
2. Complete Saved Works and offline use.
3. A detailed database-schema and application-logic review before deployment: report current
   relationships/constraints/ownership, gaps and duplication; propose justified improvements.
   This review does not authorize live data/schema changes automatically.
4. Podman deployment foundation with verified backup/restore, controlled migrations, trusted
   artifacts and safe explicit update/rollback procedures.
5. Admin Overview and Settings in the Linux dashboard, using its reviewed visual language and
   real server capabilities. Cover server/database/storage health, activity/jobs, users/devices,
   provider keys, library configuration, backup/update status and later media-only Jellyfin setup.
   Keys remain server-owned with masked status, write-only changes, authorization and audit.
   Connect actual services before enabling controls; do not equate page layouts with full control.

Completed local checkpoint (2026-10-20): native Rust operator CLI and Downloads video/artwork
root ownership. The retired web dashboard/Hono API are removed; development-only reference
checks live under `tools/catalog-reference` and contract generators under `packages/contracts/scripts`. Aqua will check connection, accounts and offline behavior
manually next. The pre-deployment schema/logic review follows, then reviewed administration and
Podman work. The review must identify required ownership/configuration changes before schema
mutations or broad settings controls are implemented.

Keep deployment/update design in the review: image provenance and digest/signature verification,
version compatibility, persistence/secrets, health checks, rollback limits after schema changes,
and a rehearsed independent recovery path. Do not enable blind automatic upgrades.

## Four distinct workflows

1. **Catalog and tracking:** browse/administer the large PostgreSQL catalog, all linked editorial
   records, images and personal state. Organize artwork storage on the server while preserving
   asset IDs/assignments. Move database and artwork with verified backup/restore and reconciliation.
2. **Play / keep on server:** stream torrents when permitted; use an available linked file for
   downloaded or deliberately non-torrent work. Download-to-server turns a selected source into
   a verified persistent library file. Normal later playback can use that file without needing
   its torrent/peers. Audio/subtitle management belongs to the selected media version/tracks.
3. **Download to device:** save video on the personal laptop for playback anywhere. This is
   independent of server-library retention and its deletion/recovery rules.
4. **Save work:** keep an authorized work snapshot locally: metadata, poster/banner/artwork,
   parts/episodes, related display data, tracking snapshot and source-resolution identities.
   Saved browsing must work without contacting/logging into the server. It does not download video.
   A downloaded device file can play offline; a permitted torrent can still be resolved/played
   without the home server when internet is available.

**Server unavailable is not the same as no internet.** Saved metadata/device files work without
internet; torrents and subtitle/provider searches need network access. Save enough durable identity
and source information to resolve again, rather than assuming expiring provider URLs remain valid.
Private provider configuration remains native/server-owned, not an exposed metadata dump.

A saved-work/account flag records intent; it does not establish that a particular device has a
complete usable snapshot. Each device needs actual cache manifests, retained files and readiness
checks. Account/server IDs scope the cache. Reconnecting can refresh metadata without erasing
local downloads; queued personal tracking changes need a defined sync/conflict policy.

Confirmed 2026-10-14:

- **Torrent streaming runs on the client only**, like Stremio. The server does not stream torrents
  on behalf of clients. Saved-work source resolution/playback can therefore work without the home
  server when internet is available.
- **Download to server is an explicit separate request.** The server runs the requested torrent
  download job and retains/registers the completed file. This is acquisition, not server-side
  torrent streaming. The laptop does not have to download then upload the file.
- **The source policy applies to the whole work.** A work may be files-only: no torrent search or
  playback, and all parts/episodes use linked supplied/downloaded files. No part/episode overrides
  initially. Jellyfin is now the confirmed stored-media backend. Deliberate disabling differs from no
  search results or unavailable peers.
- **Offline tracking changes are progress and watched/unwatched only.** Queue them locally and
  synchronize under the owning server/account when reconnected. Ratings/notes editing does not
  become an offline mutation feature now; existing cached data may remain readable.

Keep original media intact when managing tracks by default; destructive track removal/remux
requires an explicit operation.

## Existing Arabic-dubbed library

Approximately **70 works** have supplied Arabic-dubbed videos. These files will live on the
server and do not depend on torrent availability. Aqua can place them in a chosen library root.

The library workflow must scan/import files, inspect audio/subtitle tracks, match them to work,
part and episode IDs, support manual correction, and play linked media. Detect missing/moved
files without removing catalog identities or viewing history. Multiple media versions may link
to one catalog item. Do not silently guess episode matches or require torrent/source packs.

The approved initial policy is to scan and link existing files without changing filenames or folders. File organization is a separate
explicit operation. Current folder layout and catalog linkage can be inspected when files are
supplied; they are not blockers to the architectural plan.

## Architecture and ownership

| Owner               | Responsibility                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Nahhasio/PostgreSQL | Catalog, Arabic editorial metadata, classifications, identity/access, links, viewing state, artwork metadata and durable server jobs |
| Server filesystem   | Persistent library videos, image originals/variants, sidecar subtitles and temporary staging/cache roots                             |
| Linux native shell  | Selected server connection, secure sessions/network, native playback and device storage/downloads                                    |
| React desktop UI    | Viewing/admin presentation, bounded query cache, typed routes and interactions                                                       |
| Release tooling     | Containers/Flatpaks, compatibility, guided updates, explicit migrations, backup/restore                                              |

Implementation: Rust/Axum/SQLx server; Rust GTK4/libadwaita/WebKitGTK shell and libmpv;
React/Vite/TypeScript, TanStack Router/Query, Tailwind and shadcn Base UI. Desktop registry style
is `base-maia` with Mist tokens; the checked-in current theme/source is the design authority.

The existing website and legacy API/provider code remain transitional consumers until their
replacement/retirement is complete. They are not shipped-product requirements.

The complete work editor temporarily reuses a **private Node/tsx worker** behind the Rust API.
Aqua chose a **Rust-only installed Nahhasio runtime** on 2026-10-19: replace this worker before
deployment, share application/database behavior with a compiled Rust operator CLI, and require
no Node/pnpm/source checkout on the installed server. Node remains development/build tooling for
the React UI. The current editor is not yet a Rust-only runtime.

## Confirmed library, catalog and tracking decisions — 2026-10-18

Nahhasio owns all catalog/editorial data, images and tracking. Jellyfin is the stored-media
backend only; play its media inside Nahhasio's native player. Link existing folders without
moving originals. Do not synchronize Jellyfin watched/progress state or use its metadata as
catalog authority. Select a device file, then a server file, then a permitted client torrent.
Jellyfin must not import or overwrite Nahhasio metadata/artwork: its integration is media
playback/streaming and the minimum media identity/track information needed for that purpose.
Whole-work files-only policy suppresses torrent actions regardless of peer/search availability.

Provider API keys are server-owned. Manage them through authenticated administration in the
Linux client; return configured/masked status, not saved secret values. Private server storage,
permissions and secret-safe backup/rotation remain part of the runtime implementation.
Torrent payload eligibility belongs in the transfer engine as well as the UI. Executables,
archives, playlists and sidecars must not become selected playback/download/export targets.
An extension allowlist alone does not prove valid video content or eliminate decoder risks;
content validation and packaged-player acceptance remain required before stronger safety claims.

Dub metadata is whole-work: recorded dub languages/notes and existing organization contributions
with a dubbing-studio role and credit languages. No edition/version system or alternate episode
listings. People/studio credits stay at work level. Each work has at most one planet. Trailers
are YouTube links only. Episode stills come from a provider/manual upload or an available video
capture and are registered in Nahhasio's server artwork library, not left as external image URLs.

Every active supported account can log in and track its own viewing. Normal viewers see only
published/non-private works. Auto-watched threshold is 90%, preserving manual overrides; work
completion counts released units. Save work is not a prerequisite for recording progress.

## Current approved checkpoint

Aqua approved the three-phase transition in [SCHEMA-FOUNDATION.md](SCHEMA-FOUNDATION.md):

1. Schema foundation, local verified backup/restored rehearsal and preservation-safe migration.
2. API and whole-client integration, basic authorized views for unfinished areas, and Rust runtime
   administration parity before deployment. Internal/authentication tables are not raw client dumps.
3. Nahhasio-named agent CLI/database/cataloging skills and clearer powerful agent workflows.

Complete one phase, report actual results/limits, then stop for review. No commit is implied.
Aqua chose a backup under this persistent project's data/backups for the local schema checkpoint;
an independent backup remains required before production cutover. Keep all pending user design edits.

## Current implementation and acceptance

Accounts/profile/login, discovery, catalog/details, native playback and device-download code
exist. The full admin work/bulk/JSON editor is committed as `8aa716a`. Remaining admin routes
include prepared screens whose workflows still need services. The Linux image library now has
search/filter/paging, upload and owner assignments, guarded record deletion, reviewed filename
cleanup and compact details. Its latest UI review and isolated mutation acceptance are pending;
see DEVELOPMENT.md for file compatibility and recovery limits. There are pending source changes;
preserve them during documentation/other work.

The native client has saved server selection and private per-server persistent sessions.
Restart/switching/native acceptance remains distinct from source/static-check completion. Local/manual subtitle
support exists; provider retrieval, server-file ingest/playback, Fedora deployment and AppImage
release delivery remain to be completed/accepted.

Static/build/read checks and earlier isolated playback checks are evidence of specific artifacts,
not complete release acceptance. Public torrent transfer, all current editor mutations, deployment,
physical native input and cross-machine packaging are not established by those checks. Known
limits and verification commands live in [DEVELOPMENT.md](DEVELOPMENT.md) and [TESTING.md](TESTING.md).

## Alpha planning and unresolved choices

Aqua clarified the priority: catalog/database, all its data/images and tracking first; playback
and server/device/saved-work workflows build on it. Continue complete database/admin workflows
and storage planning without treating the entire future roadmap as Alpha gates. Server selection,
file availability/resolution, offline cache ownership and packaging remain foundational follow-ups.

Jellyfin as media backend, scan/link without moving originals, whole-work dubbing/source policy,
one planet, YouTube trailers and Nahhasio-only tracking are now confirmed above. The current
three-phase implementation owns remaining API/UI/runtime work and agent-tool changes. Detailed
family features stay in the roadmap until approved; this schema foundation does not authorize
unrelated chat, watch parties, transcoding or a fixed v1.0 feature list.

## Documentation and working boundary

- [FEATURES.md](FEATURES.md): brief page-by-page UI/UX and feature checklist.
- [ROADMAP.md](ROADMAP.md): technical task inventory, delivery priorities and decisions.
- [DATABASE.md](DATABASE.md): inspected database inventory and ownership/source/cache boundaries.
- [DEVELOPMENT.md](DEVELOPMENT.md): repository map, commands, transport/media ownership.
- [TESTING.md](TESTING.md): lean checkpoint checks, isolated verification and final acceptance.
- [OPERATIONS.md](OPERATIONS.md): current runtime configuration and planned deployment/recovery.
- [design-rules.md](design-rules.md): current UI composition; preserve Aqua's reviewed source.
- [migrations/remove-tvdb.md](migrations/remove-tvdb.md): retained migration/recovery note.

PostgreSQL is canonical; `packages/database/drizzle/` is the sole migration ledger. Preserve UUIDs,
credentials/ownership, notes/scores/links, artwork, explicit watched state and progress. No startup
migration/seed/import/cleanup. Rehearse data/schema changes on restored disposable databases;
verify independent database/artwork backups before a live cutover.

Use focused compile/static checks at implementation checkpoints and a consolidated meaningful
regression after the relevant implementation. No repeated full suites for tiny changes. Complete
an approved checkpoint and return for review; commits require explicit confirmation. Client Rust
learning exercises remain Aqua-owned unless Aqua explicitly requests their implementation.

## Pre-deployment review checkpoint — 2026-10-20

The read-only [schema/logic review](PREDEPLOYMENT-REVIEW.md) is complete. Keep the existing schema;
the historical migration-checksum finding has since been closed by the baseline below.
Tighten transaction-level session/device/visibility checks before hosting. Packaging needs restricted runtime
roles, explicit persistent roots and application compatibility preflight. Job execution, Jellyfin,
fine-grained policies and verified automatic installation have separate feature gates. The review
made no live schema/data changes and does not authorize its proposed repairs automatically.

## Current-database baseline — 2026-10-20

Aqua approved a new baseline of the existing database. [BASELINE](BASELINE.md) records completed
backup/restored rehearsal, full schema equality, 23 constraint assertions, 1,055 restored artwork
hashes and live ledger-only adoption with all 75 public tables unchanged. The native ledger now
has one applied baseline and no pending migrations. The old 31-file chain is retired to Git and
private recovery archives. Future changes are additive; the earlier R1 history mismatch is closed.
Overview/server Settings follow this checkpoint, with the remaining authorization/readiness and
production configuration requirements tracked in the pre-deployment review.
