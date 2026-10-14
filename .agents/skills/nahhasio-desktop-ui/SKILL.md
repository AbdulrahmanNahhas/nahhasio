---
name: nahhasio-desktop-ui
description: Build, migrate or review Nahhasio's packaged Linux React UI using Vite, TanStack Router/Query, Tailwind 4 and official shadcn Base UI Maia. Applies to apps/linux/ui and native UI boundaries; excludes catalog classification and database operations.
---

# Nahhasio desktop UI

Read docs/PROJECT.md, docs/ROADMAP.md and docs/DEVELOPMENT.md for scope. Preserve the reviewed
desktop Maia/Mist theme, Arabic RTL interface, catalog density and keyboard behavior. A refactor
does not authorize an aesthetic redesign, administration migration or a Rust exercise solution.

## Native routing/data boundary

Rust owns sessions, HTTP, playback and storage. Use src/lib/bridge.ts and generated OpenAPI
schemas; no secrets, arbitrary URLs/native commands or browser fetch in client code.
Production uses nahhasio://app/; development is exactly http://127.0.0.1:23110/.
Preserve CSPProvider, DirectionProvider, contained assets and the authenticated native bridge.

Use Vite + TanStack Router + Query. Retain existing hash links with hash history, type/register
routes, validate untrusted params/search and keep route entries thin with feature-owned UI.
Query owns server state/cancellation/logout invalidation. Player status stays outside loaders.

## Tailwind and official components

Use the installed official @shadcn Base UI Maia, RTL and Lucide. Inspect CLI context/current docs and generated
updates. Fix callers rather than editing vendored primitives. Aqua explicitly requested the full
current official desktop component library; unused installed primitives are permitted here,
but do not import them all into the entry bundle.

Keep only imports, fonts, semantic theme tokens and essential global rules in styles/tailwind.css.
Component layout/state/responsive styling uses literal Tailwind utilities, not selectors, CSS
modules or @apply. Prefer semantic colors, standard spacing, logical RTL utilities and cn.
Arbitrary utilities may preserve measured client geometry. Raw static color/style literals in
feature JSX should become tokens/utilities; runtime geometry/chart values may use typed CSS
variables or SVG attributes. Registry internals are exempt from caller styling rules.

Use Field/FieldGroup, Button variants, Alert/Empty, Badge, Progress and named overlays. Keep
labels, native link semantics, disabled/pending behavior and reduced motion. Retain native
player slider draft/cancel semantics; compose official controls without rewriting transport logic.

## Verification and review

Inventory stylesheet/import/selector/raw-control usage before claiming conversion complete.
Use devenv and focused compile/static checks at checkpoints. Run meaningful fixture/native
journeys at acceptance or when unresolved risks require them, following Aqua's lean test policy. Follow docs/TESTING.md
for isolated packaged GTK checks. No live catalog mutation, public torrent download or relaxed
CSP/auth/origin guard. Inspect desktop/narrow releases, entities, Watch, login and player captures.
Browser checks do not prove GTK input/rendering/smoothness; describe the tested artifact and
current unresolved limits rather than copying historical pass/fail assertions. Keep captures private/ignored. Return at the approved checkpoint;
commits require explicit checkpoint authorization.
