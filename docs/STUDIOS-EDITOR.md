# Studios editor checkpoint

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

Migration `0030_regular_paper_doll.sql` only adds a default-empty, non-null JSONB column. Its local
application was backed up and rehearsed on a restored database with original-column fingerprints
for all 75 tables. Private receipts and backups are under `data/backups/studio-links-20261019-locked`.
The checkpoint tool now hashes every journalled SQL file when binding rehearsal to application.
Rollback requires the previous application version plus removal of this additive column only after
exporting any newly entered links; prefer retaining the unused column to preserve entered data.

Focused verification:

- `devenv shell -- pnpm check`
- `devenv shell -- pnpm --filter @nahhasio/linux-ui test:e2e tests/studio-editor.spec.ts`
- `devenv shell -- pnpm --filter @arcadia/cli exec tsx src/editor/entity-references.acceptance.ts /absolute/private/backup-directory`

The persistence check refuses a non-rehearsal database and rolls its fixture transaction back.
Browser fixtures cover tabs, links, relationships, review/save and desktop/narrow screenshots.
Browser checks alone do not establish GTK input/rendering or an updated AppImage.

Current native result: seven focused checks passed on the freshly built GTK/WebKit client at
1440×793 CSS pixels, DPR 2, with synthetic data and no runtime/CSP errors or unexpected mock routes.
The enclosing legacy smoke timed out at its later account-navigation step 7; this is partial native
acceptance, not a completed login-to-logout smoke. No physical-input, GPU smoothness, native narrow
layout or AppImage acceptance is claimed. The ignored report is under
`data/previews/work-review/studio-native-episodes-1440/`.
