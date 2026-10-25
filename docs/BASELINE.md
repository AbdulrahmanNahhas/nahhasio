# Current database baseline

Completed locally on 2026-10-20. The existing database stayed in place. All 75 public tables match
their backup fingerprints; no catalog rows, UUIDs, accounts, sessions,
artwork records, viewing history or database functions/constraints were replaced. Only
`drizzle.__drizzle_migrations` was updated in a transaction after a restored rehearsal.

## Active migration history

`packages/database/drizzle/0000_current_catalog.sql` is the new starting point. Its SQL captures
the current database structure, including functions, triggers, indexes and constraints. Its single
Drizzle snapshot matches `schema.ts`; a generation check reported no schema changes. PostgreSQL 17
or newer is required. Keep `pg_trgm` available for the existing search index.

An empty installation applies this baseline. It creates a new server identity and the 16 controlled
credit-role definitions, with no family works, accounts, artwork paths or viewing records. The
existing installation only adopted the baseline's checksum/timestamp; it never ran that creation
SQL and retains its original server identity and data.

The previous 31 SQL files/snapshots are retired from the active checkout. They remain in Git and
in the private backup. There is one migration tree and one ledger, not parallel old/new runners.
Future changes add migrations after `0000`; do not change the baseline once adopted. Rust and
Drizzle both validate applied timestamps/checksums and reject inconsistent or unbaselined populated
databases. Application startup never migrates, imports, seeds or cleans data.

## Recovery checkpoint

The private persistent checkpoint is:

```text
data/backups/current-baseline-2026-10-20/
  catalog.dump           original consistent database, including its original migration ledger
  artwork-0.tar          full configured artwork root, including retained compatibility paths
  migration-history.tar  retired SQL and Drizzle metadata
  baseline-source.tar    exact new active baseline SQL, snapshot and journal
  inventory.json         fingerprints for every row in all 75 public tables
  ledger.json            original ledger evidence
  roots.json             original artwork-root mapping
  checksums.json         SHA-256 checksums of backup artifacts and closeout evidence
  rehearsal.json         restored-data/schema/artwork/constraint acceptance
  applied.json           successful ledger-only adoption receipt
  native-status.json     one applied migration, no pending migrations
  native-noop.json       successful native apply dry run, rolled back
```

These files contain private recovery material and must never be committed. Keep the dump,
artwork archive, root mapping and matching baseline sources together. The backup and its restored
artwork were verified locally; an independent copy remains required before production cutover.

The rehearsal restored the database and artwork to separate locations, compared all public table
fingerprints and complete public schema dumps, verified all 1,055 artwork SHA-256 values, and ran
23 rolled-back constraint/trigger assertions. A separate empty database was created with the actual
Rust migration runner and produced the same schema. Temporary rehearsal databases and extracted
artwork copies were removed after acceptance; the original database and verified archives remain. Both native/Drizzle continuation directions,
whole-work preservation and editor/media/report fixtures passed using disposable data.

Before live adoption, the tool verified artifact checksums and the exact rehearsed baseline,
acquired the shared migration lock, locked public tables against writes and compared the current
schema, data and old ledger with the checkpoint. It replaced only ledger entries, rechecked all
public fingerprints before commit, and wrote a receipt afterward. Native status now reports
`applied: 1, pending: []`; a subsequent apply dry run was a no-op.

## Commands and future updates

Normal operators use the compiled tool with an explicitly selected database:

```sh
./bin/nahhasio migrate status --json
./bin/nahhasio migrate manifest --json
./bin/nahhasio migrate apply --dry-run --json
```

For a future schema change: generate an additive migration, review its SQL and any hand-owned
functions/triggers, back up, rehearse on a restored copy, verify preservation/compatibility, then
apply the approved migration explicitly. Source snapshots alone do not include every database
function/trigger; preserve those SQL definitions in the same history.

The one-time baseline-adoption helper and its private rehearsal helper are retired from the
checkout after completed adoption; Git retains their exact sources. Do not repeat adoption on an
already-baselined catalog. Restore the original pre-baseline dump only into a separate instance;
it has the original ledger and needs its matching source archive. Never overwrite newer family
edits with that checkpoint as an ordinary rollback.

## Deployment boundary

Baseline adoption was a local preservation checkpoint. Hosting, transfer, updates and installed
acceptance follow [DEPLOYMENT](DEPLOYMENT.md). The retained original dump has an older ledger;
recovery must keep its matching source history and must never overwrite newer family edits.
