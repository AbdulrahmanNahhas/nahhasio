# Nahhasio documentation

Start with the task you need to do. The guides below own different kinds of information; a dated
checkpoint is evidence for that run, not proof of today's source, installed version, or acceptance.

## Product and architecture

| Need                                            | Source of truth                        |
| ----------------------------------------------- | -------------------------------------- |
| Confirm product scope and lasting decisions     | [Project guide](PROJECT.md)            |
| Plan future technical work                      | [Roadmap and task IDs](ROADMAP.md)     |
| Review page-level feature requests              | [Feature backlog](FEATURES.md)         |
| Change client dependencies or extract a service | [Client architecture](ARCHITECTURE.md) |

## Build, develop, and verify

| Need                                                  | Start here                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| Run locally, generate contracts, or find a package    | [Development](DEVELOPMENT.md)                                           |
| Change desktop UI or design tokens                    | [Client behavior](CLIENT.md) · [Design rules](design-rules.md)          |
| Work on source discovery or the player                | [Streaming](STREAMING.md) · [Anime direct playback](ANIME-DIRECT.md)    |
| Choose fixture, native, packaged, or installed checks | [Verification](TESTING.md)                                              |
| Use or maintain the agent instructions                | [Agent playbook](AGENTS-PLAYBOOK.md) · [Repository rules](../AGENTS.md) |

## Catalog and storage

| Need                                                   | Start here                                       |
| ------------------------------------------------------ | ------------------------------------------------ |
| Inspect schema, catalog records, or storage ownership  | [Database guide](DATABASE.md)                    |
| Identify the service that owns a table or operation    | [Schema service ownership](SCHEMA-FOUNDATION.md) |
| Understand migration history before restore or cutover | [Database baseline](BASELINE.md)                 |

## Deployment and operations

| Need                                              | Start here                                                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Install or publish a release                      | [Deployment sequence](DEPLOYMENT.md)                                                                                                   |
| Configure, back up, upgrade, or recover           | [Operations](OPERATIONS.md)                                                                                                            |
| Check what was actually verified on the family PC | [Installed host handoff](FAMILY-SERVER.md); recheck before an authorized live operation                                                |
| Find exact packaging commands                     | [Server](../packaging/server/README.md) · [Maintenance](../packaging/operations/README.md) · [Flatpak](../packaging/flatpak/README.md) |
| Look up old release changes or one-time upgrades  | [0.1.1](RELEASE-0.1.1.md) · [0.1.2](RELEASE-0.1.2.md) · [0.1.3](RELEASE-0.1.3.md)                                                      |

## Maintaining these docs

- Update the owning guide, then link to it from other pages rather than copying commands or release status.
- Keep existing filenames and heading anchors when practical. For historical instructions, preserve the
  original scope and add a dated note or pointer to the current procedure instead of retroactively
  changing the record. Keep stable roadmap IDs and distinguish backlog from verified behavior.
- Identify the artifact, environment, and date for verification; distinguish source, fixture, packaged,
  and installed results. Do not infer production status from source or run live checks just to edit docs.
- Keep credentials, personal catalog exports, captures, and backups out of Git.
- Run `python3 tools/docs/check_docs.py` and `pnpm exec oxfmt --check <edited paths>` from the root.
  The docs check is offline and validates local Markdown paths and skill names, not remote URLs or anchors.
