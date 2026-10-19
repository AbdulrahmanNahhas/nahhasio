---
name: nahhasio-db
description: Read and edit every part of the Nahhasio PostgreSQL catalog from the command line — titles, installments, episodes, scores, awards, people, studios, planets, vocabularies, media assets, accounts, and any other table. Use whenever a task involves querying, adding, changing, deleting, or reporting on Nahhasio catalog data, including creating a whole new work. Covers filtering, statistics, raw SQL, image ingest, and safe write practice.
---

# Nahhasio database CLI

`./bin/nahhasio` talks straight to PostgreSQL. It needs no API server and no `devenv shell` —
run it from the repository root.

```bash
./bin/nahhasio health
```

If that fails with `ECONNREFUSED`, PostgreSQL is not running: start it with `devenv up` (ask
the user first — it is a long-running foreground process).

**Do not use `devenv shell -- pnpm nahhasio`.** The devenv banner writes to stdout and corrupts
`--json` output. Always use `./bin/nahhasio`.

## The one thing to know first

Anywhere the CLI wants an id, you may write a name, slug, or alias instead:

```bash
./bin/nahhasio title get Arcane
./bin/nahhasio title update "Attack on Titan" --set theology_risk=medium
./bin/nahhasio title create --set planet_id=emerald --set canonical_title=…
```

Resolution tries exact match, then prefix, then substring, and also searches `title_aliases` /
`entity_aliases`. An ambiguous reference fails and lists the candidate ids — pass one of those.
This is the main reason not to look UUIDs up by hand.

## Output

Default output is a compact text table (cheap to read). Add `--json` when you need to parse,
`--ndjson` / `--csv` for streaming or spreadsheets, `--wide` to stop truncating long cells.
Errors go to stderr as `{"error":{"message","hint"}}` under `--json`, and exit code is 1.

## Reading

```bash
./bin/nahhasio title list --search frieren
./bin/nahhasio title list --where "theology_risk:in=medium,high" --where "release_year>=2020" --limit 20
./bin/nahhasio title list --count --where "workflow_status=draft"
./bin/nahhasio title list --columns canonical_title,audience,theology_risk --order "release_year desc"
./bin/nahhasio installment list --where "title_id=$(./bin/nahhasio title get Arcane --json | jq -r .id)"
./bin/nahhasio title get Arcane --json
```

Filter operators for `--where` (repeatable, AND-ed):

| Form | Meaning |
| --- | --- |
| `col=v` | equals |
| `col!=v` | not equals |
| `col~text` | case-insensitive substring |
| `col>v` `col<v` `col>=v` `col<=v` | comparison |
| `col:in=a,b,c` / `col:nin=a,b,c` | in / not in |
| `col=null` / `col!=null` | IS NULL / IS NOT NULL |

`list` shows a curated column set; use `--columns a,b` or `--all-columns` to change it.

## Resources

`title` `alias` `installment` `episode` `score` `award` `award-org` `award-category`
`award-ceremony` `entity` `person` `studio` `credit` `planet` `genre` `tone` `tag` `country`
`role` `relation` `org-relation` `external-id` `media-asset` `media-assignment` `account`
`capability` `preference` `content-policy` `review` `comment` `collection` `library` `audit`
`revision` `job` `source` `invite`

`person` and `studio` are scoped views of `entities`. **Any table not listed is still reachable
by its real name** (`./bin/nahhasio jellyfin_items list`). Discover with:

```bash
./bin/nahhasio schema                 # every table
./bin/nahhasio schema titles          # columns, types, nullability, foreign keys, enum members
./bin/nahhasio schema --enums         # every enum and its values
./bin/nahhasio help --json            # the whole command tree
```

Never read `packages/database/src/schema.ts` to find a column name — `nahhasio schema` is
generated from the live database and is cheaper.

## Writing

```bash
./bin/nahhasio title update Arcane --set quality_score=8 --set workflow_status=published
./bin/nahhasio person create --set name='Naoko Yamada' --set sort_name='Yamada, Naoko'
./bin/nahhasio title update --where "workflow_status=draft" --set workflow_status=published --yes
./bin/nahhasio alias delete --where "title_id=…" --yes
```

Rules the CLI enforces:

- `update`/`delete` need **either** a reference **or** `--where`. An unqualified write is refused.
- Deleting more than one row requires `--yes`.
- `--dry-run` on any write reports what would change without committing.
- `--set` values are validated against the real column type; bad enum values list the legal ones.
- Foreign-key `--set` values accept references (`--set planet_id=emerald`).
- `--json-set col='{"a":1}'` writes raw JSON to a `jsonb` column.
- Every write records an `audit_logs` row. Set `NAHHASIO_CLI_ACTOR=<account slug>` to attribute it.

## Creating or editing a whole work

This is the right tool for adding a new title. One JSON document describes the finished state;
the CLI reconciles the database to it in a single transaction.

```bash
./bin/nahhasio work template --json > new-work.json   # filled-in starting point
./bin/nahhasio work apply new-work.json --dry-run --create-missing   # rehearse
./bin/nahhasio work apply new-work.json --create-missing             # commit
./bin/nahhasio work export Arcane --json > arcane.json               # round-trips with apply
```

The document covers the title, its classification, aliases, trivia, genres/tones/tags/countries,
planets, credits, external ids, relations, media, installments, episodes, scores, and awards.
Fields you omit are left alone.

- `--mode merge` (default): only touches what the document mentions.
- `--mode replace`: anything absent from the document is **deleted** (installments, episodes,
  credits, aliases, vocabulary links, awards). Use it to prune, not casually.
- `--create-missing`: create referenced genres/tones/tags/entities/award organizations that do
  not exist yet. Without it, an unknown vocabulary term is an error — which is usually what you
  want, so you do not silently invent a duplicate genre.

Re-applying the same document is idempotent. Installments match on `id`, else on `position`;
episodes the same within their installment.

Editing one field of an existing work:

```bash
./bin/nahhasio work export "Frieren" --json > f.json
# edit f.json
./bin/nahhasio work apply f.json
```

For the editorial content of these fields — how to score, how to write `analysisNotes` and
`contentWarnings`, how to pick a classification — use the **nahhasio-cataloging** skill.

## Statistics

```bash
./bin/nahhasio stats                      # overview counts
./bin/nahhasio stats coverage             # what is missing across the catalog
./bin/nahhasio stats scores               # per-criterion averages and ranges
./bin/nahhasio stats top                  # highest-rated installments
./bin/nahhasio stats classification       # audience/age/risk distribution
./bin/nahhasio stats vocabulary           # genre/tone/tag usage counts
./bin/nahhasio stats planets awards people media
```

Any resource also supports a generic group-by:

```bash
./bin/nahhasio stats titles --by audience,theology_risk
./bin/nahhasio stats titles --by release_year --where "release_year>=2015" --order "release_year desc"
./bin/nahhasio stats score --metric avg:story,avg:craft,count
./bin/nahhasio stats installment --by kind --metric count,avg:runtime_minutes
```

Metrics: `count`, `count-distinct:col`, `avg:col`, `sum:col`, `min:col`, `max:col`.

## Raw SQL

For anything the commands above do not cover:

```bash
./bin/nahhasio sql "select canonical_title from titles where release_year = 2024"
./bin/nahhasio sql --write --dry-run "update titles set quality_score = 5 where id = '…'"
./bin/nahhasio sql --write "delete from title_aliases where title = 'typo'"
./bin/nahhasio sql --file report.sql --json
```

Read-only by default — enforced by a real `READ ONLY` transaction, so a write attempt fails at
the database. `--write` allows mutations and wraps them in a transaction; `--write --dry-run`
executes and then rolls back, which is the safest way to preview a bulk change.

## Images

```bash
./bin/nahhasio media ingest ./poster.jpg --role poster --title Arcane
./bin/nahhasio media ingest https://example.com/banner.jpg --role banner --title Arcane
./bin/nahhasio media assign <asset-id-or-path> --role logo --entity "Studio Ghibli"
./bin/nahhasio media purge --dry-run          # unreferenced assets
./bin/nahhasio media purge --yes
```

Roles are `poster`, `banner`, `logo`, `profile`, `still`. Owners are `--title`, `--installment`,
`--episode`, `--entity` (exactly one). Files are content-addressed by sha256 and deduplicated,
so re-ingesting the same image reuses the existing asset. Assigning a role replaces the
previous primary assignment for that owner.

A work document's `media` field only accepts paths that are **already registered** — ingest
first, then reference the returned path.

## Practices worth keeping

- Rehearse destructive or bulk writes with `--dry-run` before committing.
- Prefer `work apply` over a sequence of granular writes when touching one work: it is atomic.
- Check `stats coverage` before and after a batch of catalog work.
- Reach for `sql` freely for reads; prefer the typed commands for writes, because they validate
  and record audit rows.

## Current foundation and discovery

Use `nahhasio-db` and `nahhasio-cataloging`; the old skill names have been retired.
`./bin/arcadia` remains a silent compatibility alias. Internal `@arcadia/*` package names,
PostgreSQL database name `arcadia`, catalog UUIDs and migration history retain their identity.
The preferred audit variable is `NAHHASIO_CLI_ACTOR`; the old variable remains a fallback.
`NAHHASIO_MEDIA_ROOT` and `NAHHASIO_PUBLIC_MEDIA_ROOT` override artwork roots consistently
in the CLI/API/server; the existing `ARCADIA_*` variables and default paths remain supported.

```bash
./bin/nahhasio help --json
./bin/nahhasio work schema --json
./bin/nahhasio schema trailer --json
./bin/nahhasio credit list --limit 50 --offset 0 --json
./bin/nahhasio device list --limit 50 --offset 0 --json
```

`work schema` and `work template` need no database connection. JSON Schema describes input
shape; database constraints and work-apply validation additionally enforce semantic rules.
Lists default to 50 rows and accept 1–500 rows per page plus a nonnegative offset. Use `--count`
then iterate pages; do not assume one page is the complete catalog. Raw table names cover all
75 current tables, including composite-key tables accessed with filtered lists/updates.
New friendly resources include `server`, `device`, `library-root`, `trailer`, `media-file`,
`media-track`, `playback`, `download`, `jellyfin-server` and `jellyfin-item`.

Whole-work documents now include `playbackPolicy` (`torrents-allowed` or `files-only`),
`dubLanguages`, `dubbingNotes`, ordered `trailers` (YouTube video ID, optional language/title,
primary flag and position), credit `languages`, and episode `media.still` registered paths.
There is at most one planet per work. Episode artwork belongs to the episode UUID; title and
installment artwork must keep their own ownership. Preserve trailer IDs and existing paths.
For a changed work: export → edit → apply --dry-run → apply → re-export and compare.
Never interpret successful schema discovery or table reads as working Jellyfin/scanning/jobs.

## API and credential boundary

This CLI is a trusted local PostgreSQL operator tool, not a family-client login API.
It bypasses HTTP permissions; keep database credentials private and do not expose it remotely.
For application/network work, the single contract is `packages/api-contract/openapi.json`;
regenerate with `pnpm client:generate` instead of editing generated TypeScript.
Rust serves authenticated admin reads at `/api/v1/admin/database/schema` and
`/api/v1/admin/database/{table}` (bounded pages, secret masking); writes belong to dedicated
transactional editors. Never use raw table responses or SQL output to dump authentication
secrets, tokens, private Jellyfin credentials or hashes into logs or committed fixtures.
Startup performs no migration, seeding or cleanup. Use the existing Drizzle history only.
