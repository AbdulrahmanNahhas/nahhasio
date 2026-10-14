# Desktop design and composition

The current product UI is `apps/linux/ui`: Arabic/RTL React/Vite with TanStack Router/Query,
Tailwind 4 and official shadcn Base UI. `components.json` uses `base-maia`/Mist; checked-in tokens
and Aqua's reviewed source/screens are authoritative. Old purple/Nova/website palette plans are
superseded. Preserve current design during technical changes.

## Current work-editor language

Use contained readable widths, the rounded work header, draft-driven title/badges/score, sticky
icon tabs, responsive primary/secondary cards and the sticky review/discard/JSON action bar.
Privacy is an explained editorial switch. Dense catalog tables/poster browsing remain appropriate.
Use clear loading/error/empty states and retain drafts on failures. Apply this composition to
new approved admin pages without forcing every view into an identical card grid.

## Composition and boundaries

Use existing official primitives and variants; Field/FieldGroup for forms, complete Card
composition, Alert/Empty/Badge for status, titled dialogs and labelled/icon-named controls.
Use semantic tokens, logical RTL layout, gaps, static utilities and cn. Native link semantics,
keyboard focus, reduced motion and narrow-window behavior remain required.

Tailwind owns feature presentation; keep fonts/tokens/essential global rules in the stylesheet.
Runtime geometry follows the existing typed/token boundary. Do not hand-edit vendored primitives
to fix caller errors. The full official desktop component set was approved; imports stay scoped.

Do not put HTTP/session secrets, arbitrary native operations or direct server fetch in UI code.
Desktop uses Vite/Router/Query, not TanStack Start. The transitional website remains its own
Start app and app-specific registry configuration until retirement; it is not the desktop theme.

Use the shadcn and desktop skills for implementation. Follow lint/configured composition rules;
Aqua's explicitly approved design decisions take precedence over a generic redesign suggestion.
Verification policy is in [TESTING.md](TESTING.md); full suites are not required per tiny edit.
