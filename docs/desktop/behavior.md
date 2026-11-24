# Client behavior

[Documentation index](../README.md) · [Architecture](architecture.md) · [Design rules](design-rules.md) · [Verification](../development/testing.md)

**On this page:** [Sign-in and settings](#linux-settings-sign-in-and-artwork) · [Search](#catalog-search) · [Browse](#browse-and-filters) · [Watch](#watch-page) · [Admin coverage](#administration-coverage)

Current behavior and reviewed UI contracts. This guide does not claim installed Flatpak, physical
input or provider acceptance. The hosting release excludes player/provider testing. Design rules
remain in [design-rules.md](design-rules.md).

## Linux settings, sign-in and artwork

Settings opens Account. Its compact icon-and-label navigation covers appearance, player preferences,
storage, connection, and support. Extensions appears as a disabled navigation item. Administrators
can open the existing server settings from the list. Appearance includes device-local dark and
light modes, a system-following option, and standard and large interface sizes. Both preferences apply
immediately and persist on the device. Account contains the profile editor for name, biography and
avatar editing. Profile, Security, and Device are stacked on one page. The avatar opens a larger
picker with filters and saved-image restore. Save and Undo appear while the profile has edits.
Security groups email, password changes and sign-out in compact rows. Device lets viewers switch directly to a
saved account or forget it after confirmation, and links to storage and updates. Server testing and
editing are available inline under Connection. Episode keyboard focus scrolls the complete card
into view. In the Episodes catalog and work installments, activating the thumbnail or title opens
the selected episode in the player page. The separate Info action opens the episode details.
Thumbnails show the pressed scale during pointer and Enter activation when motion is enabled.
Library card/table
presentation remains in Browse, not Settings. Narrow layouts use a five-destination
Home/Library/Search/Downloads/More dock; desktop retains its navigation rail. The desktop account
menu groups library shortcuts, settings, and connection/account actions. Direct Watch appears as
a disabled upcoming item in that menu. Existing profile,
password, download-cache, server-connection and Flatpak-update services remain
the owners of their controls. Playback Settings focus on subtitle track selection, appearance,
and synchronization. Existing audio preferences remain in device storage. Unstyled text subtitles support
white or yellow text, bold, and an optional dark background.
Restore Defaults prepares a reset for saving. mpv receives these defaults
before a new local, saved, torrent or compatible direct source loads; manual track/style changes
remain session-local. Arabic subtitle preference falls back to English. Debrid and addon
installation remain future integrations.

Settings → Playback shows OpenSubtitles configuration status. The server connection is managed
in the server environment and is shared by signed-in viewers. An API key enables search and the
configured account enables downloads. Older personal connections can still be used on the native
device if its server has no shared configuration or cannot be reached. The app does not offer
credential entry.
The browser preview displays server status. The native player owns applying subtitles.

Search uses the current catalog work's canonical title, provider identifiers and season/episode;
year/season/episode overrides remain available on demand. Movie identity never falls back to a
parent TV show's identity. Search URL normalization follows at most three redirects within the
same API host/path, without forwarding credentials elsewhere. Release results retain provider
accessibility/translation flags. Download and apply explicitly consumes the provider allowance;
file-download redirects remain bounded and revalidated without API credentials.
The last manually chosen or downloaded subtitle for a catalog episode/movie is copied into
`episode-subtitles-v1/` under the native device state root, isolated by account/server and catalog
identity. It is restored to that video's tracks across episode changes and application restarts;
original files and server media remain untouched. Arbitrary unlinked local videos remain
session-only. Retained subtitle copies are separate from the disposable OpenSubtitles download
cache. Hash matching and additional subtitle providers remain deferred.

Device library opens directly from the sidebar download icon. Its Saved works, Videos, Transfers
and Storage views separate full viewing packs from downloaded video and disposable caches.
The work-page Save action opens Device library once saved; only Saved works offers an explicit
refresh. Saved cards show any retained videos and their playback/management actions. A viewing
pack contains work/part/episode details, summary, artwork, source identities and viewing state;
video is optional, and internet sources still need internet. Settings links to Device Library
storage for video usage and temporary torrent cleanup and provides a separate artwork cache action.
Admin imports opened within an installment retain that destination;
completed uploads remain staged until reviewed episode matching and import complete.
Banner mirroring creates new registered artwork, retains original dimensions, and changes only
the editor draft until review/save; the original artwork remains available.

Real OpenSubtitles acceptance still needs a configured provider account; controlled fixtures do
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
on every desktop, physical input, provider playback or real-catalog performance. See [Testing](../development/testing.md)
for fixture/native acceptance procedures. Schema migration and deployment remain explicit.

## Home

Home presents the featured hero, Continue Watching, recent releases and episodes, library picks,
upcoming releases, planets, awards, studios, and credited people. Data-dependent shelves appear
when they have entries. Linked headings open the corresponding directory or a filtered Browse
view. The recent releases shelf is ordered by release date. Catalog additions and edit history
remain available as sort options in Browse.

Planet tiles use catalog colors and emblems. They show the latest public released installment's
banner when available, with the parent work's banner as a fallback. The awards shelf opens the
Awards directory and individual award archives. Studio logos and contributor portraits use the
directory cards and link directly to the associated works.

The Planets directory shares Home's landscape tiles. It adds work counts and keeps name search
and the direct links into each planet. Planet detail headers use a square version of the artwork
tile. Banners load near the viewport or when a tile receives focus. The Work page places its
planet tile below the parental guide, using the current work's banner.

Arrow keys reach the hero controls, move horizontally within a shelf in physical RTL direction,
and move between rows and section links. Tabs retain their own horizontal keyboard behavior.
Tab and Enter retain normal link and button behavior. Scrollable shelves keep their edge fade
and leave room around the focused cards. Work-card ratings use a top-right circle out of 100,
with blue for 90–100, green for 75–89, amber for 60–74, and coral below 60.

## Themes and trailers

**الشارات** opens first at `#/trailers`, with separate Trailers and All views. A responsive artwork
grid shows the clip and work names, language when available, and a play link to YouTube. The left
side of the filter toolbar offers Grid, Table, and three sizes. Layout and size stay in the URL
along with the active category and filters.

The server classifies registered YouTube references using explicit theme and music cues in the
clip title. When an older server rejects category filtering, the client applies the same rule to
bounded pages of results and keeps the selected category. If more pages remain, the user can
continue searching from the current position.

## Awards browsing

Open **الجوائز** from Home or the library navigation. Each award has a poster shelf for up to
five distinct winning works, ordered by its latest recorded wins. The award archive opens on its
newest recorded year and groups winners and nominees by category. Entries with no recorded year
have their own selection. Each result opens the associated work and installment when recorded.
Both views show recognitions linked to viewer-visible works in the Nahhasio catalog.

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

## Profiles

- All profiles use `/profiles/:id`. The `/profile` shortcut opens the signed-in member’s profile
  using its canonical URL. The owner’s Edit Profile link opens `/settings?section=account`.
- The overview uses the same identity header and navigation for everyone. Owners can edit their
  profile and see previews of in-progress works, recent completions and favorites. Visitors see
  family-visible collections, reviews and comments under the existing server access rules.
- Activity lists retain pagination and spoiler controls. Viewing statistics distinguish completed
  works, episodes and films. Device, preference and policy records are excluded from profile
  activity. Account and device controls remain available through the existing settings surfaces.
- The viewing calendar is labeled as upcoming in owner statistics.

## Catalog search

Ctrl+K, the desktop navigation rail, the mobile dock and the native header open the same search
dialog over the current page. Empty All shows three recently added public works and shortcuts
to library pages. Works shows up to six recent additions. Films and Series show up to six titles
ordered by their latest released installment.
These selections require both a registered banner and a logo. People shows up to eight credited
entries in a compact version of the directory's portrait cards, ordered by creation date when the
server supplies it, with a link to the full directory. Empty Studios
uses the directory's landscape logo cards, with up to eight studios across all roles ordered by
work count. Its link opens the full directory with the same filters and four-column size. The
shared entity artwork frame uses the work-card tilt and focus treatment with reduced-motion
support. Planets uses compact cards and lists all active planets, including those
with no public works. Only All displays visible section headings.
Older `#/search` links open the dialog over Home and seed it with any supplied query, scope and
authorized privacy choice. A link with an obsolete scope opens All with its query.

All groups matches into works, credited people, studios, planets, and pages. The dedicated scopes
expand a group, with paginated works and separate filters for films and series.
Exact names are highlighted where a match is available in the loaded results. On desktop, moving
through results with the pointer or arrow keys updates the preview alongside the list. Works use
a full-width banner and logo in the preview; entity previews show their portrait, logo, or planet
symbol. Group expansion previews show the number of matches and an action to open the scope. The narrow
dialog fills the viewport and keeps the query and scope controls above the scrolling results.
Down moves focus from the query to the selected tab, then into the first result or shortcut.
Up returns from the top of the results or shortcuts to the tab strip and query. Scrollable search
regions keep space around focused content. The keyboard
focus ring follows the selected row while the results list has focus. Left and Right switch
tabs or navigate across shortcut cards. Enter opens the selected result and Escape dismisses
search. The footer shows the result count and gives administrators a switch to include private
works for the current search. Reach it with Tab or toggle it with Alt+P while search is open.

## Browse and filters

### Current behavior

- Browse has an inline title search over the full filtered result set. The RTL toolbar offers
  a library category dropdown, viewing state, sorting, grouping, advanced filters, display preferences
  and a works/installments toggle. Search and filters use server pagination.
  The table title, release date and score headers toggle the same server-side sort as the toolbar.
  The results page shows up to three active filter chips before a disclosure for the rest.
- The left-side filter drawer uses scrollable sections with jump buttons and compact
  include → exclude → clear chips. Search and result-count actions stay visible.
  Search matches Arabic/English names, slugs and aliases through an explicit public-field
  allowlist. Fixed choices remain available at zero matches. Large groups reveal more options
  incrementally and preserve their selection order. Available Arabic labels and aliases take
  precedence in filter options.
- My Library comes first with watch status and favorites. Release and Playback groups release
  availability, server video files, and playback policy. Release Details contains privacy and
  the year range. Release type distinguishes seasons and standalone releases in installments view.
  The Apply button carries the preview total. Audience/age and colored content-risk groups keep
  their compact arrangement. Legacy dub languages and content-warning presence are hidden from
  the picker. Existing legacy selections remain removable from the applied chips.
- Overall rating uses a two-handle range slider. Six independent criterion sliders retain
  minimum thresholds, individual resets and a shared reset. All thresholds use 0.1 precision.
- Work status uses completed, ongoing, upcoming and unknown; installment status retains airing.
  Administrator privacy filtering follows the privacy flag independently of editorial state.
  Family accounts can browse public draft and published works. Draft is an administrator
  revision marker; private works remain restricted.
- Studio grouping uses one primary animation studio, or a primary production company when
  no primary animation studio is recorded. Supporting studios and distributors do not create
  extra groups; the studio filter still searches all credited organizations.
- The display drawer offers poster, banner, logo and table views. Card titles, metadata,
  ratings and release badges are independent switches. Cards and tables each use one title
  language, with Arabic selected by default. Banners place enabled text over their artwork
  and the table has individually selectable columns, thumbnails and density. Older preferences
  remain readable. Card layouts start with medium posters without overlays, compact banners
  with all details and Arabic titles, or large frameless logos without overlays. Each layout
  remembers its settings across switches and reloads. Reset restores the defaults for every layout. The drawer initially focuses the active layout.
  Use horizontal arrows inside choices, vertical arrows between controls, and Enter to activate.
  Preferences are device-local and scoped by server/account.
- Browse has a confirmed manual watched action at work or installment scope that preserves
  playback progress. The action appears as a text button in the optional table watch-status
  column and as a toggleable icon on cards. Card focus and hover retain the watch-state colors
  when the icon is hidden. Season posters show episode count and omit per-episode runtime.
- Browse templates are fixed product definitions in `browse-templates.ts`, not user-editable
  saved views. Changing category keeps the search, compatible refinements and presentation.
  The selected category defines its fixed facets, which the filter drawer describes alongside
  the available refinements. Earlier saved-view documents remain readable.
- Draft Apply, Cancel/Escape, focus restoration, a debounced result count and server pagination
  remain in place. Schema and live catalog records are unchanged.

## People and studio directories

People use portrait cards and studios use square logo cards by default. Both directories offer
card size and shape controls under **العرض**, name and alias search, and sorting by work count or
name. Filters cover artwork, role, and contribution language when available. Both directories show entries
with and without artwork by default. Studios opens with the animation studio role selected.
Administrators can include hidden works.
The grid starts with up to 24 cards and Show More adds up to 24 at a time. Detail links carry
the directory's search, filters, sort, and display settings.

## Episode editing

The Linux work editor presents compact episode rows with stills, titles, dates, duration and a
summary excerpt. Search and missing-image/metadata filters operate over the complete selected
installment; pages show ten results. Episode metadata opens in a draft dialog. Duplicate episode
numbers are rejected, fractional positive numbers are preserved, and image updates preserve IDs
and unrelated metadata. Deletion retains the existing dependency check and save review.

### Image workflow

The work editor offers work poster, banner and logo, installment posters, and episode image
controls. The separate Images library can assign a registered banner to an installment.
Work detail projects installment artwork and episode cards can fall back to its banner.
Browse banner cards use the parent work banner and fall back to a poster.

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
The browser development preview opens the same watch page with episode navigation and details.
The video frame identifies playback as a Linux app feature and makes no native playback calls.

### Layout and native video

The desktop Arabic layout places the native video beside a transparent episode column. The
episode list stays sticky while details and discussion scroll. It offers search, sort, and an RTL
All/Unwatched control with scroll fades. Watching, downloaded, and completed indicators can appear
together. Wide windows group episode information, navigation, and viewing actions directly
below the video. Content and theology notes show the stored work risk levels. Narrow windows put the
work link and viewing actions above the video. The horizontal episode strip opens by default,
sits before ratings and discussion, and can be collapsed. On phone widths, episode search
opens from the filter row. Selecting an episode returns the narrow layout to the player. The rating strip uses
Nahhasio's stored installment and work scores when available and links to the full score
breakdown. The sidebar toggle sits alongside the viewing actions in wide windows. Movies use the full width and expose
no episode sidebar or episode toggle. Film collections use a horizontal installment strip in
narrow windows. The installment selector and playback actions sit ahead of supplementary film information.
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
The viewer feed is reused, with 30-second refresh while online. The collapsed composer opens on
request and keeps its draft when folded. Adding a 1–5 star score to a new top-level post saves a
review. Each account has one review per work, which it can edit or remove. The bounded endpoint
also supports creating, replying to, updating, and hiding comments. Older servers continue to
load the feed and accept comments through the original request. Identity comes from the authenticated
account, checked in a write transaction; parent comments must belong to the same work and be
visible. Edits cannot change parent/work/author. Hiding a comment preserves other people's replies.
The request body supports 1200 Arabic characters without exceeding the byte limit.

Comment drafts stay in component state across source errors and episode changes within the work.
Posting failures retain the draft. Switching a nonempty draft to another reply/edit requires an
explicit discard decision. Spoiler text is concealed, long posts can be expanded, and delete has a confirmation. Offline mode
shows discussion as unavailable; comments are not added to the offline mutation queue.

## Work page details

The Work page is a continuous screen. The sharp banner scrolls with the hero and fades into a
blurred copy of the artwork that stays pinned behind the page. A panel on the
opposite side shows the next watch target and progress when available, plus shortcuts to work
details and the Nahhasio score. On narrow screens the panel stacks below the playback controls.
Play, save to device, and trailers share the main action row. Video downloads and the favorite
toggle are in the More menu. The watched control sits next to the viewing information.
Unfinished works of every format show the next watch target and a progress bar. With a single
released item, the bar can show partial playback when its duration is known. Completed works
place the watched check, work details, and score in one compact row and label the playback
action **إعادة المشاهدة**. Film release cards place playback beneath the synopsis.
The hero groups age, year, and viewing length in one panel. It calls out works that are airing
or upcoming. Full format and release status are in Work Details. Genre links open Browse with
that genre selected.
The desktop hero spans the available width and adjusts its height to the window. The synopsis and tags
appear immediately below it, separated from episodes and releases by a divider. The parental guide
and planet cards use the same width in the sticky desktop sidebar. The planet artwork links directly
to its page. On wider series pages, the sidebar also links to the available release, credits, and family
discussion sections.
Hero controls use a light backdrop blur.
The panels below use translucent surfaces over the already blurred artwork. Square studio cards and
portrait people cards share one horizontal shelf, with studios first. Each contributor’s roles
appear on the same card. Studio cards show their roles. Family discussion sits below recommendations and shares the player’s composer,
threaded replies, spoiler controls, and comment management.

For works with multiple installments, the selector shows artwork, episode count or runtime, and a
mark beside the current selection. It opens as a menu on desktop and a drawer on phones. On phones,
the toolbar sits between the release card and the episodes, with icon buttons for sort and download.
Single movies use the hero for playback. **عن الفيلم** combines the synopsis and tags with
the recorded release date, format, languages, and directing credits. The poster sits alongside
the overview on wider screens, and credits follow it in the main column alongside the sidebar.
Where shown, the installment
card includes release information, score, and languages, with seasonal progress along the
card’s bottom edge once episodes have been released. Upcoming releases show their status and
release date when recorded. The info button beside the season or film title opens release-specific
details, such as parental rating differences, recorded tracks, external references, and artwork.
The Work page previews the first nine episodes in the chosen sort order. **عرض كل الحلقات**
opens the full episode view with filters for all, watched, or unwatched episodes.
**العودة إلى العمل** returns to the preview. Episode thumbnails show watch status, and their
floating info button opens details and the episode's download action.

Work Details, Score, Episode Details, and video downloads open in bottom drawers under 768 px.
Work Details starts with a compact release-fact grid, including the first and latest recorded
release dates when they differ. Trivia follows the release facts. Classification chips open Browse
with the corresponding filter, including recorded dubbing languages. Country chips show a flag
when the catalog entry provides a recognizable country code.
Provider and reference links are in **المصادر الخارجية** under the Work hero’s More menu.
This menu also includes the release links for a single movie. For any work without usable
provider IDs of its own, the menu picks up IDs and references from the first installment.
The desktop dialog has a close button. Award rows show the result, linked installment, and safe
source link when available, with actions beside the award details on wide screens. Score opens on
the overview and shows the score out of 100 where available.
The radar chart is visible on wider screens, with criterion bars on all layouts.
Criterion bars use a score-specific color for each whole-number band out of 10. Installment rows
expand to show individual criteria. The question-mark button opens the calculation in a popover
on wider screens and a nested drawer on narrow screens. The desktop interface uses Western digits
for UI-formatted numbers and dates.
Legacy Work page links continue to resolve.

**دليل الوالدين** summarizes Nahhasio’s age and audience rating and the three recorded risk
categories. Each meter has five segments, with 0, 1, 2, and 4 filled for none, low, medium, and
high. The desktop dialog and mobile drawer also show a combined profanity and alcohol
row marked **غير مقيّم**, with a divider before any recorded content warning and analysis notes. On
mobile, the drawer opens directly to the risk meters. The warning icon uses the higher of the sexuality and behavior ratings, and the analysis icon uses
the theology rating.

Online administrators can enter **تحرير العمل** from the viewer page. The page hosts the same
editor workspace used by the admin dashboard, including fields for unfilled data, the revision
check, change review, and the unsaved-draft guard. Server-side authorization applies to every
editor request.

## Work recommendations

The viewer's work page requests up to ten other draft or published, non-private works through
`GET /api/v1/catalog/recommendations?workId=…`. The current work is excluded. All eligible
candidates are ranked in PostgreSQL; the client receives only ten summaries and their explanations.
No migrations, catalog mutations, viewing-history inference or third-party recommendation service
are involved. Recommendations appear in a horizontally scrolling shelf with only posters and a similarity button on each matched poster. With fewer
eligible works the section shows fewer cards. Offline mode hides it.

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
  then explicitly import. A review contains at most 1000 missing episodes, grouped by work and season. Existing primary stills
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

The global media library opens with paginated work coverage; the file inventory keeps its source,
availability and trash filters. Work-specific management opens the single Structure tab and its canonical installment/episode
workspace; the duplicate Media tab is removed and older Media links resolve to Structure. The same
canonical episode rows retain their artwork and editable metadata, with a compact file control for
no file, available copies, missing disk files, verification, active imports and trash/restore.
File details and actions open on demand; file lists are paginated. New draft episodes must be
reviewed and saved before attaching files. Movies expose files on their installment instead.
Importing is paused while the work has unsaved catalog edits; file inspection and actions remain
available. Reviewed import metadata refreshes the canonical editor after saving.
The global inventory remains available for operational filtering across works. Episode cards reserve
a thumbnail slot, use a clear missing-image placeholder, and keep edit/delete in a separate action
rail. Image removal lives in the artwork dialog. TMDB season selection is searchable and accepts
explicit season numbers; it does not change the catalog installment identity.

Server files are allowed for every work. With torrents/providers allowed, a work can have files
for its early seasons and only internet sources for later seasons. A missing server file does not
make such an episode invalid. Files-only is a whole-work restriction on viewer internet sources;
it is not a requirement for server imports or a separate episode database.

A fresh native binary/production-bundle loopback run verified mpv streaming, seeking and embedded
tracks. It does not establish installed Flatpak/Fedora or physical-input acceptance. The retained
three family collections have moved on Fedora, but have not been matched or published through a
new installed media service in this checkpoint.

Editorial language badges belong to each work. An installment inherits the base languages unless
an explicit override is set; the work page shows their union and each installment its effective
languages. These labels do not set player audio preferences or torrent/provider filters. Existing
dubbing notes and contributions remain separate. English is the creation default; the additive
migration preserves Arabic legacy labels and defaults tagged anime to English/Japanese. Review
Japanese-only exceptions explicitly. Upload completion is verified by a durable media worker job,
not a long-running API request. Verified uploads appear directly in the upload import source.
Intentional permanent purges retain an audit identity but no longer count as missing disk files.

A missing managed video has an explicit “remove missing-file registration” confirmation in the
existing file menu. This uses seven-day trash, retains any verified surviving subtitles and counts
only retained bytes. Restore returns its registration and surviving companions; the video remains
missing unless verified bytes are present. Permanent purge retains history and leaves catalog
episodes, artwork, progress and explicit watched state intact. Unsafe paths, foreign roots and
changed bytes require review instead of being treated as absent files.

The installment toolbar has a compact temporary files/internet display switch. It hides file
controls and their queries without changing playback policy or the catalog document. Switching
parts retains this editor-only choice while the Structure view stays open. Files-only works
always show file controls and have no internet display option. The work-level source policy uses
a two-option control. TMDB episode-image galleries expand to a wide three-column desktop view.
Poster/banner/logo search results share multi-select language/source filters: Arabic and English
are selected initially; clearing a filter includes all values, including neutral artwork.

Images management is isolated in the Images tab: work/installment selection, direct source search
and file upload, plus paginated episode artwork and reviewed batch still selection. Only the
selected installment and twelve visible episodes mount artwork controls. Structure retains
read-only thumbnails and episode/file editing. IDs remain editable in Structure and together in
Indexing; external references and related works also live in Indexing.

Media review refinement: non-files-only works open Structure in the internet view. Server library
coverage includes files-only works and works with non-purged file registrations, including missing/
trash states; mixed-work coverage counts only installments with registrations. Imports can still
target any catalog work. Episode thumbnails open artwork editing directly. Maintenance image
review supports selectable work/season groups (up to 1000 candidate episodes), using ordinal
season defaults. Image rename reviews all matching filter pages up to 5000 assets, hides already
organized names, uses a common work name for same-work shared artwork, and commits in reviewed
batches of 50 with completed batches excluded from retries.
