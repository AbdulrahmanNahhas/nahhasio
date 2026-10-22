# Browse and filter redesign checkpoint

Aqua approved the reviewed Browse design and authorized this commit on 2026-10-22.

## Current behavior

- A compact RTL toolbar provides Animated/Live Action and viewing-state selections, sorting,
  a dedicated Search-page button, filters, display preferences and built-in Browse templates.
  Toolbar selections and drawer selections share the same server filters.
- The filter drawer uses horizontal sections and compact include → exclude → clear chips.
  Search matches Arabic/English names, slugs and aliases through an explicit public-field
  allowlist. Fixed choices remain available at zero matches. Large groups reveal more options
  incrementally; selection order stays stable.
- Release and library filters share a section. Privacy and a year range slider sit together.
  Audience/age and colored content-risk groups use their reviewed compact arrangement.
  The content-warning-presence filter is hidden from the picker.
- Overall rating uses a two-handle range slider. Six independent criterion sliders retain
  minimum thresholds, individual resets and a shared reset. All thresholds use 0.1 precision.
- Work status uses completed, ongoing, upcoming and unknown; installment status retains airing.
  Administrator privacy filtering follows the privacy flag independently of editorial state.
  Family accounts still require published public works.
- Display has layout tiles, contextual setting rows, immediate switches, a table-column picker,
  Arabic/English/both title choices, thumbnails and row density. Added preferences are optional
  in both TypeScript and native Rust so previous documents remain readable. Defaults retain
  the prior presentation. Preferences remain device-local and scoped by server/account.
- Browse templates are fixed product definitions in `browse-templates.ts`, not user-editable
  saved views. Applying a template replaces search/filter/sort/group/display choices while
  retaining privacy and the current route's locked facet. Earlier saved-view documents are
  preserved but no longer exposed as editable shortcuts.
- Draft Apply, Cancel/Escape, focus restoration, a debounced result count and server pagination
  remain in place. Schema and live catalog records are unchanged.

## Verification and limits

The earlier compact-drawer checkpoint passed three production-browser fixture scenarios and
43 UI unit tests. An authenticated multilingual-facet assertion passed on disposable PostgreSQL.
Those results preceded the later user-reviewed slider, toolbar, display and template iterations.

The later iterations received focused TypeScript checks and successful server/native builds.
Tests and screenshots were deliberately not rerun during those fast passes at Aqua's request.
The Browse fixture source is maintained for the final controls; final runtime acceptance remains
separate. Native GTK/WebKit rendering, physical input, compositor and playback are unverified
by browser/static checks. Restart the server for the new facets/status/range behavior and fully
relaunch an updated native client for the added preference fields.
