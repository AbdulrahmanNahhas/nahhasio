# Nahhasio 0.1.3

This Alpha release updates the Linux client and family server. It does not publish a viewing
website; the browser remains a development preview. Install the matching server before using
remembered-account features on updated clients.

## Changes

- Redesign the calendar with season, monthly calendar, timeline and upcoming views, combining
  movie dates, season starts and registered episodes.
- Polish shared media cards, preserve complete installment titles, and add restrained randomized
  hover/focus motion, press feedback and reduced-motion support.
- Unify settings, administration, responsive navigation and search; add mobile floating navigation,
  nested drawers and desktop Ctrl+K search.
- Improve artwork recovery and caching. Choose bounded thumbnail variants, compress opaque
  derivatives, preserve transparency, and separate warm cache reads from image generation.
- Remember accounts securely on each device and verify known library identity when updating a
  saved server address; preserve ordinary temporary sign-in.
- Apply account/device audio and subtitle defaults before loading new playback sources.
- Add personal OpenSubtitles.com setup, explicit search and download/apply in the native player.
  Each user supplies their own API key and account; secrets remain encrypted on that device.
  Real-provider acceptance requires configured credentials and is not claimed by fixture tests.
- Keep server downloads, file-library management, raw tables and revisions disabled in navigation.

## Upgrade boundary

This release includes the additive `0001_remembered_sessions` migration in the existing Drizzle
history. Startup and ordinary updates never migrate, seed or restore a database automatically.
Preserve catalog identities, artwork originals, tracking and the existing migration ledger.

The host worker verifies signed artifacts and schema/API compatibility, creates a pre-update backup,
and checks readiness with rollback. A different schema fingerprint is reported as
`maintenance-required`; do not bypass that gate or edit installation metadata to pretend a
migration has run. Before Fedora installation, inspect its ledger, verify an independent database
and artwork backup, and rehearse/apply any missing migration through explicit maintenance using
the matching operator image. This publication does not perform that live maintenance.

After schema compatibility is established, the routine server path is Administration → Maintenance →
Updates → Check updates → Install update → Confirm. Watch the matching job through reconnection;
queued is not completed. Linux clients update through their installed Flatpak scope/Software.
Fully quit and reopen the client after upgrading. A client update does not update the server.

## Verification limits

Consolidated source, fixture, disposable database and native checks are reported with the release.
Local thumbnail measurements are documented in DEVELOPMENT.md; they exclude Fedora network and
Home rendering. Final installed Flatpak/Fedora update acceptance follows publication. OpenSubtitles
availability, account quotas, subtitle synchronization and broader live provider playback are not
established by controlled fixtures. Jellyfin, database cloning/synchronization, browser delivery
and Android remain outside this release.
