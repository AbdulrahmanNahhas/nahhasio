---
name: nahhasio-maintenance
description: Organize Nahhasio documentation, update agent skills, reconcile dated status claims, and maintain contributor or release handoffs without changing application behavior or live data.
---

# Maintain Nahhasio docs and instructions

1. Start at [the docs index](../../../docs/README.md) and [agent playbook](../../../docs/development/agent-playbook.md). Follow [repository rules](../../../AGENTS.md).
2. Inspect the worktree, the owning guide, and relevant source or recorded evidence. Label backlog,
   source implementation, build/fixture results, and dated installed observations separately.
   If evidence conflicts or is missing, cross-link it and say what is unknown; do not infer acceptance.
3. Update the owner rather than duplicating procedures or status. Preserve historical receipts,
   stable task IDs and inbound links; redact private data rather than copying it into examples.
4. For skill work, preserve user-specific rules and upstream provenance. Keep frontmatter triggers
   distinct, and link to the current owner for commands and capabilities. Don't enable agent tools,
   add dependencies, or use a live host just to validate documentation.
5. From the repo root, run `python3 tools/docs/check_docs.py`, format-check changed Markdown with
   `pnpm exec oxfmt --check`, and run `git --no-pager diff --check`. Summarize scope and any gaps.
