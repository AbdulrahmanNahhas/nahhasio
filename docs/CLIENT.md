# Client behavior

Current behavior and reviewed UI contracts. This guide does not claim installed Flatpak, physical
input or provider acceptance. The hosting release excludes player/provider testing. Design rules
remain in [design-rules.md](design-rules.md).

## Linux settings, sign-in and artwork

Settings has its own route, with account/security, application appearance, playback, subtitles,
sources, extensions, storage, offline, connection and help categories. Planned controls remain
disabled alongside implemented actions, with individual source TODOs. Password changes open
on demand; server connections, testing and editing are available inline. Library card/table
presentation remains in Browse, not Settings. Narrow layouts use a five-destination
Home/Library/Search/Downloads/More dock; desktop retains its navigation rail. Existing profile,
password, download-cache, server-connection and Flatpak-update services remain
the owners of their controls. Playback Settings now persist preferred audio/subtitle language,
subtitle enablement, size and position for each account on this device. mpv receives these defaults
before a new local, saved, torrent or compatible direct source loads; manual track/style changes
remain session-local. Arabic subtitle preference falls back to English. Debrid and addon
installation remain future integrations.

OpenSubtitles.com setup is in Settings → Subtitles in the Linux client: each person supplies an
API key, username and password. The password is used only for login; the API key and returned
token are encrypted through the device Secret portal, bound to the selected server/account.
Unavailable secure storage disables connection setup rather than storing plaintext. Forgetting an
account removes its provider credentials. No provider credentials or video are sent through the
Nahhasio server. The browser development preview does not accept these secrets.

The player subtitle panel offers explicit title/language/year/season/episode search, paginated
release results with provider-reported accessibility/translation flags, and Download and apply.
Only that action requests a download link and consumes the provider's download allowance. Requests
are bounded and use fixed API hosts; download redirects are bounded and revalidated, without
forwarding API credentials. Downloaded UTF-8 SRT files use a bounded account-local disposable cache.
Expired sessions, quota refusal, network failures and unsupported content produce actionable errors.
Hash matching, persistent attachment beside saved videos and other subtitle providers are deferred.
Real OpenSubtitles acceptance still needs a user's configured key/account; controlled fixtures do
not establish provider availability, quota or subtitle synchronization. Diagnostic preview/copy uses an explicit allowlist that excludes accounts,
credentials, URLs and local file paths; nothing is sent automatically.

Saved connections support an explicit address-update review: probe anonymously with the saved
certificate authority, require the known server UUID, and recheck both before saving. Connection
names and the canonical offline artwork/preferences namespace survive the change. Credentials
remain origin-scoped, so the new address requires sign-in; explicit offline sign-out restrictions
also survive address aliases. Hostname validation stays enabled. A stable DNS name must already be
configured on the network and covered by the certificate; the client does not configure DNS.

The login picker contains only accounts added on this device. The unauthenticated server account
directory was removed. Remembering is opt-in and stores encrypted session credentials, never a
password. The Flatpak Secret portal supplies the encryption key; failure permits temporary login
without remembering. Switching preserves other remembered sessions, cancels pending catalog/image
requests, stops playback and pauses transfers. Sign-out revokes this account's sessions on the
registered device; forgetting also removes its local picker entry. Retained video files are not
deleted. Explicit sign-out hides offline snapshots until that account signs in again. Download
metadata, file opening and management actions require the exact server/account scope. Legacy
unassigned download records stay on disk without appearing under an arbitrary account.

Renewal credentials rotate, with a 30-day inactivity limit and a 90-day absolute limit. Access
credentials remain stable during renewal so in-flight requests are not invalidated. Password
changes revoke renewal for the current device and all other sessions; the current access session
remains connected until it expires or signs out. Existing stored sessions are migrated only after
server validation and successful secure-storage access; they do not gain renewal without a new
remembered sign-in. A temporary login must never be upgraded by background session polling.

Display artwork uses account-scoped native resource URLs rather than base64 bridge payloads.
The server provides 320/640/1280/1920 maximum-edge WebP thumbnails with bounded decoding and ETags;
AVIF currently retains original delivery. Original assets/UUIDs remain unchanged. Derivatives live
in `NAHHASIO_ARTWORK_CACHE_ROOT` or a disposable temporary directory. The native 512 MiB LRU image
cache is separate from saved offline artwork and video files. Recently validated bytes can be
reused for 30 seconds; subsequent requests revalidate through authenticated HTTP. Same-image
requests share a native lock, and foreground catalog and artwork have separate concurrency limits.
Home uses a 30-second freshness window instead of always refetching on mount. Image failures have
a distinct placeholder; Settings provides artwork cache usage and cleanup under Storage.

This source checkpoint does not establish installed Flatpak acceptance, Secret portal availability
on every desktop, physical input, provider playback or real-catalog performance. See TESTING.md
for fixture/native acceptance procedures. Schema migration and deployment remain explicit.

## Awards administration

### Current experience

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

### Editing and ownership

Organizations, categories and ceremonies have strict shared validation, before/after review,
unsaved-draft protection, stale-record rejection and linked-record deletion guards. Successful
mutations write audit and editorial revision records in the same transaction. The existing bounded,
authenticated Rust editor facade revalidates/locks administrator sessions for mutations.

Recognition creation/removal and editing use the work editor's Awards section, preserving part
ownership, ordering, featured status, notes and sources in its existing reconciliation flow.
Definition changes retain historical recognition display strings. UUIDs and timestamps are readable
system fields.

## Browse and filters

### Current behavior

- A compact RTL toolbar provides Animated/Live Action and viewing-state selections, sorting,
  a dedicated Search-page button, filters, display preferences and built-in Browse templates.
  Toolbar selections and drawer selections share the same server filters.
- The filter drawer uses horizontal sections and compact include → exclude → clear chips.
  Search matches Arabic/English names, slugs and aliases through an explicit public-field
  allowlist. Fixed choices remain available at zero matches. Large groups reveal more options
  incrementally; selection order stays stable.
- Release and library filters share a section. Privacy and a year range slider sit together.
  Audience/age and colored content-risk groups use their reviewed compact arrangement.
  The content-warning-presence filter is hidden from the picker.
- Overall rating uses a two-handle range slider. Six independent criterion sliders retain
  minimum thresholds, individual resets and a shared reset. All thresholds use 0.1 precision.
- Work status uses completed, ongoing, upcoming and unknown; installment status retains airing.
  Administrator privacy filtering follows the privacy flag independently of editorial state.
  Family accounts can browse public draft and published works. Draft is an administrator
  revision marker; private works remain restricted.
- Studio grouping uses one primary animation studio, or a primary production company when
  no primary animation studio is recorded. Supporting studios and distributors do not create
  extra groups; the studio filter still searches all credited organizations.
- Display has layout tiles, contextual setting rows, immediate switches, a table-column picker,
  Arabic/English/both title choices, thumbnails and row density. Added preferences are optional
  in both TypeScript and native Rust so previous documents remain readable. Defaults retain
  the prior presentation. Preferences remain device-local and scoped by server/account.
- Browse templates are fixed product definitions in `browse-templates.ts`, not user-editable
  saved views. Applying a template replaces search/filter/sort/group/display choices while
  retaining privacy and the current route's locked facet. Earlier saved-view documents are
  preserved but no longer exposed as editable shortcuts.
- Draft Apply, Cancel/Escape, focus restoration, a debounced result count and server pagination
  remain in place. Schema and live catalog records are unchanged.

## Episode editing

The Linux work editor presents compact episode rows with stills, titles, dates, duration and a
summary excerpt. Search and missing-image/metadata filters operate over the complete selected
installment; pages show ten results. Episode metadata opens in a draft dialog. Duplicate episode
numbers are rejected, fractional positive numbers are preserved, and image updates preserve IDs
and unrelated metadata. Deletion retains the existing dependency check and save review.

### Image workflow

The selected installment owns a temporary TMDB season selection for individual searches.
It starts with the installment's position among seasons, excluding movies; specials start at zero.
The small season input remains editable to correct provider differences.
This selection belongs to the current editing session, is reset when leaving the installment and
is not a new database field. The batch dialog additionally lets the administrator confirm the
TMDB series ID. Local episode numbers are matched exactly; fractional episodes require manual
image selection/upload. When the standard season is missing, a unique season-based TMDB episode
group supplies the provider coordinates. An optional episode-group URL resolves ambiguity or selects
a specific group. The preview shows the source group and episode coordinates; local episode numbers
and IDs stay unchanged. This is temporary artwork lookup, not a stored alternate episode listing.

The batch action covers the complete selected installment, regardless of search or page. It defaults
to episodes with no image, including legacy poster/banner fallback. An explicit replacement mode
reviews all eligible episodes. The season response supplies proposed stills; alternative images are
loaded on demand through TMDB's per-episode image endpoint, with no language filter. Candidate
URLs/dimensions are validated at the provider boundary, and the gallery is bounded to 60 options.
Downloads use TMDB original-resolution URLs; only gallery previews use smaller images. Existing
imports retain their files unless the administrator explicitly chooses replacement.

Selections are previewed before importing. At most two imports run concurrently; successful paths
remain in the dialog while failures can be retried. Stop finishes current requests and starts no new
ones. Applying successful imports is a separate explicit action; work review/save performs the actual
assignment. Closing without applying retains imported, unassigned files in the image library. No
existing assets are purged or overwritten. Stale episode identities/numbers/images reject the batch
without overwriting the current draft; newer metadata edits and unrelated artwork fields survive.

Single-episode TMDB selection uses the same gallery. Image removal clears only the displayed
artwork role, preserving other retained fields. Upload/library choices remain available.

## Studios editing

The Linux administrator editor keeps the reviewed Arabic/RTL components and separates identity,
links, work contributions and organization relationships into tabs. The primary logo stays visible
beside the form, with a larger preview and explicit library/upload/removal actions. Saving still
requires reviewing the draft; uploads enter the image library before their primary assignment is saved.

`entities.urls` owns an ordered list of labelled HTTP(S) URLs. The editor rejects credential-bearing
URLs and duplicate URL values. Organization relationships reuse `organization_relations`, support
both directions, an optional exact date and notes, and appear in both organizations' drafts.
Self-links, foreign relationship IDs, duplicate relationships and non-organization targets are rejected.
The existing serializable transaction, permission check, revision fingerprint, audit and revision
snapshot cover these fields. Changes to a shared relationship invalidate the other side's old draft.

JSON exports include `urls` and `relations`. Omission in an older JSON document or client payload
preserves existing values; an explicit empty array removes them. Existing descriptions are preserved,
including URLs previously entered as description text. No automatic editorial backfill is performed.

## Watch page

The Linux watch page keeps catalog context, episode navigation and family discussion visible
independently of source lookup. The existing source selection, file choice, media ownership,
resume/progress, player controls and dedicated download flows remain in place. A failed source
search occupies only the video frame. It does not fake playback or replace the watch page.

### Layout and native video

The desktop Arabic layout places the native video and details beside an episode column. Narrow
windows place a collapsible episode section before discussion. Theater mode hides the episode
column. Movies use the full width and expose no episode sidebar or episode toggle. Their
installment selector, status badges and watched control sit below the video, with the selector alone on the left and equally tall status badges opposite it.
Installment menus open below their triggers. Local files hide episode navigation as well; files without catalog identity retain playback
without fabricated work discussion. The player has no title/back overlay; fullscreen lives in
the bottom controls. The page presents the filename once below the video.

`player.viewport` carries only bounded, session-scoped logical geometry. A non-measuring GTK
Fixed overlay positions the native GLArea beneath WebKit; the native video cannot impose its
previous width as the window minimum. A background mask leaves a transparent video aperture
while painting the rest of the page. Resize/scroll measurements are coalesced and native updates
are serialized. Layout and fullscreen changes retain the playback session.

Window fullscreen (Niri/F11) and video fullscreen are separate. Only the player command enters
video-only mode. Leaving it preserves a window that was already fullscreen. Leaving window
fullscreen clears video-only mode. Closing playback does not undo independently requested window
fullscreen. Keyboard transport is scoped to the video area in page mode, preserving text input.

### Family discussion

Discussion remains work-level, using the existing title_comments and title_reviews tables.
The viewer feed is reused, with 30-second refresh while online. The new bounded comments endpoint
supports create/reply, update and hide-own-comment actions. Identity comes from the authenticated
account, checked in a write transaction; parent comments must belong to the same work and be
visible. Edits cannot change parent/work/author. Hiding a comment preserves other people's replies.
The request body supports 1200 Arabic characters without exceeding the byte limit.

Comment drafts stay in component state across source errors and episode changes within the work.
Posting failures retain the draft. Switching a nonempty draft to another reply/edit requires an
explicit discard decision. Spoiler text is concealed, and delete has a confirmation. Offline mode
shows discussion as unavailable; comments are not added to the offline mutation queue.

## Work recommendations

The viewer's work page requests up to ten other draft or published, non-private works through
`GET /api/v1/catalog/recommendations?workId=…`. The current work is excluded. All eligible
candidates are ranked in PostgreSQL; the client receives only ten summaries and their explanations.
No migrations, catalog mutations, viewing-history inference or third-party recommendation service
are involved. With fewer eligible works the section shows fewer cards. Offline mode hides it.

### Match score

This is catalog similarity, not a probability of enjoyment, a popularity score or a safety decision.
The fixed signal weights total 100 when every signal is available:

| Signal                | Weight | Similarity                                                |
| --------------------- | -----: | --------------------------------------------------------- |
| Genres                |     22 | Intersection divided by union                             |
| Tags                  |     16 | Intersection divided by union                             |
| Planet                |     12 | Shared membership                                         |
| Studios/organizations |     12 | Intersection divided by union                             |
| Tone                  |     10 | Intersection divided by union                             |
| Score profile         |     10 | Mean similarity of six per-criterion installment averages |
| Contributors          |      4 | Intersection divided by union                             |
| Audience/age          |      4 | Mean of exact audience and age matches                    |
| Family classification |      4 | Mean normalized distance across the three risk levels     |
| Format                |      3 | Exact animated/live-action match                          |
| Countries             |      3 | Intersection divided by union                             |

A missing seed facet excludes that signal's weight. Candidate-side missing data contributes zero
rather than shrinking the denominator. For scores, criteria missing from the seed are excluded;
criteria present only in the seed contribute zero. Each known pair contributes
`1 - abs(seed - candidate) / 10`. Risk distance uses none=0 through high=3.

The percentage is the weighted mean multiplied by 100 and rounded once to an integer. Ties use
sort title and UUID for stable ordering. Shared values use actual Arabic vocabulary labels and
entity names. The explanation exposes every active signal, its similarity and weight, including
zero matches. Component similarities are displayed to one decimal; the total uses unrounded values.
No private bookkeeping, alternative titles or verification data is shown in the recommendation UI.

### Runtime boundary

The existing endpoint's no-work-ID personal/editorial behavior is retained, with editorial-status/private
filtering. Its related-work response adds optional `matches` and `algorithm` fields to the canonical
OpenAPI schema. Generate the client rather than editing generated TypeScript. The new fixed
`recommendations` native command validates the work ID and calls this endpoint using the existing
session; GTK and server binaries must be rebuilt and relaunched for runtime acceptance.

## Administration coverage

| Page                          | Current implementation                                                                                  | Useful next improvement                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Overview                      | Server status, catalog distributions, six-month additions, missing-data links and recent audit activity | Review chart hierarchy and usefulness with Aqua; do not invent playback or hardware metrics |
| Works                         | Paginated editing, selection, JSON, six catalog filters, missing-data filters                           | Review remaining filter needs with Aqua; retain reviewed compact header                     |
| People                        | Drawer editing, credits, aliases, images, JSON and guarded deletion                                     | Better duplicate discovery and merge previews, if requested                                 |
| Studios                       | Shared entity editor plus organization relationships                                                    | Review contribution/reference shortcuts; keep relations contextual                          |
| Planets                       | Definitions, membership and movement                                                                    | Preserve the approved page; no redesign requested                                           |
| Awards                        | Organizations, categories, year/ceremony navigation, recognition cards/table                            | Review search scopes and recognition editing shortcuts                                      |
| Images                        | Upload, assignment, guarded delete, rename and type-specific previews                                   | Review mixed-image ordering and identify broken files with real storage checks              |
| Vocabularies and translations | Read-only table inspector                                                                               | Highest priority: tabs per vocabulary, translation gaps, search and guarded editing         |
| JSON                          | Whole-work and entity editors with review/save                                                          | Improve entry guidance for selecting records; retain schema validation                      |
| Revision history              | Read-only editorial revisions                                                                           | Human-readable diffs and record links; restore needs its own guarded preview/service        |
| All tables                    | Read-only schema/row inspector                                                                          | Keep as an advanced inspection tool, not a generic write console                            |
| File library                  | Connected media inventory, reviewed imports, verification, reassignment and trash jobs                  | Accept installed file coverage and recovery; inventory alone is not proof of playable bytes |
| Server downloads              | Durable media import/preview/file jobs and native upload progress                                       | Accept worker restart/cancellation, capacity and real YouTube availability                  |
| Accounts and access           | Users/devices/viewing/policy inspector tabs                                                             | Dedicated management with authorization and session/device handling                         |
| Server activity               | Background-job and audit-log inspector tabs                                                             | Structured job details, errors and filters; controls only when backed by services           |
| Maintenance                   | Library actions plus configured backup/restore and update services                                      | Accept installed backup/update recovery; add durable library jobs separately                |
| Settings and connections      | Server name and write-only provider settings; Jellyfin connection UI retired                            | Actual connection management and explicit connection tests                                  |

Episodes, Relations, Contributions, References and Relationship Graph have no standalone admin
pages. Related records remain available in their editors or All Tables. Statistics belongs in Overview.

### Action ownership and limits

- **Maintenance → Library actions** owns operations across records. Overview provides shortcuts.
- Missing episode images: review TMDB series/season mapping, preview available stills, select images,
  then explicitly import. A batch contains at most 48 missing episodes. Existing primary stills
  are protected by assignment revision checks. Special/grouped episode orders use the Work editor.
- Unattached images: explicitly collect a preview, check every candidate's protection status, then
  confirm deleting only reviewed records. Each deletion revalidates authorization, SHA and dependencies.
  Files remain on disk. The preview refuses more than 10,000 records and concurrent list changes.
- Foreground operations show progress, stop after the current item on request, and report partial
  failures. They are not durable server jobs. A failed assignment after ingest may leave an unassigned
  recovery image; cleanup handles it later. Navigation is blocked during active operations.
- Overview reads do not fetch provider images, scan all storage, delete anything, or run migrations.
  Additions measure catalog record creation, not releases or viewing. Image-role counts can overlap.

## Direct stored-media checkpoint — 2026-11-04

Normal viewers keep Save work, device video downloads and server files separate. Saving a work
retains its viewing details, source identities and images without starting video acquisition.
Complete device videos take priority over an available home-library file. Internet torrents and
providers remain explicit choices, and still need internet even when saved catalog data is local.
Home streaming is LAN-only and original-quality through authenticated native transport to mpv.

The device library includes torrent and server-file jobs. Server-file downloads first complete the
viewing pack, retain scoped target metadata and use separate server/account video paths. They
resume by byte range, verify SHA-256 before publication and remain
separate from server administration. Local partial files are retained after errors; they are
not advertised as playable. An explicit sign-out continues to restrict offline account access.

Administration's media import dialog targets existing works. Server-folder imports preview
file/episode mappings from incoming folders or unregistered library files, with pagination. The
native picker uploads copies with durable offsets and a SHA-256 source fingerprint. YouTube previews
run in the media worker and let the admin exclude entries, select quality, edit numbering/titles
and choose episode thumbnails. The standard whole-work editor reviews catalog changes before
saving; downloading is a separate subsequent job. Artwork staging can leave retained unassigned
assets if a review is abandoned. A failed acquisition does not undo an already reviewed episode.

File retirement uses seven-day trash, restore and explicit permanent purge. File reassignment
changes catalog ownership links without moving video or rewriting tracking. The normal viewer
never receives server filesystem paths or server credentials. The admin inventory exposes managed
relative paths, not arbitrary filesystem navigation.

A fresh native binary/production-bundle loopback run verified mpv streaming, seeking and embedded
tracks. It does not establish installed Flatpak/Fedora or physical-input acceptance. The retained
three family collections have moved on Fedora, but have not been matched or published through a
new installed media service in this checkpoint.
