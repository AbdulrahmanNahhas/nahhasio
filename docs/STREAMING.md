# Streaming provider checkpoint

Nahhasio offers provider-hosted embeds, Torrentio and Comet, plus a separate English-dub anime flow
using anipy-api and the native player. See [the anime checkpoint](ANIME-DIRECT.md) for ownership,
quality/subtitle limits and checks. ani-cli and Cloudstream are not integrated. Opening a catalog
work does not contact online providers; anime search is explicit, torrent discovery starts
when the torrent tab is selected (the default on opening the source picker), and an embed starts
only after clicking a provider. Torrent, anime-direct and server
modes are visible peer tabs; each server is a single Play action, and opening a device file
lives in the source overflow menu (directly available for files-only works). Unknown capabilities and
repeated provider-request notes are omitted from the picker.
The capability listing reads the authorized catalog only; it does not probe all providers.
Saved device video still takes precedence when available. Download remains a separate torrent
workflow and never opens an embed or starts playback.

Torrent language filters include reported languages and a separate English hint for generic
Dubbed/Dual Audio release tags. Inferred English uses an approximation mark and a short tooltip;
it does not modify native track metadata. Explicit foreign-dub and negated-dub tags are excluded
from that inference. Search, quality and language filters combine; sorting supports provider order,
peer count and size. Provider, quality and language controls share one wrapping filter row.

## Torrent discovery and future debrid configuration

The native `torrent_sources.rs` coordinator queries Torrentio and Comet concurrently, with
independent eight-second timeouts and provider error/status replies. A failure never discards
the other provider's results. Results retain provider identity, including when the same torrent
appears in both; source IDs are namespaced by provider. The picker defaults to both and can filter
each provider. Refresh retries discovery; selecting a torrent remains explicit.

Comet uses Aqua's supplied English/Arabic preset: English required, Arabic/English allowed and
preferred, trash removal enabled, no debrid credentials, and sub-720p resolutions excluded.
The preset is encoded in native code, never sent through the JavaScript bridge. Upstream
[Comet configuration normalization](https://github.com/g0ldyy/comet/blob/main/comet/core/config_validation.py)
enables torrents without a debrid account even with the supplied `enableTorrent: false` value.
The shared response parser bounds each provider to 2 MiB and 200 candidates. Provider redirects
remain disabled, request URLs are not logged, and untrusted direct/debrid URLs stay unplayable.

Future debrid configuration links (recorded for a later checkpoint):

- [Torrentio configuration](https://torrentio.strem.fun/configure)
- [Comet configuration](https://comet.elfhosted.com/configure)
- [Jackettio configuration](https://jackettio.elfhosted.com/configure)

All three expose debrid configuration, but this checkpoint only adds Comet torrent discovery;
Jackettio is not integrated. Later debrid support needs explicit private configuration ownership,
credential storage/redaction and guarded HTTPS playback. Adding credentials to an addon URL alone
does not enable debrid playback. Never put a configured URL containing tokens into Git or the UI.
The Comet-enabled native client was rebuilt and fully relaunched after an older process was
found still running. Live provider/playback acceptance has not been performed for this checkpoint.

## Player controls

The seek bar is a thin track above compact black pills for transport, volume, time and tools,
following the AniLight/AnimeX references. It has no separate large background. Volume expands
on hover or keyboard focus when the player is wide enough; the settings menu always provides
a volume slider. Container queries use the player's width, with fewer shortcuts in narrow mode.
Embedded controls are absolutely anchored to the video frame,
so they cannot contribute extra height to its aspect-ratio layout. Seek buttons retain their
ten-second accessible names without independently positioned number labels. Pointer interaction
wakes the controls temporarily; visible keyboard focus and open panels keep them available.
Ten-second seeks sit beside Play/Pause. Episodes and Download have direct shortcuts beside the
other tools when the player has room, and remain available through Settings in narrow layouts.
Audio/subtitle panels use a wider, opaque surface, taller rows, scroll fades, language markers,
actual track details and explicit selection. A language with one track selects it immediately;
multi-track languages open their track list. Flags are decorative language markers only, never
evidence of a dub's country or origin; generic Arabic uses a globe.
A compact settings menu shows current values and
submenus for speed, tracks, subtitles and volume; source selection, episode navigation and keeping
a torrent download live there too. Back restores focus to its setting row; closing an episode
shelf or source drawer returns to the gear control. Unavailable casting controls are omitted.
Aspect ratio, automatic intro skipping, automatic next episode and picture-in-picture appear as
disabled future settings, with no implemented behavior or persisted preferences. The source sheet
has rounded corners, a visible border and no header separator. Visual/native playback acceptance
remains for review.

The timeline rests at 4 px and grows to 6 px on hover, keyboard focus and active dragging,
with a pointer cursor and without changing its hit area
or shifting nearby controls. Player popovers use the actual video frame as their collision
boundary; their width/height follow the available space inside it, including embedded playback.
Track panels have slightly denser rows and spacing, and the episode shelf fades horizontally
at its scroll edges. Track/language lists use the dialog's single vertical scrollbar instead
of nested list scrolling.

## Ownership and extension points

| File                                                     | Responsibility                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/linux/src/stream_provider.rs`                      | Fixed adapters, catalog IDs, audio requests, review notes and mapping capabilities.              |
| `apps/linux/src/stream_bridge.rs`                        | Typed commands, authenticated catalog resolution, session ownership and stale-request rejection. |
| `apps/linux/src/embed_privacy.rs`                        | Locally compiled content filtering for known trackers and literal private-network URLs.          |
| `apps/linux/src/stream_capabilities.rs`                  | Scoped subtitle capability evidence, separate from audio requests and title availability.        |
| `apps/linux/src/embed.rs`                                | Disposable unprivileged WebKit surface, same-window navigation, status and lifecycle.            |
| `apps/linux/src/playback_header.rs`                      | Solid contextual native header and app-wide fullscreen hiding.                                   |
| `apps/linux/src/display.rs`                              | Episode-number display formatting, including retained playback titles.                           |
| `apps/linux/ui/src/features/player/stream-providers.ts`  | Typed native replies, query keys and provider actions.                                           |
| `apps/linux/ui/src/features/player/source-selection.tsx` | Source-mode coordination, status, retry and switching.                                           |
| `apps/linux/src/torrent_sources.rs`                      | Parallel Torrentio/Comet discovery, default Comet preset and independent provider status.        |
| `apps/linux/ui/src/features/player/provider-browser.tsx` | Searchable provider actions, positive capabilities and direct click-to-play.                     |
| `apps/linux/ui/src/features/player/source-controls.tsx`  | Torrent candidates, provider/quality/language filters and explicit file selection/downloads.     |

Adding another provider requires a reviewed provider identity/URL mapper and capability entry
in the Rust registry, with mapping and native acceptance. `stream.providers` returns typed
capabilities without returning URLs to the UI. Do not accept arbitrary UI-supplied URLs or
install remote executable provider code. No database changes or persistent source preferences
were introduced by this checkpoint.

The embed replaces the viewing surface in the same application window. Back returns to source
selection and destroys the remote page. Its in-memory browser session is reused for retries of
the same player session and provider, preserving verification cookies; switching provider or player session replaces it.
Changing videos, opening a device file, selecting
a torrent or closing Nahhasio also disposes of the embed. A cancelled pending request cannot
reopen an older embed. Native media is stopped before the provider receives playback ownership.

## Provider policy and preferred results

`apps/linux/resources/streaming-registry.json` is the versioned, release-owned registry of provider
policy and reviewed results. `stream_registry.rs` reads it once and fails closed if invalid.
No external lists, downloaded code, provider URLs, tokens or browsing history are loaded from it.
The registry is compiled into the client: edits require rebuilding/relaunching; it is not an admin
settings screen or a database migration. PostgreSQL catalog ownership is unchanged. A future
admin-managed result store can use this exact-target contract without catalog availability guesses.

Each provider has an `enabled` flag and a `mediaTypes` allowlist (`anime-series`, `anime-film`,
`series`, `film`). Removing a provider or category prevents both listing and direct native launch.
Adding a new provider still requires a reviewed Rust adapter and typed bridge identity; JSON
cannot add arbitrary remote URLs. Existing type restrictions now live in this one registry.

Anime primary choices request English dub. Secondary/sub/unspecified audio and historically
problematic providers live behind **“تريد المزيد؟”**. A confirmed result may promote a generic
provider with selectable English audio into the primary list. Stars sort first and mean actual
playback **with English audio and working Arabic subtitles simultaneously**, for the exact
provider, request mode, media type, public title identity, season and episode. They never follow
from player documentation, page load or a different episode's success. Latest matching observation
wins, so a later failure revokes the star. The initial `results` array is empty.

Each reviewed result uses this shape (example values only; do not add it before testing):

```json
{
  "provider": "vidnest",
  "mediaType": "anime-series",
  "identity": "mal:52991",
  "season": 1,
  "episode": 1,
  "audio": "dub",
  "playback": true,
  "englishAudio": true,
  "arabicSubtitles": true,
  "testedAt": "actual test date",
  "clientBuild": "actual tested revision and build"
}
```

Identity prefixes are `imdb:`, `tmdb:`, `mal:` or `anilist:`. Use the season-specific anime ID;
film season/episode are null. `audio` is the requested adapter mode, even when English was selected
inside an `original` provider. Append observations in execution order. Record the exact provider
server, Arabic upload requirement, retry and quality/control details in the matrix, without URLs
or tokens. Stars are historical evidence and can become stale; they are not uptime guarantees.

## Providers and anime audio

The seventeen adapters are VidLink, VidSrc, VidSrc.to, VidFast, VidRock, VidNest, VidHawk,
Cinezo, SuperEmbed, Mapple, VixSrc, VidCore.org, VidZee, Cinextream, NontonGo, VidAPI and PrimeSrc. They use documented fixed origins/endpoints; a compatible
catalog mapping does not establish that a remote title/episode or server is available.

- Movies/TV put VidLink first; VidHawk is anime-only. VidLink is omitted for anime per Aqua's review.
- Anime puts VidNest first based on Aqua's successful dubbed playback. VidHawk and Cinezo
  are collapsed with reported problems. VixSrc and VidCore request English with `lang=en`
  without claiming a verified English track. Anime films use episode 1 on anime-ID endpoints,
  rather than silently dropping their dub choices; this film mapping remains unverified. No automatic
  sub fallback parameter is enabled. These are **dub requests, not verified English tracks**:
  the remote provider owns the result and may still report unavailable or serve incorrect audio.
- Explicit sub routes and providers without audio selection are collapsed under the clear
  secondary audio filter. They open only after explicit selection.
- Anime detection uses recorded MAL/AniList identifiers or curated anime tags/planet slugs,
  never country alone. Anime IDs describe a season: a work-level ID may cover the first season
  or sole film, but is never reused for a later season. Missing identifiers show a disabled
  provider with a reason; no guessed title/ID matching or live catalog edits occur.
- Whole-work files-only policy suppresses all online controls and is rechecked by Rust on
  every launch. Local/device playback remains separate. Torrentio behavior is unchanged.
- The generic TV adapters retain the existing season ordinal/episode mapping; provider-specific
  numbering differences and actual English dub coverage require per-title review.

Adapter documentation checked for this stage:
[VidLink](https://vidlink.pro/), [VidSrc](https://vidsrc.sh/vidsrc/docs/),
[VidSrc.to](https://vidsrc.to/), [VidFast](https://vidfast.vc/),
[VidRock](https://vidrock.net/), [VidNest](https://vidnest.fun/),
[VidHawk](https://www.vidhawk.buzz/), [Cinezo](https://cinezo.live/),
[SuperEmbed](https://www.superembed.stream/) and
[Mapple](https://mappletv.uk/docs/getting-started/endpoints),
[VixSrc](https://vixsrc.to/), [VidCore](https://vidcore.org/), [VidZee](https://vidzee.wtf/),
[Cinextream](https://cinextream.cc/), [NontonGo](https://www.nontongo.win/),
[VidAPI](https://vidapi.ru/api) and [PrimeSrc](https://primesrc.me/).

Cinextream has dedicated AniList/MAL dub/sub adapters. NontonGo anime audio is unspecified; it is
kept under secondary audio choices. VidAPI uses the documented `vaplayer.ru` player; its `lang`
parameter is a subtitle preference, not an English-audio switch. PrimeSrc is films-only here: its
series API needs a TVMaze numbering adapter. No identifiers are guessed to fill those gaps.

### Aqua's manual review, 2026-10-24

Past observations influence initial selection and collapse providers with reported failures.
Test-status labels are kept out of the product interface. These are dated manual observations,
not uptime checks or per-title availability guarantees.

| Scope                       | Observation                                                                                                                                | Picker behavior                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Witch Hat Atelier / Frieren | VidNest played English dub, with only English subtitles and no Arabic/external upload in those players.                                    | First anime choice with explicit subtitle limitation.                                               |
| Witch Hat Atelier / Frieren | VidHawk failed; Cinezo failed or lost controls.                                                                                            | Collapsed manual retry group; no claim of repair.                                                   |
| Toy Story                   | VidLink, VidNest, VidFast, VidRock and VidSrc.to played. VidFast offered subtitle upload; VidRock offered OpenSubtitles but poor controls. | Initial ordering with scoped notes.                                                                 |
| Toy Story                   | VidSrc failed verification once, then worked with Arabic OpenSubtitles.                                                                    | Retry-once guidance; no automatic reload loop.                                                      |
| Toy Story                   | Cinezo non-finite error, SuperEmbed load failure, Mapple 404.                                                                              | Collapsed problem group. Mapple now requests TMDB; fix not playback-verified.                       |
| The Imaginary               | No dub found in the previous picker.                                                                                                       | Anime-film dub routes now offered, plus new English-audio requests; actual availability unverified. |

PrimeSrc series are deferred pending an exact TVMaze numbering adapter; its movie adapter is included. The rest of the supplied provider list has not been exhaustively
playback-tested. New providers were added from their own endpoint documentation, not marketing
claims about coverage or subtitle availability. No live catalog records were changed.

## Boundaries and monitoring

The remote WebView has its own ephemeral network session and content manager, with **no catalog
bridge or app session credentials**. Provider/host cookies exist only in that disposable session.
Downloads, new windows and permission requests are denied. Non-HTTPS navigation is denied;
`about:blank` and `about:srcdoc` verification frames are allowed within the isolated provider view;
top-level provider replacement is restricted. The main UI CSP and native origin guard are unchanged.
A local WebKit content filter blocks a bounded set of known advertising/tracking domains,
cleartext HTTP resources and literal private-network/localhost targets. WebRTC and DNS prefetch
are disabled. The filter must compile and install before loading the provider (failure closes
that attempt). It is cached for the running application and uses a private temporary directory.
It does not fetch remote rules or execute downloaded extensions. The isolated native
`--embed-filter-smoke` compiled the actual rules successfully without provider access.

This is basic protection, not full uBlock Origin, anonymity or a guarantee that every ad is removed.
A remote provider still sees the public IP and requested media. Hostname resolution/DNS rebinding
and ads served from media hosts are not comprehensively covered by literal-URL rules. Provider
playback must be tested with the filter enabled; do not relax TLS, CSP, origin or bridge guards
in response to a provider error. These technical limitations belong in documentation, rather
than repetitive copy in the source picker.

`stream.status` reports `closed`, `loading`, `loaded` or `failed`, plus blocked-popup count and a
bounded application error. HTTP error responses such as 404 become `failed`, not `loaded`.
An in-page application error returned with HTTP 200 can still escape this detection. **Loaded means the provider page loaded, not that video is playing.**
The player itself may show a verification/content/network error that WebKit's page loader cannot
classify. The source picker keeps bounded diagnostics in a collapsed details area. Its normal content focuses on selection, audio and subtitles.
Native logs identify the actual provider and use bounded `stream: provider=... event=...` events and error domain/code; they omit
resolved media URLs, provider tokens and session secrets.

Quality, audio and subtitle controls belong to the selected embed provider. Nahhasio's native mpv controls apply only
to native sources. Automatic provider progress/watched synchronization, subtitle injection,
download, dubbed-language guarantees and continuity of playback position when switching source
types are not implemented. Nahhasio still owns manual catalog watched state.

## Review and playback test stage

[Design plan](STREAMING-DESIGN.md) records the selection layout. Search and audio filters are
local and do not contact providers. Selecting a row does not launch it. English-dub requests
are the main anime list; secondary audio remains explicitly selectable behind the More disclosure. Capability evidence
is separate from exact-work audio availability. There is no persisted preference or new database state.

[Playback matrix](STREAMING-TEST-MATRIX.md) and its [CSV](STREAMING-TEST-MATRIX.csv) contain
17 providers by 7 requested works (136 empty result rows including the Witch Hat Atelier E13 regression). The current preparation stage does
not fill playback results from endpoint documentation or previous observations. Manual testing
must record actual video, audio, subtitles, controls and errors in the freshly relaunched client.

Provider status polls once per second while loading, every five seconds after page load, and
stops when closed or failed. Closing through the native Back action invalidates UI status.
Native player polling slows while no native source is selected. No background availability sweep
or automatic retry loop is introduced.

VidRift was researched but deferred because its documentation requires iframe framing; this
checkpoint uses an isolated top-level surface. Other suggested hosts without a dependable
current primary endpoint reference were deferred rather than guessing integrations.

## Native runtime and verification

The development shell supplies GLib networking for HTTPS and GStreamer base/good/bad/libav
plugins for WebKit media. The installed Flatpak uses the supported GNOME runtime and pinned native media modules;
actual Flatpak installation still requires separate acceptance. Never disable certificate validation.
After runtime or bridge changes, fully quit the client and relaunch from the updated environment:

```sh
devenv shell -- nahhasio-client
```

Fixture-backed selection tests live in `apps/linux/ui/tests/player/player.journey.ts`. They cover
explicit launch, no automatic torrent search, switching, errors/retry, provider switching, anime dub requests, files-only suppression,
RTL focus restoration and 1440/520-pixel layouts. They do not contact VidSrc or mutate family data.

A separate opt-in native page probe uses a fixed public movie identifier, an isolated NON_UNIQUE
GTK process, no catalog/credentials and no persistent browser state:

```sh
devenv shell -- cargo build --locked -p nahhasio-linux --features native-diagnostics
mkdir -p data/previews/vidsrc-native
devenv shell -- env NAHHASIO_SMOKE_OUTPUT="$PWD/data/previews/vidsrc-native" \
  bash bin/nahhasio-native-runtime target/debug/nahhasio-linux --embed-smoke
```

The probe bounds its lifetime and reports page status, bridge absence, codec capability and
read-only frame diagnostics. Captures remain private/ignored. It does not prove successful video,
Arabic subtitle upload, seeking, physical keyboard input or GPU smoothness. Inspect its screenshot
and test those behaviors separately before claiming provider playback acceptance.

## Preparation verification — 2026-10-24

- Seven focused Rust adapter/bridge/policy tests passed; six Chromium source-picker fixtures passed
  at the checked desktop/narrow layouts, including the synthetic preferred-star case.
- Repository lint, formatter, contract generation and workspace TypeScript checks passed.
- Linux UI production build and native `nahhasio-linux` build with `native-diagnostics` passed.
  Client-only Clippy (`--no-deps --all-targets -D warnings`) passed.
- Full `pnpm check` stops at the pre-existing deprecated `fetch_update` call in
  `crates/media-transfer/src/lib.rs:461`; no unrelated transfer-engine edit was made.
- Native content-filter compilation passed separately. No live catalog mutation or provider
  playback acceptance is claimed. Fully relaunch the updated app before Phase 1.
