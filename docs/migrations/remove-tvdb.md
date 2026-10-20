# Retire TVDB

Historical record: the referenced migration chain is now retired into Git/private backups.
The active starting point is documented in [BASELINE](../BASELINE.md); TVDB data remains preserved.

Retained recovery evidence from 2026-10-08. Verify the current schema and backup contents before
using these steps; the dated read-only/live and disposable-test results are not current activation claims.

TVDB is removed from the active dashboard, API, typed contracts, CLI work documents and
provider search. Fanart movie artwork continues to use TMDB; Fanart series artwork is retired.
AniList remains installment-owned. Existing migration history and the frozen reference website
are historical records and are not rewritten.

## Preservation decision — 2026-10-18

The never-applied `0029_remove_tvdb.sql` proposal has been replaced by
`packages/database/drizzle/0029_nahhasio_foundation.sql`. Applied migrations 0000–0028 are unchanged.
The replacement retains the TVDB columns, indexes and stored values; the schema marks these as
recovery identifiers, not an active provider integration. There is no pending automatic TVDB drop.
See [the approved transition](../SCHEMA-FOUNDATION.md) for the backed-up migration checkpoint.

The removal/rollback evidence below is historical only. Do not apply its removal or restore SQL
as part of an ordinary update. Any future physical retirement needs a fresh explicit decision.

## Verified recovery — 2026-10-08

Private, ignored backup directory: `data/backups/tvdb-removal-20261008/`.

- `catalog-before.dump`: complete custom-format PostgreSQL backup.
- `SHA256SUMS`: dump checksum.
- `title-tvdb-ids.json` and `installment-tvdb-ids.json`: preserved identifiers (five titles,
  zero installments).
- `rollback.sql`: transactional column/index recreation and restoration of those identifiers.
- `verification.json`: results of the backup restore and removal/rollback rehearsal.

The dump restored into `nahhasio_tvdb_removal_20261008_test`. All 71 public tables matched
live row counts and full content fingerprints: 223 titles and 364 installments. Removal
preserved every non-TVDB value. Rollback restored the complete original contents.
Only the isolated database received schema writes; live access was read-only.

This backup shares the laptop with the catalog. Copy it to an independent device and verify
its checksum before a future live schema cutover. If the catalog changes after this backup,
take a fresh backup and repeat the preservation rehearsal before applying the migration.
Use a fresh identifier export for rollback after subsequent edits; an old rollback file must
not overwrite newer values. Do not restore an old whole-database dump over a newer live catalog.
