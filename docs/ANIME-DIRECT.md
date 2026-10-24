# Anime direct playback checkpoint

Anime series and anime films use a separate source desk: one English-dub native flow, followed
by a deliberately secondary disclosure for the existing torrent and embed choices. Western
animation such as Arcane keeps the film/TV flow. Whole-work files-only policy excludes both.

## Design plan

Keep the reviewed semantic palette (background #0a0a0a, card #171717, secondary #252525,
foreground #fafafa, muted #a3a3a3, primary #6149f7) and current Noto/Plex Arabic typography.
Feature code uses theme tokens. The distinguishing element is a clear vertical sequence,
not another provider gallery: anime identity first, quality second, one Play action last.

    [English DUB]                         [our player]
    [source: AnimeHub / AniDBApp]
    [editable anime title] [Search]
    [matching anime/season choices]
    [available qualities + subtitle availability]
    [Play in Nahhasio]
    [Want more?] -> existing torrent/embed choices

No first-result autoplay or automatic Japanese fallback. Search is explicit; matching a season
is a user choice, not a fuzzy title guess. Candidate and quality selection do not start playback.
The subtitle note says only that an Arabic file can be added through the native controls. It
must not imply a subtitle was found. Preferred stars still require separately reviewed evidence.

Quick UI review pass: retain the same palette/type and RTL alignment, use a compact provider row,
bounded full-row season choices, quality tiles and a separated footer with the selected source
beside Play. Keep the play sequence above; remove the standing instructions and show subtitle
guidance only after qualities arrive. One panel, no extra nested cards or decorative motion.

Watch-page review: keep charcoal background/card/secondary (#0a0a0a/#171717/#252525), pale
foreground (#fafafa), muted text (#a3a3a3) and violet accent (#6149f7), with the existing Noto/Plex
type. A shared right-aligned title/action/description area sits below every video, then family
discussion in the same column. The companion sidebar is a compact queue for movies/episodes or
brief film facts for a single movie. Poster/still shapes distinguish the queues; only the current
item gets a filled surface. Use explicit catalog rating, never an invented rank, and recorded
external IDs only. No extra provider requests or automatic playback are introduced.

Reviewed watch sidebar behavior now distinguishes movie collections from mixed season/film/special
works. Movies and specials in mixed works share a detail sidebar with the installment selector,
explicit Watch action and adjacent-part navigation; browsing does not switch playback. The sidebar
labels browsing, selected and playing states separately. Film/special headers keep genres beside
the poster, and recorded organization credits reuse the directory's 16:9 contained studio-logo
presentation. Pure movie collections retain their poster queue. Recommendations remain limited
to the existing work endpoint/cache and are disabled in the mixed installment detail sidebar.

## Ownership and runtime

- `apps/linux/anime/resolver.py`: one bounded request per process, using pinned anipy-api 3.10.1.
  Fixed AnimeHub/AniDBApp providers, DUB only; it does not own playback, tracking or downloads.
- `anime.rs`: typed helper protocol, opaque candidate/stream IDs and ten-minute in-memory scope.
- `anime_bridge.rs`: authenticated catalog policy/release checks, active player-session and stale
  request checks before attaching a stream. No helper URL or credentials reach the React UI.
- `direct_gateway.rs`: native capability URL, checked/pinned public HTTPS DNS, checked redirects,
  bounded HLS rewriting and streamed media. Network playback still uses the native loopback
  boundary. Remote playlists cannot introduce local-file or private-network resources.
- `packaging/linux/anipy-resolver.nix`: hash-pinned upstream wheel and Nix dependencies, used by
  both development and the AppImage wrapper. No runtime pip installs or remote executable lists.
  The API's own player/download dependencies are omitted because Nahhasio supplies those modules.

The Python helper strips inherited app credentials/configuration and disables proxy/environment
request settings. It validates HTTPS destinations and filters each DNS lookup to public addresses,
limits response size/time and suppresses upstream exception strings. Rust bounds its lifetime/output
and kills it on timeout. These are client requests, not home-server acquisition jobs.

Native mpv controls, tracking, audio/subtitle selection, subtitle delay/style and local Arabic
SRT/ASS/SSA/VTT loading are reused. Provider-supplied subtitle URLs, when available, are contained
through the same native gateway. Automatic OpenSubtitles search is not part of this checkpoint.
No persistent provider-title mapping or catalog migration is introduced. A film requires the
selected provider result to expose exactly one episode; a series resolves the exact episode number.

Primary references: [anipy provider API](https://sdaqo.dev/anipy-cli/reference/anipy_api/provider/base/),
[current providers](https://sdaqo.dev/anipy-cli/availabilty/) and
[upstream source](https://github.com/sdaqo/anipy-cli).

## Checked at this checkpoint (2026-10-24)

The freshly built Linux binary decoded AnimeHub's Frieren episode 1 and The Imaginary
(`Yaneura No Rudger`) through the same resolver/gateway/native-player path. Both advanced past
two seconds with at least 50 rendered frames. The Imaginary reported 6,486 seconds duration.
AnimeHub returned **720p only**, with no provider subtitle tracks, for both requests. This is
the quality returned by that provider, not a client quality cap; no 1080p availability is claimed.
AniDBApp returned no Frieren search results during this check. Spoken-language correctness and
subtitle synchronization remain Aqua's review; the helper requests English DUB exclusively.

The initial mpv `-17` failure came from blocking nested HLS reads. Sanitized HLS uses its own
native mode allowing HLS demuxing and references; local/torrent playback retains its existing
restriction. Every HLS resource still passes through the checked gateway. Rewritten playlists
have proper playlist filenames and a complete HTTP 200 response, even if upstream returns 206.

Focused gateway tests and eight browser player journeys passed, including explicit anime
selection, missing-dub recovery, files-only exclusion and retained embed/torrent alternatives.
TypeScript, lint and formatting passed. The full `pnpm check` reaches the existing unrelated
Clippy deprecation at `crates/media-transfer/src/lib.rs:461` (`fetch_update`). AppImage installation,
automatic subtitle search, physical control input and a wider provider playback matrix are not
accepted by these checks. No catalog writes or new checkpoint commit were made.

Reproduce the isolated native checks without family catalog/authentication:

```sh
devenv shell -- cargo build --locked -p nahhasio-linux --features native-diagnostics
devenv shell -- env -u DATABASE_URL -u NAHHASIO_SERVER_TOKEN -u NAHHASIO_EDITOR_SECRET \
  bash bin/nahhasio-native-runtime target/debug/nahhasio-linux --anime-smoke
# Add --anime-smoke-film to check The Imaginary instead of Frieren episode 1.
```
