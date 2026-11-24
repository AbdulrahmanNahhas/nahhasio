---
name: nahhasio-desktop-ui
description: Implement or review Nahhasio's shared React viewer and admin UI in apps/linux/ui. Use for Arabic RTL screens, desktop and narrow interactions, TanStack navigation and queries, and the typed native bridge.
---

# Develop the shared client UI

1. Inspect the feature and its nearest reviewed equivalent. Read the applicable
   [design rules](../../../docs/desktop/design-rules.md) and
   [client behavior](../../../docs/desktop/behavior.md). Use [frontend-design](../frontend-design/SKILL.md)
   for a new design or an approved redesign.
2. Reuse the shared cards, shelf, form fields, status states and page layout where they already
   fit. Follow [shadcn](../shadcn/SKILL.md) for registry primitives. Consult [UI SDK](../ui-sdk/SKILL.md)
   for a new interaction or an existing SDK-backed menu or drawer. Keep CSS in semantic tokens
   and static logical utilities. Preserve focus, links, keyboard navigation and reduced motion.
3. Keep route modules small. Use URL state for shareable views and Query for remote state.
   Follow [routing and query ownership](../../../docs/desktop/architecture.md#routing-and-query-ownership)
   for keys, cancellation, pagination and invalidation. Keep edited drafts and device state with
   their existing owners.
4. Use the [typed gateway](../../../apps/linux/ui/src/lib/bridge.ts) for server and native calls.
   Preserve CSP, scoped assets, and the packaged `nahhasio://app/` boundary. Rust owns sessions,
   playback and storage. The localhost browser adapter has a separate capability set.
5. Verify through the relevant [project checks](../../../docs/development/testing.md).
   For visible changes inspect wide and narrow fixtures, missing artwork, long Arabic text,
   focus return and RTL keyboard order. Report browser, native and installed checks distinctly.
