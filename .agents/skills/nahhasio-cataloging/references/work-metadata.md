# Work metadata and review

[Cataloging workflow](../SKILL.md)

## The rest of the record

- **`summary`** — Arabic, three to five sentences: premise and central conflict, no spoilers for
  late developments.
- **`trivia`** — an ordered list of short Arabic facts about the title's origin, setting, and
  production, shown as a plain list on the title page (distinct from `contentWarnings`/
  `analysisNotes`, which are cautionary/judgement fields, not trivia). Optional — leave it empty
  rather than padding it. When you do have material, house style is three kinds of fact, in this
  order:
  1. **origin/story** — where the story came from: original, or adapted from a named book/manga
     and its author.
  2. **place** — the real-world place or period that inspired the setting, if any.
  3. **notable facts** — any number of standalone production/reception facts (casting trivia,
     records set, connections to other works, production hardships).

  > Castle in the Sky: `الأصل والقصة: قصة أصلية كتبها هاياو ميازاكي، مستلهمة من جزيرة "لابوتا" الطائرة في كتاب رحلات جاليفر لجوناثان سويفت.`, `المكان: عالم خيالي مستوحى من مناجم وقرى ويلز في بريطانيا إبان الثورة الصناعية.`, `أول فيلم يُنتج رسمياً تحت اسم "استوديو جيبلي".`

  Each fact is its own array entry (own row in `title_trivia`), in display order.
  `./bin/nahhasio work apply`'s usual `--mode` rule applies: `--mode replace` makes the document's
  array the whole list (anything already there and not repeated is dropped); the default
  `--mode merge` only appends the given facts after whatever is already there — reorder or edit
  existing ones with `--mode replace` and the full list, not merge.
- **`planets`** — the browse universes (`adventure-fantasy`, `emerald`, `bonbon`, `action`,
  `future-technology`, `comedy-fun`, `darkness-mystery`, `history-knowledge`,
  `sports-challenge`). A work has at most one planet (the schema enforces this). `./bin/nahhasio planet list`.
- **`genres` / `tones` / `tags`** — reuse existing vocabulary. Run `./bin/nahhasio genre list`
  first; only pass `--create-missing` when you have confirmed nothing suitable exists, or you
  will fragment the taxonomy.
- **`credits`** — roles are reusable vocabulary, including custom roles; entity-kind compatibility is enforced
  (`./bin/nahhasio role list`). Person roles and organization roles are distinct; an animation
  studio must be an organization.
- **`workflowStatus`** — new titles start `draft`. Promote to `published` once summary,
  classification, both prose fields, and at least one scored installment are in place.
- **`isPrivate`** — hides a title from the family-facing catalog.
- **`releaseYear`** — on the title; individual `releaseDate`s go on installments.
- **`kind`** — one of `animated-movie`/`animated-series`/`live-action-movie`/`live-action-series`.
  Only its animated/live-action half is a real column (`titles.format`); the movie/series half is
  derived from whether the title has any `season` installment, so it always agrees with the
  structure — set `format` and the installment structure, never `kind` directly.
- **External ids (`tmdbId`, `imdbId`, `anilistId`, `malId`)** — TVDB fields were retired; do not
  add `tvdbId` to documents. The supported identifiers exist on titles and installments; choose
  their owner according to the movie/series structure and the actual provider entry:
  - **Series titles (`animated-series`/`live-action-series`)** — set them **on the title**. The
    title owns the show-level identity. An installment may have its own AniList/MAL or other
    provider entry when that provider identifies the specific season/special separately. Verify
    the actual owner; never copy an umbrella/show identifier onto every installment.
  - **Movie titles (`animated-movie`/`live-action-movie`)** — set them **on the installment only**,
    never the title, even when the title has just one film. A title can hold several films (a
    franchise like Toy Story), each with its own distinct TMDB/IMDb id, so there is no single id
    that correctly represents "the title" — the admin editor's artwork search for a movie title's
    own poster/banner/logo uses its *first* film's id for exactly this reason. Leave
    `title.tmdbId`/`title.imdbId` null for every movie title; a value there for one is a bug, not
    extra coverage — the CLI does not stop you from setting it, so this is on you to avoid.
  - AniList/MyAnimeList only catalog animation — never set `anilistId`/`malId` on a live-action
    title.
  - `anilistId` and `malId` are used only where they add real value — leave
    them null rather than guessing.
  - Verify what you set actually landed: `./bin/nahhasio sql "select canonical_title, tmdb_id,
    imdb_id from titles where canonical_title='<name>'"` for the title, or join `installments` for
    a movie's own id. A stale admin-editor tab can still show old values after a write — reload
    it rather than assuming the write failed.

## Self-check before publishing

- `contentWarnings` and `analysisNotes` are both present, in Arabic, and specific.
- The theology level matches what `analysisNotes` actually argues.
- The risk levels do not contradict `contentWarnings`.
- Every installment has all six scores, or none.
- Scores sit sensibly against comparable works — check `stats top` if anything is above 9.
- Genres, tones, and credits reuse existing terms.
- The title has a planet, a release year, and a poster.
- External ids identify the correct owner: show-level entries on the title, separately identified
  seasons/specials on their installment, movie entries on the movie installment only
  (`title.tmdbId`/`title.imdbId` must be null for movie titles, even for a single film).

## Dubbing, sources, trailers and episode artwork

- Whole-work `playbackPolicy` is `torrents-allowed` or `files-only`. Do not infer files-only
  from Arabic dubbing alone; use Aqua's declared source policy. No episode/part overrides.
- `dubLanguages` records confirmed available dubs, using language codes such as `ar`, `en`,
  `es`; `dubbingNotes` carries useful Arabic details. Do not invent edition/version systems.
- Credit dubbing organizations with the `dubbing_studio` role and `languages: ["ar"]` (or the
  actual languages). Reuse compatible entities/roles; custom roles are allowed. All credits
  remain whole-work credits; do not create installment credits to imply unsupported detail.
- `planets` contains zero or one existing planet. Preserve current membership unless requested.
- `trailers` stores YouTube video IDs, not downloaded videos. Preserve IDs/order/primary choice
  when editing existing entries. Verify provider links rather than guessing them.
- Episode `media.still` must refer to registered server-owned artwork assigned to that episode.
  Ingest with `--role still --episode <UUID>` before referencing its path. TMDB still imports
  preserve source evidence; respect manually chosen images. Video screenshots are still pending.
- Nahhasio owns metadata, artwork, tracking and direct stored-file delivery. Jellyfin is retired;
  do not treat its legacy tables as an active metadata, artwork or tracking integration.
- Torrent streaming runs on the client; server downloads require an explicit request. Saved
  work metadata/artwork, server videos and device video downloads are separate things.

Read [service ownership](../../../../docs/catalog/service-ownership.md) for implementation status. Historical examples in this skill
are editorial references, not guaranteed current counts. Use current exports/statistics to
calibrate. Aqua's personal “classic” means a work watched in Arabic, regardless of release age;
do not assign that label from age or popularity alone.
