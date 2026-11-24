# Agent maintenance playbook

[Documentation index](../README.md) · [Repository rules](../../AGENTS.md)

## Pick the smallest useful set of skills

| Task                                              | Start with                                                                 | Add only when needed                                                                                                                                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs, handoffs, or agent instruction changes      | [nahhasio-maintenance](../../.agents/skills/nahhasio-maintenance/SKILL.md) | The specialist owning the topic                                                                                                                                                                                                                          |
| Desktop implementation or review                  | [nahhasio-desktop-ui](../../.agents/skills/nahhasio-desktop-ui/SKILL.md)   | [shadcn](../../.agents/skills/shadcn/SKILL.md) for official registry components                                                                                                                                                                          |
| Compose or extend UI SDK components               | [ui-sdk](../../.agents/skills/ui-sdk/SKILL.md)                             | [Desktop UI](../../.agents/skills/nahhasio-desktop-ui/SKILL.md) for Nahhasio's design and native bridge rules                                                                                                                                            |
| Desktop navigation or remote state                | [Desktop UI](../../.agents/skills/nahhasio-desktop-ui/SKILL.md)            | [Router](../../.agents/skills/tanstack-router-best-practices/SKILL.md), [Query](../../.agents/skills/tanstack-query-best-practices/SKILL.md), or [integration](../../.agents/skills/tanstack-integration-best-practices/SKILL.md) when both are involved |
| New visual design or explicitly approved redesign | [frontend-design](../../.agents/skills/frontend-design/SKILL.md)           | Desktop constraints above; a refactor alone does not authorize a redesign                                                                                                                                                                                |
| Inspect or edit catalog data                      | [nahhasio-db](../../.agents/skills/nahhasio-db/SKILL.md)                   | [nahhasio-cataloging](../../.agents/skills/nahhasio-cataloging/SKILL.md) for Arabic editorial fields and scores                                                                                                                                          |
| Write a standalone review or comparison           | Optional personal `media-review` skill                                     | Cataloging only if the user also asks to change stored data; the review rubric is separate                                                                                                                                                               |

## How to work

1. Read the matching guide and inspect the actual files, tool versions, and worktree before editing.
2. For native or API changes, find the current owner and generated contract before introducing
   another path. For ops work, read [Operations](../operations/runbook.md) and the dated
   [host handoff](../operations/family-server.md); neither authorizes commands against a live machine.
3. Check only what is relevant at each checkpoint. Docs need the local docs and format checks;
   code needs focused checks from [Verification](testing.md). Report what ran and what did not.

## Maintain the skills

- Put repository-wide policy in `AGENTS.md`, task workflows in the skills, and product/operational
  facts in the owning guides. Reference those sources instead of copying them into several skills.
- Each skill directory must match its `name`. Use a specific trigger and put lengthy examples in
  nearby references, unless the skill is deliberately portable as a single file.
- Keep personal skills outside the repository. When you maintain one in a separate directory,
  link that directory under `~/.agents/skills/` instead of copying it here. The optional
  `media-review` skill is not required to develop, build, or use Nahhasio.
- Review the [official UI SDK skill](https://ui-sdk.dev/docs/agents/skills) and
  [official shadcn skill](https://ui.shadcn.com/docs/skills) during design-system reviews and their
  corresponding dependency upgrades. Check for changes to the guidance, component API, and
  accessibility conventions.
- Preview upstream refreshes with the Skills CLI in a temporary project. The official sources are
  `vercel-labs/ui --skill ui-sdk` and `shadcn/ui --skill shadcn`. Compare the full skill directory,
  apply relevant updates and preserve the Nahhasio-specific notes. Take provenance entries from
  the installer's `skills-lock.json`. Review dependency upgrades separately so the skill's
  examples and the installed API are not confused.
- [Anthropic's frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
  is the upstream reference for the local adaptation. Keep Nahhasio's reviewed design decisions
  and local workflow when incorporating upstream changes.
- Prefer version-matched installed API docs and relevant source to stale upstream examples. Do not
  widen permissions, register live credentials, or add servers just to make a skill discoverable.
