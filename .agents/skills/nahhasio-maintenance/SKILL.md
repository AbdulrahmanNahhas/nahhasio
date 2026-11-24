---
name: nahhasio-maintenance
description: Maintain Nahhasio documentation, AGENTS.md, repository skills, and release or operations handoffs. Use when changing guidance or reconciling it with source and recorded evidence.
---

# Maintain repository guidance

1. Use the [docs index](../../../docs/README.md) and [agent playbook](../../../docs/development/agent-playbook.md)
   to find the owning guide. Inspect the worktree and the specific source, command, or dated
   verification record that supports the change.
2. Put durable policy in [AGENTS.md](../../../AGENTS.md), task workflows in skills, and
   implementation, operating and release facts in their owning guides. Keep stable roadmap IDs,
   useful historical receipts, and inbound links when reorganizing.
3. Give each skill a distinct trigger. Link to detailed references only where a task needs them.
   For vendor updates, follow the [refresh procedure](../../../docs/development/agent-playbook.md#refresh-a-vendor-skill)
   and preserve provenance, licenses and meaningful local adaptations.
4. Distinguish source behavior, tested fixtures, installed acceptance, and proposals. Review any
   affected public website guides for product drift using demo-safe examples.
5. Run the [documentation checks](../../../docs/README.md#maintaining-these-docs) and check skill
   frontmatter and references. Report the checks and any evidence gaps.
