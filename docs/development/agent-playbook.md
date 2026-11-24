# Agent playbook

[Documentation index](../README.md) · [Repository instructions](../../AGENTS.md) · [Verification](testing.md)

## Route the task

| Task                                        | Workflow                                                                                         | Evidence and constraints                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Change the React viewer or admin            | [Nahhasio desktop UI](../../.agents/skills/nahhasio-desktop-ui/SKILL.md)                         | [Design rules](../desktop/design-rules.md) and [client architecture](../desktop/architecture.md) |
| Add UI behavior or use a registry primitive | [UI SDK](../../.agents/skills/ui-sdk/SKILL.md) or [shadcn](../../.agents/skills/shadcn/SKILL.md) | Installed API, package configuration, and existing call sites                                    |
| Design a new surface or approved redesign   | [Frontend design](../../.agents/skills/frontend-design/SKILL.md)                                 | Reviewed [design rules](../desktop/design-rules.md) and the requested journey                    |
| Change the static product site              | [Website README](../../apps/website/README.md)                                                   | Public copy, local output, relative URLs and demo-only captures                                  |
| Inspect or change catalog records           | [Nahhasio DB](../../.agents/skills/nahhasio-db/SKILL.md)                                         | Explicit target and authorized [live workflow](../operations/family-server.md)                   |
| Set scores, classifications or warnings     | [Nahhasio cataloging](../../.agents/skills/nahhasio-cataloging/SKILL.md)                         | Actual installment evidence and the field contract                                               |
| Update docs, instructions or skills         | [Nahhasio maintenance](../../.agents/skills/nahhasio-maintenance/SKILL.md)                       | Current source, owning guide and historical evidence                                             |

A standalone review can use the optional personal `media-review` skill. Cataloging applies when the review
will change stored editorial fields. Start an ordinary code change with the relevant package and guide.

## Maintain the instructions

- Keep durable repository rules and authorization boundaries in [AGENTS.md](../../AGENTS.md).
  Route from there to task-specific skills or owning guides. Add a nested `AGENTS.md` when a
  subtree needs distinct instructions that should apply on every change in its scope.
- Each repo skill lives under `.agents/skills/<name>/SKILL.md`. Give it a precise description
  with a recognizable trigger. Keep the entry point short and link to a specific reference when
  an operation needs detailed examples or constraints.
- Keep commands, schema ownership, and installed status in their owning guides. The skill tells
  the agent which guide to consult, which decisions matter, and what to verify.
- Look up APIs in the installed version when available. For TanStack, start from the
  [desktop routing and query guide](../desktop/architecture.md#routing-and-query-ownership)
  and follow its official references. Keep personal workflows in the personal skill directory.
- Check [Agent Skills](https://agentskills.io/specification) for the portable format and
  [AGENTS.md](https://agents.md/) for repository instruction scoping.

## Refresh a vendor skill

1. Check the installed dependency and the vendor source. UI SDK ships a matching skill at
   `apps/linux/ui/node_modules/@ui-sdk/core/skills/ui-sdk/SKILL.md`. Shadcn publishes its skill
   and CLI workflow in the [official shadcn docs](https://ui.shadcn.com/docs/skills).
2. When refreshing a checked-in vendor snapshot, preview the official skill with the Skills CLI
   in a temporary directory. Compare the entry point and its resources. Preserve useful local
   routing and the upstream license. `skills-lock.json` records the installer's upstream
   provenance. The tracked Markdown can include reviewed Nahhasio adaptations.
3. Verify names, links, and task routing. For a significant workflow change, walk through a
   realistic request and check the resulting scope, commands and side effects. Follow the
   [documentation checks](../README.md#maintaining-these-docs) before handing off.

The local frontend-design workflow draws on [Anthropic's frontend-design skill](https://github.com/anthropics/skills/tree/main/skills/frontend-design).
Keep dependency upgrades and skill refreshes reviewable on their own merits.
