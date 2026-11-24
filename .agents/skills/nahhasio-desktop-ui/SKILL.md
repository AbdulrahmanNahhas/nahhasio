---
name: nahhasio-desktop-ui
description: Build, migrate, or review Nahhasio's Arabic RTL Linux UI with UI SDK, shadcn Base UI Maia, Tailwind 4, Vite, and TanStack Router/Query. Covers reusable media components, adaptive interactions, and typed native UI boundaries.
---

# Nahhasio desktop UI

Read [Design and composition](../../../docs/desktop/design-rules.md) and the affected section of
[Client behavior](../../../docs/desktop/behavior.md). Use [frontend-design](../frontend-design/SKILL.md)
for new layouts and approved redesigns. Preserve reviewed visuals during implementation migrations.

## UI SDK for new interaction behavior

Read the [official ui-sdk skill](../ui-sdk/SKILL.md) and the installed React index at
`apps/linux/ui/node_modules/@ui-sdk/react/docs/llms.txt`. Open the relevant component page first.
Use package subpath imports and reuse the app's shared
[menu](../../../apps/linux/ui/src/components/ui-sdk/menu.tsx) and
[mobile drawer](../../../apps/linux/ui/src/components/ui-sdk/mobile-drawer.tsx). For a behavior
without an existing component, read the matching headings in the installed `core.md` and
`rendering.md` before composing it. Keep SDK styles scoped to their components.

Use controlled state when the route owns a selection or an overlay. Verify trigger text, natural
Tab order, RTL arrows, dismissal, and focus restoration. A short drawer should have one
scrolling body below a fixed header or grab handle. Use the existing typed native bridge.
An SDK request does not authorize agent tools, WebMCP, or model providers.

## shadcn and Tailwind composition

Reuse the installed Base UI Maia/Mist components. Read [shadcn](../shadcn/SKILL.md) for the
lockfile-installed CLI and relevant registry docs. Compose existing Buttons, Cards, Badges, Fields,
and desktop dialogs. Prefer variants and sizes, semantic tokens, logical RTL utilities, scoped
imports, and Lucide icons. Keep caller layout in feature code and fix caller errors there. The
full official component set is approved, with imports scoped to actual consumers.

Keep global CSS for tokens and genuinely shared rules. The current [design rules](../../../docs/desktop/design-rules.md)
and [upstream refresh procedure](../../../docs/development/agent-playbook.md#maintain-the-skills)
govern local adaptations. Keep labels, native links, visible focus, disabled/pending behavior,
and reduced motion. Preserve native player slider draft/cancel behavior.

## Reuse the viewer's layout

- Home and catalog surfaces share the media, entity, and planet cards and the horizontal shelf
  with RTL focus and overflow behavior. Choose artwork by role and preserve its fallback.
- Work has separate single-film, collection, and series layouts. Keep playback, watched state,
  and progress consistent across them. Reuse the episode thumbnail and keep a single owner for
  episode playback, details, and download actions.
- Under 768 px, use a bottom drawer for detail and choice flows. On the Work page, place episode
  controls after the release card, label icon-only actions, and keep peripheral desktop navigation
  out of the mobile flow.
- Use the shared press feedback for buttons and card actions. Keep the watched control green
  through hover and active states. Review spacing and section order with actual artwork, Arabic
  text, and catalog states before introducing a new visual pattern.

## Native routing and data

Rust owns sessions, HTTP, playback and storage. Use `src/lib/bridge.ts` and generated OpenAPI
schemas. Preserve CSPProvider, DirectionProvider, contained assets, and the authenticated bridge.
The packaged origin is `nahhasio://app/`. The development preview is `http://127.0.0.1:23110/`.

Keep route entries thin and existing hash links valid. Validate route/search inputs. TanStack Query
owns server state, cancellation, and invalidation. Keep transient interaction state local, and
keep player state outside loaders. Use server pagination and targeted cache updates.

## Verification and review

Use the project environment and the focused checks in [Verification](../../../docs/development/testing.md).
For a visible checkpoint, inspect wide and narrow fixtures with real content cases, check short
drawers, RTL arrows, focus restoration, and the absence of page overflow. Record the tested
viewport and artifact. A browser fixture does not verify native GTK/WebKit, physical input, or
playback. Keep captures private and perform native acceptance separately.
