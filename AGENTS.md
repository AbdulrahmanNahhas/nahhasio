# Nahhasio agent instructions

Start with the [documentation index](docs/README.md). Use the [agent playbook](docs/development/agent-playbook.md)
to select the relevant workflow and guides.

## Work in this checkout

- Inspect Git status and the owning source before changing it. Preserve unrelated edits and reviewed
  UI. Work in the main chat without subagents. Commit, push, publish, install, or change live
  systems or data only within the user's explicit authorization.
- Use the declared [development environment](docs/development/getting-started.md) on Shadow.
  Run project commands inside devenv or through `devenv shell --`. Keep retained work in this
  checkout, disposable work in `/tmp`, and credentials out of Git and logs. Ask before accessing
  `/saved/nixos-config`.
- Keep code, identifiers, comments and commit messages in English. Reply in the user's language.
  Use Modern Standard Arabic for Arabic replies and the established Arabic RTL language in the app.
- Keep fixes scoped. Establish the failure with source or a focused check and verify through the
  normal entry point. Follow the [verification guide](docs/development/testing.md). Distinguish
  source, browser fixtures, GTK, packaged builds, and installed behavior.
- Update any guidance made stale by your change in its owning guide. For Markdown and skills,
  follow [maintenance](.agents/skills/nahhasio-maintenance/SKILL.md). Keep plans, historical evidence,
  and operational procedures in their owning docs.

## Product boundaries

- `apps/linux/ui` is the shared viewer and admin frontend running in GTK/WebKit and the local
  browser preview. `apps/website` is the separate static product site. See the
  [development map](docs/development/getting-started.md#repository-map) and
  [desktop design rules](docs/desktop/design-rules.md).
- Keep the reviewed interface, typed native bridge, generated OpenAPI boundary, bounded queries,
  and server-enforced permissions. Keep runtime secrets and native operations behind the bridge.
  The browser preview owns its development adapter. Keep the product site independent of the API.
  Do not hand-edit `routeTree.gen.ts` or `packages/api-contract/src/generated.ts`.
- Keep GTK, mpv, database and server dependencies out of `crates/client-core`. Follow the
  [client architecture](docs/desktop/architecture.md) before changing build or runtime boundaries.
  Keep Rust learning exercises under [Aqua's ownership](docs/development/getting-started.md#development-after-transfer-and-learning).
- Keep provider credentials server-owned. Preserve the separate Save work, Play, server download
  and device download workflows. Whole-work files-only policy and offline watched/progress sync
  follow the [project guide](docs/project/overview.md).

## Catalog and operations

- PostgreSQL is canonical. Preserve UUIDs, account ownership, tracking, editorial data, artwork
  paths and the single `packages/database/drizzle/` migration history. Startup never applies
  migrations, seeds, imports or cleans data. Rehearse additive changes on disposable restored data.
- Use the [database workflow](.agents/skills/nahhasio-db/SKILL.md) for catalog operations and the
  [cataloging rubric](.agents/skills/nahhasio-cataloging/SKILL.md) for editorial decisions. The local
  Rust operator requires an explicit database target. Keep authorized writes transactional and
  revalidate authorization within mutations. Preserve established identity/password compatibility.
- Read the [installed-host handoff](docs/operations/family-server.md) before authorized family
  operations and the [migration baseline](docs/catalog/migration-baseline.md) before recovery.
  Use the scoped HTTPS workflow where supported. Keep Shadow development separate and follow the
  [runbook](docs/operations/runbook.md) for backups and restores.
- After authorized family-catalog changes, refresh the private lists as described in the
  [catalog guide](docs/catalog/database.md#personalized-catalog-snapshots). Keep personalized
  exports, private captures, backups and provider credentials outside Git.
