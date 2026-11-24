# Nahhasio documentation

Start with the task you need to do. The guides below own different kinds of information; a dated
checkpoint is evidence for that run, not proof of today's source, installed version, or acceptance.

## Product and architecture

| Need                                            | Source of truth                                |
| ----------------------------------------------- | ---------------------------------------------- |
| Confirm product scope and lasting decisions     | [Project guide](project/overview.md)           |
| Plan future technical work                      | [Roadmap and task IDs](project/roadmap.md)     |
| Review page-level feature requests              | [Feature backlog](project/features.md)         |
| Change client dependencies or extract a service | [Client architecture](desktop/architecture.md) |

## Build, develop, and verify

| Need                                                  | Start here                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Run locally, generate contracts, or find a package    | [Development](development/getting-started.md)                                        |
| Change desktop UI or design tokens                    | [Client behavior](desktop/behavior.md) · [Design rules](desktop/design-rules.md)     |
| Collect interface inspiration and design ideas        | [Design references](desktop/design-references.md)                                    |
| Work on source discovery or the player                | [Streaming](desktop/streaming.md) · [Anime direct playback](desktop/anime-direct.md) |
| Choose fixture, native, packaged, or installed checks | [Verification](development/testing.md)                                               |
| Use or maintain the agent instructions                | [Agent playbook](development/agent-playbook.md) · [Repository rules](../AGENTS.md)   |

The [public-facing product and documentation website](../apps/website/README.md) is a separate static build.

## Catalog and storage

| Need                                                   | Start here                                               |
| ------------------------------------------------------ | -------------------------------------------------------- |
| Inspect schema, catalog records, or storage ownership  | [Database guide](catalog/database.md)                    |
| Identify the service that owns a table or operation    | [Schema service ownership](catalog/service-ownership.md) |
| Understand migration history before restore or cutover | [Database baseline](catalog/migration-baseline.md)       |

## Deployment and operations

| Need                                              | Start here                                                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Install or publish a release                      | [Deployment sequence](operations/deployment.md)                                                                                        |
| Configure, back up, upgrade, or recover           | [Operations](operations/runbook.md)                                                                                                    |
| Check what was actually verified on the family PC | [Installed host handoff](operations/family-server.md); recheck before an authorized live operation                                     |
| Find exact packaging commands                     | [Server](../packaging/server/README.md) · [Maintenance](../packaging/operations/README.md) · [Flatpak](../packaging/flatpak/README.md) |
| Look up version changes and upgrade prerequisites | [Release notes](releases/README.md)                                                                                                    |

## Maintaining these docs

- Update the owning guide, then link to it from other pages rather than copying commands or release status.
- Put new pages in the owning topic folder. When moving a page, update references in skills, package
  READMEs, and release tooling; preserve heading anchors when practical. For historical instructions, preserve the
  original scope and add a dated note or pointer to the current procedure instead of retroactively
  changing the record. Keep stable roadmap IDs and distinguish backlog from verified behavior.
- Identify the artifact, environment, and date for verification; distinguish source, fixture, packaged,
  and installed results. Do not infer production status from source or run live checks just to edit docs.
- Keep credentials, personal catalog exports, captures, and backups out of Git.
- Run `devenv shell -- python3 tools/docs/check_docs.py`, the format check on edited docs,
  and `git diff --check` from the root. The project link check covers local Markdown paths and
  skill names in its selected files. When moving sections or adding skill references, also check
  the affected anchors and moved files. Validate skill frontmatter against the
  [Agent Skills specification](https://agentskills.io/specification).
