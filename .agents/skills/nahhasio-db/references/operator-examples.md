# Nahhasio CLI examples

[Database workflow](../SKILL.md) · [Database guide](../../../../docs/catalog/database.md)

## The one thing to know first

Anywhere the CLI wants an id, you may write a name, slug, or alias instead:

```bash
./bin/nahhasio title get Arcane
./bin/nahhasio title update "Attack on Titan" --set theology_risk=medium --write
./bin/nahhasio title create --set canonical_title=… --write
```

Resolution tries exact match, then prefix, then substring, and also searches `title_aliases` /
`entity_aliases`. An ambiguous reference fails and lists the candidate ids — pass one of those.
This is the main reason not to look UUIDs up by hand.

## Output

Default output is a compact text table (cheap to read). Add `--json` when you need to parse,
`--ndjson` / `--csv` for streaming or spreadsheets, `--wide` to stop truncating long cells.
Errors go to stderr as `{"error":{"message"}}`, and exit code is 1.

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

Use `nahhasio schema` to inspect the connected database. For a source-only audit, use the checked-in schema and migrations.

## Writing

```bash
./bin/nahhasio title update Arcane --set quality_score=8 --set workflow_status=published --write
./bin/nahhasio person create --set name='Naoko Yamada' --set sort_name='Yamada, Naoko' --write
./bin/nahhasio title update --where "workflow_status=draft" --set workflow_status=published --yes --write
./bin/nahhasio alias delete --where "title_id=…" --yes --write
```

Rules the CLI enforces:

- `update`/`delete` need **either** a reference **or** `--where`. An unqualified write is refused.
- Deleting more than one row requires `--yes`.
- `--dry-run` on any write reports what would change without committing.
- `--set` values are validated against the real column type; bad enum values list the legal ones.
- Foreign-key `--set` values accept references (discover the actual column with `schema`).
- `--json-set col='{"a":1}'` writes raw JSON to a `jsonb` column.
- Every write records an `audit_logs` row. Set `NAHHASIO_CLI_ACTOR=<account slug>` to attribute it.

## Creating or editing a whole work

This is the right tool for adding a new title. One JSON document describes the finished state;
the CLI reconciles the database to it in a single transaction.

```bash
./bin/nahhasio work template --json > new-work.json   # filled-in starting point
./bin/nahhasio work apply new-work.json --dry-run --create-missing   # rehearse
./bin/nahhasio work apply new-work.json --create-missing --write # commit
./bin/nahhasio work export Arcane --json > arcane.json               # round-trips with apply
```

The document covers the title, its classification, aliases, trivia, genres/tones/tags/countries,
planets, credits, external ids, relations, media, installments, episodes, scores, and awards.
Fields you omit are left alone.

- `--mode merge` (default): only touches what the document mentions.
- `--mode replace`: reconcile supplied lists; omitted fields remain unchanged. Episode removal
  checks all foreign keys, including composite ownership links. Installment deletion remains
  blocked pending a separate dependency review.
- `--create-missing`: create referenced genres/tones/tags/entities/award organizations that do
  not exist yet, inside the same transaction. Existing roles must still resolve uniquely.
  Without it, an unknown vocabulary term is an error — which is usually what you
  want, so you do not silently invent a duplicate genre.

Re-applying the same document is idempotent. Installments match on `id`, else on `position`;
episodes the same within their installment.

Editing one field of an existing work:

```bash
./bin/nahhasio work export "Frieren" --json > f.json
# edit f.json
./bin/nahhasio work apply f.json --write
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
./bin/nahhasio sql --write --dry-run "update titles set quality_score = 5 where id = '…' returning id"
./bin/nahhasio sql --write "delete from title_aliases where title = 'typo' returning id"
./bin/nahhasio sql --file report.sql --json
```

Read-only by default — enforced by a real `READ ONLY` transaction, so a write attempt fails at
the database. `--write` allows mutations and wraps them in a transaction; `--write --dry-run`
executes and then rolls back, which is the safest way to preview a bulk change.

## Images

```bash
./bin/nahhasio media ingest ./poster.jpg --role poster --title Arcane --write
./bin/nahhasio media ingest https://image.tmdb.org/t/p/original/example.jpg --role banner --title Arcane --write
./bin/nahhasio media assign <asset-id-or-path> --role logo --entity "Studio Ghibli" --write
./bin/nahhasio media purge --dry-run          # unreferenced assets
./bin/nahhasio media purge --yes --write
```

Roles are `poster`, `banner`, `logo`, `profile`, `still`. Owners are `--title`, `--installment`,
`--episode`, `--entity` (exactly one). Files are content-addressed by sha256 and deduplicated,
so re-ingesting the same image reuses the existing asset. Assigning a role replaces the
previous primary assignment for that owner.

A work document's `media` field only accepts paths that are **already registered** — ingest
first, then reference the returned path.
