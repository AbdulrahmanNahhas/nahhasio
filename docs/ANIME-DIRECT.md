# Anime direct playback

The source picker opens on Torrents for every online work. Anime series/films also offer a
separate English-dub direct-stream tab; video servers remain a peer option. Whole-work files-only
policy excludes all online modes. The source overflow menu opens a device file; files-only works
expose that action directly.

## Source picker redesign

Retain the reviewed charcoal palette (#0a0a0a background, #171717 card, #252525 secondary), pale
text (#fafafa), muted text (#a3a3a3), violet accent (#6149f7), and Noto/Plex Arabic typography.
Keep RTL alignment and keyboard selection. Use the video space as a practical source desk:

    [Torrents (default)] [Anime streams, when applicable] [Video servers] [⋯]
    [search / sort]                                    [result count]
    [Torrentio / Comet] [quality] [language]
    [compact source rows: quality, release, size, peers, languages, Play]

The modes are visible peers, never nested under an anime card or a Want more disclosure.
The rare device-file action lives in the overflow menu. Every server is a single click-to-play tile.
Torrent rows expose supplied metadata and separate English hints inferred from Dubbed/Dual Audio
release tags, with full original text behind a short details disclosure. Unknown values and repeated
provider disclaimers are omitted. Quality/language filtering never turns a metadata hint into a
confirmed audio track. Server choices show positive known capabilities only; source selection
still requires an explicit Play action. English-dub anime matching remains explicit and does
not fall back to Japanese. Preferred stars still require separately reviewed evidence.

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
  development only. Installed Flatpak dependencies are locked in `packaging/flatpak/python-sources.json`;
  no runtime pip installs or remote executable lists are used.
  The Nix development helper omits upstream player/download dependencies; Flatpak locks its complete wheel closure offline. Nahhasio owns playback and downloads.

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

## Verification boundary

Provider availability, actual spoken language, subtitles, quality, seeking and physical controls
need dedicated native acceptance. Historical test receipts remain in Git; they do not certify a
new Flatpak. These tests are outside the current hosting release.

Reproduce the isolated native checks without family catalog/authentication:

```sh
devenv shell -- cargo build --locked -p nahhasio-linux --features native-diagnostics
devenv shell -- env -u DATABASE_URL -u NAHHASIO_SERVER_TOKEN -u NAHHASIO_EDITOR_SECRET \
  bash bin/nahhasio-native-runtime target/debug/nahhasio-linux --anime-smoke
# Add --anime-smoke-film to check The Imaginary instead of Frieren episode 1.
```
