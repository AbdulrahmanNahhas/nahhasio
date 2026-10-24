# Streaming playback matrix — untested

Prepared 2026-10-24. All result cells are deliberately blank. No page-load, documentation,
URL-mapping, browser-fixture or content-filter check counts as playback acceptance.
Previous user reports remain in STREAMING.md, separately from this fresh run.

Series cases use S1 E1; movies use their named film identity. Test both requested DUB and
explicit secondary audio where supported. Record the actual spoken language and subtitle
facilities rather than trusting the request URL. PrimeSrc series may be marked not applicable
during execution because its TVMaze numbering adapter is deliberately absent.

[Detailed empty CSV](STREAMING-TEST-MATRIX.csv) has 136 provider/title rows (119 base cases plus 17 E13 regression cases), with separate audio,
subtitle, upload, controls, seeking, fullscreen, popup, latency, error and native-bundle fields.

| Provider   | Arcane | Just Add Magic | Witch Hat Atelier | Frieren | Toy Story | The Imaginary | Fellowship of the Ring |
| ---------- | ------ | -------------- | ----------------- | ------- | --------- | ------------- | ---------------------- |
| VidLink    |        |                |                   |         |           |               |                        |
| VidNest    |        |                |                   |         |           |               |                        |
| VidSrc     |        |                |                   |         |           |               |                        |
| VidFast    |        |                |                   |         |           |               |                        |
| VidSrc.to  |        |                |                   |         |           |               |                        |
| VidRock    |        |                |                   |         |           |               |                        |
| VixSrc     |        |                |                   |         |           |               |                        |
| VidCore    |        |                |                   |         |           |               |                        |
| VidZee     |        |                |                   |         |           |               |                        |
| Cinextream |        |                |                   |         |           |               |                        |
| NontonGo   |        |                |                   |         |           |               |                        |
| VidAPI     |        |                |                   |         |           |               |                        |
| PrimeSrc   |        |                |                   |         |           |               |                        |
| VidHawk    |        |                |                   |         |           |               |                        |
| Cinezo     |        |                |                   |         |           |               |                        |
| SuperEmbed |        |                |                   |         |           |               |                        |
| Mapple     |        |                |                   |         |           |               |                        |

## Test phases

1. **Anime first:** Witch Hat Atelier S1 E1 (then E13, the previously failing case),
   Frieren S1 E1, and The Imaginary (film). Test every provider enabled for anime,
   including generic providers inside “تريد المزيد؟” that may have selectable English audio.
   English audio is required for the primary result; Japanese-only playback remains secondary.
2. **Series:** Arcane S1 E1 and Just Add Magic S1 E1.
3. **Films:** Toy Story (1995) and The Fellowship of the Ring (2001).

For each attempt record spoken English and Arabic captions **working simultaneously**.
Only that combination with successful playback earns `preferred_star=yes`. A subtitle menu,
a DUB URL, an English-subtitle track, or an upload button alone cannot earn it. Uploaded Arabic
subtitles count only after they display correctly with English audio; note that upload was needed.
Keep provider/server/retry observations distinct. No successful work implies all its episodes work.

The current registry has **zero verified results and zero stars**. Previous reports did not establish
English dub plus Arabic captions together on these anime cases. Do not fill result cells in advance.

After each phase, review results and adjust `apps/linux/resources/streaming-registry.json`:
remove a provider entry or set `enabled: false` to disable globally; remove a media type to disable
only that category. Keep its observations for history. These rules are enforced by native launch,
not just hidden in the picker. Detailed observations remain in this matrix; reviewed exact-target
results can be promoted to the compiled registry. No automatic family-catalog writes occur.

## Acceptance procedure

1. Resolve each exact work/film/season/episode through the authorized catalog. Do not guess
   sequel IDs or round fractional episodes. Missing identity is a mapping failure, not missing media.
2. Launch the freshly built GTK client with the same privacy filter used in normal playback.
3. Select one source, click Play, observe decoded moving video and audible dialogue. Record
   English audio, available subtitle languages, Arabic captions, upload, seeking and controls.
4. Test normal/fullscreen transitions and recovery after a failure. Record error text and
   whether a retry worked; preserve independent provider/server outcomes.
5. Keep captures private/ignored. Do not save third-party tokens or CDN URLs in the matrix.
   A browser success and GTK failure must be recorded separately.
