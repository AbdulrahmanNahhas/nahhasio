# Small independent development catalog

`development-pack.py` prepares a bounded catalog/artwork sample for an independent local database.
It uses the compiled Rust CLI's real `work export`, `work apply`, typed reference operations and
artwork ingest. It does not copy authentication tables, sessions, tracking, provider keys or host
configuration. It never resets, shrinks, truncates or deletes the current laptop catalog.

This is preparation tooling; no pack was exported and no database was created while implementing
it. Runtime acceptance uses disposable data after the deployment code is complete.

## Export a selected sample

Build the CLI through the normal development environment. Select one to thirty work UUIDs; ten
to twenty representative films/series are enough for ordinary UI work. Each installment keeps
its first four episodes by default. At most one hundred referenced images are copied by default.
Change those bounds explicitly with `--episodes-per-part` (1–20) and `--max-images` (0–500).

Set `NAHHASIO_SOURCE_DATABASE_URL` privately to the source database URL. The source CLI operations
use read-only transactions. Select the actual configured uploads/public roots explicitly:

```sh
devenv shell -- cargo build --locked -p nahhasio-cli
python3 packaging/development/development-pack.py export \
  --work-id '<selected-work-UUID>' \
  --work-id '<another-selected-work-UUID>' \
  --source-artwork-root "$PWD/data/media/uploads" \
  --source-public-root "$PWD/data/media" \
  --output "$PWD/data/development-packs/sample-01"
```

The new private directory contains `pack.json` and copied, checksum-addressed images. It is not
a disaster-recovery backup: it omits most episodes, non-primary artwork, cross-work relations,
award ceremony links and private curator notes. Selected work/part/episode IDs and primary
artwork bytes remain useful for development. Referenced vocabulary/planet/role/entity records
are included without account data. Do not commit private exported packs.

## Initialize a separate empty local database

Create an empty database explicitly, for example `nahhasio_dev_local`, on a local PostgreSQL
instance. Keep the normal source catalog untouched. Set
`NAHHASIO_DEVELOPMENT_DATABASE_URL` privately to that new database URL. The tool accepts only
loopback/local-socket connections to a database named `nahhasio_dev_*`, refuses matching source
and target database identities, and refuses any target that already has public tables.

```sh
devenv shell -- python3 packaging/development/development-pack.py initialize \
  --pack "$PWD/data/development-packs/sample-01" \
  --artwork-root "$PWD/data/development-local/media/uploads" \
  --confirm-empty-database nahhasio_dev_local
```

Run through `devenv shell` so the existing pnpm development seeder is available. Both URL
environment variables remain required for the explicit source/target refusal boundary. During
initialization only the target is contacted. URLs and upstream command output are not printed.

Initialization applies the canonical bundled migration chain to the empty target, giving it a
new server UUID. It imports selected reference records, ingests copied artwork and remaps paths,
then dry-runs and applies each whole work through the guarded CLI. Finally the existing explicitly
development-only seeder creates its local test identities with compatible password hashes. No
production password or account record is copied. Its standard demo credentials belong only in
this isolated local database; do not use the development seeder on the family server.

A partial failure leaves the new development database/files for inspection; the script never
automatically drops a database or overwrites an existing artwork root. Use another newly created
empty target for a fresh attempt. Pack documents remain private and are not changed by import.

## Use it for development

After independently checking the sample, configure your local development override to use the new
database and artwork roots. Preserve the full source catalog/recovery copy until the family-PC
transfer has been accepted. Configure development's `DATABASE_URL`, `NAHHASIO_MEDIA_ROOT` and
`NAHHASIO_PUBLIC_MEDIA_ROOT` explicitly; keep provider settings in a separate private development
directory. Never point automated mutation tests at the authoritative family server.

The installed family client may connect to the real server independently of this development
environment. They are separate server identities, so their sessions, caches and tracking do not
become the same library merely because both clients run on Shadow.
