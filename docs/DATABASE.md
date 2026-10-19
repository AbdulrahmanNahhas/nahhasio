# Database, catalog and media ownership

The database/catalog, images and tracking are Nahhasio's primary product. Playback, source
selection, server retention, device downloads and saved metadata build on stable catalog IDs.
Read [PROJECT](PROJECT.md) for intent and [ROADMAP](ROADMAP.md) for current/future tasks.

## Applied foundation — 2026-10-18

The live development database now has **75 public tables** and **30 applied migrations**.
The four additions are `server_instance`, `devices`, `library_roots` and `title_trailers`.
Current preserved catalog counts: 226 works, 375 installments, 1,879 episodes, 843 images and
1,626 playback-state rows. All original column values/rows in the backed-up 71 tables survived;
TVDB recovery values remain on five works. Three legacy device IDs were registered without
changing existing download ownership or paths. No existing table was deleted.

See [SCHEMA-FOUNDATION.md](SCHEMA-FOUNDATION.md) for the full change list, 75-table service-owner
inventory, backup/rehearsal/apply commands, verification evidence and the two remaining phases.
The new schemas do not imply implemented playback/import/admin services. Episode stills, dub
fields and YouTube trailers still need their Phase 2 API/client consumers. Authentication and
internal records need protected projections, not raw secret-bearing table views.

## Inspected live inventory — 2026-10-13

Read-only `./bin/nahhasio schema`, `stats` and targeted schema inspection reported:

| Measure                 | Count |
| ----------------------- | ----- |
| Public base tables      | 71    |
| Works                   | 226   |
| Installments            | 369   |
| Episodes                | 1,852 |
| People                  | 339   |
| Organizations           | 167   |
| Award recognitions      | 141   |
| Planets                 | 11    |
| Registered image assets | 836   |

This is a dated snapshot, not a permanently current count. No data/schema was changed.

## Existing concepts to reuse

- Catalog: titles, aliases/trivia, installments/episodes, scores, vocabularies/labels, credits,
  people/studios, planets, relationships, awards, provider identities and source evidence.
- Tracking/social: account playback/title states, view history, preferences, follows, collections,
  reviews/comments/reactions, notifications and optional family activity records.
- Access: accounts, authentication/session records, capabilities and existing restriction/policy
  tables. Initial product use is an admin account and a family user, not new profile machinery.
- Administration: audit logs, editorial revisions, jobs and saved views.
- Media: media assets/assignments, files/tracks, device-download records and Jellyfin media links.

Do not rebuild these concepts or remove populated tables because Alpha initially uses fewer
features. Inspect ownership/links and define migrations before adding duplicates or deleting data.

## Actual inspected definitions

`account_title_states` already has `is_favorite`, `personal_rating`, `notes` and `saved_offline`.
A saved flag is account-level intent, not a video download or a proof of per-device cached files.

`account_playback_states` already has work-part/episode ownership, position/duration, played state,
manual completion, timestamps and subtitle offset. Initial offline mutations are progress and watched/unwatched only; ratings/notes edits are not
offline mutations. Queued updates need an explicit conflict/idempotency policy; the current columns do not establish accepted synchronization.

`account_preferences` has preferred/allowed audio, subtitle mode, track switching and autoplay
alongside presentation settings. Use existing preferences where suitable; do not equate catalog
language, audio language and subtitle language.

`media_files` links files to installments/episodes and records path/duration/probe metadata.
`media_tracks` describes tracks. File paths/locations, variants and missing-file recovery need
source-aware ownership; record existence is not proof that bytes are available.

`account_downloads` records account, part/episode, device identity, path, size and state. Device
files and their actual readiness remain device-owned; this table is not a server-library job queue.

`media_assets` stores hash/path/MIME/size/dimensions/focal position and variant parent; assignments
link assets to owners/roles. Keep asset identities while moving artwork storage to the server.
Image variants are not a reason to create another independent artwork identity history.

Jellyfin mappings are optional external links. `background_jobs` and `editorial_revisions` are
existing building blocks; inspect contracts before treating them as complete production services.

## Three storage owners and an explicit source policy

1. PostgreSQL: canonical catalog/links/permissions/personal state and server records.
2. Home-server filesystem: durable library videos, artwork and server-side subtitles/staging.
3. Client storage: saved-work snapshots/artwork/source identities, downloaded video and queued
   offline tracking. Keep these scoped to server/account and independent of server availability.

A work can exist without video. The whole work can allow torrent playback or be intentionally
files-only; no part/episode overrides initially. No results/peers is a different temporary state. Download-to-server creates a verified library file;
Download-to-device creates a device copy; Save work creates a metadata/artwork snapshot.

Torrent streaming runs on the client only. The server acquires/retains a torrent file only after
an explicit Download to server request; it does not offer server-side torrent streaming.
Saved works can resolve/play permitted torrents with internet even when the server is unreachable. With no
internet, only local downloaded media plays. Cached provider URLs may expire; retain identities
and re-resolve sources. Do not expose credentials in snapshots or assume server-login availability
is required to browse data already saved on the device.

## Inspection, migration and cutover

```sh
./bin/nahhasio schema
./bin/nahhasio schema account_title_states
./bin/nahhasio schema media_assets
./bin/nahhasio stats
```

Use the nahhasio-db skill. Raw CLI SQL is read-only by default. Do not export session/password
rows or log secrets during inspection. PostgreSQL is canonical; the sole schema history is
`packages/database/drizzle/`.

Before moving the live database/artwork: independent backups, checksum/restore verification,
counts/content/constraint checks, artwork containment/link checks, then approved cutover.
Change configured storage roots rather than casually rewriting stable asset IDs and every path.
Preserve scores/notes/history/account links while implementing or reorganizing media services.
