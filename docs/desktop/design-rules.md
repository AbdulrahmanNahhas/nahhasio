# Desktop design and composition

[Documentation index](../README.md) · [Client behavior](behavior.md) · [Agent playbook](../development/agent-playbook.md)

The current product UI is `apps/linux/ui`: Arabic/RTL React/Vite with TanStack Router/Query,
Tailwind 4 and official shadcn Base UI. `components.json` uses `base-maia`/Mist; checked-in tokens
and Aqua's reviewed source/screens are authoritative. Old purple/Nova/website palette plans are
superseded. Preserve current design during technical changes.

## Design the journey before styling

Identify the primary task and order sections by what the viewer needs next. Review the whole
page at wide and phone widths. Preserve established patterns and solve concrete problems such as
duplicate actions, long blank gaps, or information available only after a long scroll.
Use Arabic RTL reading order, Western digits, and bidirectional isolation for dates and mixed
script. Check long Arabic and Latin titles, missing artwork, and missing optional metadata.

### Home and discovery

Keep the featured artwork and main action dominant. Use the shared shelf for keyboard navigation,
edge fades, and horizontal scrolling. Use portrait posters for titles, landscape episode stills,
square studio marks, and people portraits. Keep linked section headings useful as entrances to a
directory or filtered Browse view. Show shelves when they have content and retain visible focus
without clipping cards and actions at the edges.

### Work and episodes

Keep the hero action row, watch status, and details in predictable places. A work in progress
shows its next target and progress. A completed work collapses to the small watched control beside
Details and Score. Ratings, age, and release details should appear where they inform a decision.
Group metadata, avoid repeating it across adjacent cards, and use artwork with translucent
surfaces. Reserve blur for controls over sharp hero artwork.

Use the single-film overview for story and useful facts. Collections and series need a release
selector and installment context. Keep playback first, surface watched state in the episode
thumbnail, and keep secondary actions in episode details. On phones, put the release controls
between the release card and episode list. Keep the expanded episode view focused on filtering
and playback. The [Work page behavior](behavior.md#work-page-details) records the exact current
section and action order.

## Current work-editor language

Use contained readable widths, the compact work header, draft-driven title/badges/score, sticky
icon tabs, responsive primary/secondary cards and the sticky review/discard/JSON action bar.
Privacy is an explained editorial switch. Dense catalog tables/poster browsing remain appropriate.
Use clear loading/error/empty states and retain drafts on failures. Apply this composition to
new approved admin pages without forcing every view into an identical card grid.

## Composition and boundaries

Browse, Episodes, Music and Trailers, Studios, People, and Planets share the catalog page layout.
Use the same page gutters, title and count, search placement, and spacing before filters and
results. Search sits opposite the heading in wide RTL layouts and directly below it in narrow
windows. Keep filters and secondary actions on the next row. Let longer lists of filter choices
wrap or use dropdowns. Keep page-specific result layouts independent of the shared header.

Use existing official primitives and variants; Field/FieldGroup for forms, complete Card
composition, Alert/Empty/Badge for status, titled dialogs and labelled/icon-named controls.
Use semantic tokens, logical RTL layout, gaps, static utilities and cn. Native link semantics,
keyboard focus, reduced motion and narrow-window behavior remain required.

Shared buttons and button-styled links use brief 97% scaling while pressed. Reduced-motion
settings replace scaling with a color change. Disabled and pending controls remain still.
Consult UI SDK first for new interactive behavior. Shared wrappers live in
`apps/linux/ui/src/components/ui-sdk/`. Use them for menus, mobile drawers, switches, progress
bars, selects, checkboxes, collapsible panels and separators. Keep shared styling and SDK-specific
API adaptations in the owning wrapper. Keep feature state, labels and actions at the call site.
Review the installed SDK docs and exercise representative viewer and admin callers when changing
a wrapper or updating the SDK. Verify popup nesting, focus return and RTL in Chromium and packaged
WebKit when replacing a popup primitive.

Preserve shadcn's reviewed layout primitives and desktop dialog composition. Use a bottom drawer
below 768 px for longer detail and selection flows. Allow one scroll region within the drawer,
including short phone screens. Keep the SDK's optional global stylesheet out of the desktop bundle.

Tailwind owns feature presentation. Keep fonts, tokens and essential global rules in the
stylesheet. Use static utilities and configured tokens for new code. Runtime geometry follows
the existing typed boundary. Fix caller errors at the caller and keep approved official
components scoped to their consumers. Run the shadcn lint rules with `pnpm lint`.

Do not put HTTP/session secrets, arbitrary native operations or direct server fetch in UI code.
Desktop uses Vite/Router/Query, not TanStack Start. The former TanStack Start web dashboard is retired.

Use the desktop, UI SDK, and shadcn skills as appropriate. A visual checkpoint includes desktop
and mobile with realistic data, no page-level horizontal overflow, natural Tab order, physical
RTL arrows, Escape, and focus return. Report the actual viewport and distinguish browser fixtures
from native GTK and physical input verification. Follow [Testing](../development/testing.md) for
the relevant acceptance scope.
