---
name: nahhasio-db
description: Inspect or change Nahhasio catalog records using the PostgreSQL operator or authorized family-server workflow. Use for catalog queries, reports, whole-work imports, artwork assignments, and record verification.
---

# Operate on the Nahhasio catalog

1. Select the target before connecting. Shadow's development database and the family catalog have
   separate ownership. For an authorized family operation, read the [installed host handoff](../../../docs/operations/family-server.md)
   and use its HTTPS workflow where supported. For source-only audits, inspect the checked-in schema,
   migrations, and runtime consumers.
2. For direct PostgreSQL, use `./bin/nahhasio` with an explicit `DATABASE_URL`. Build with
   `devenv shell -- cargo build --locked -p nahhasio-cli` if needed. `NAHHASIO_CLI_BIN` selects
   another built binary. `help --json`, `schema --resources`, `work schema`, and `work template`
   can run without connecting. Inspect the actual target schema for column and constraint questions.
3. Read only the needed rows and fields. Lists cap pages at 500 rows. Resolve ambiguous names to
   stable IDs. Keep secrets, session material, and private exports out of tool output and Git.
4. For authorized changes, export the current record, preview with `--dry-run`, apply with
   `--write`, and re-export to verify the intended changes and preserved identities. Generic
   multi-row commits also require `--yes`. SQL mutations require `RETURNING`. Use
   [cataloging](../nahhasio-cataloging/SKILL.md) for stored editorial judgments.
5. After family-catalog changes, follow the [private snapshot refresh](../../../docs/catalog/database.md#personalized-catalog-snapshots).

## Choose the operation

- [Operator examples](references/operator-examples.md) cover typed filters, statistics, SQL,
  whole-work merge and replace, and artwork. Prefer guarded commands for mutations.
- `editor <operation> --file input.json` shares Rust editor services and needs
  `NAHHASIO_CLI_ACTOR`. Review/save uses one private 32-byte hex `NAHHASIO_EDITOR_SECRET` across
  calls. The direct operator uses database credentials, while installed app operations enforce
  account permissions through the API.
- Artwork dry runs can leave orphan file bytes even when PostgreSQL rolls back. Keep registered
  artwork assignments and retained revision references. Purge has separate record and file semantics.
- Migration apply requires explicit maintenance authorization. Use the
  [baseline](../../../docs/catalog/migration-baseline.md) and [recovery procedure](../../../docs/operations/runbook.md).
  Validate behavior with disposable fixtures and never point mutation tests at the family catalog.
