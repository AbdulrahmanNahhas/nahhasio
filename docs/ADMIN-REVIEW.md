# Administration review — 2026-10-23

2026-10-25 follow-up: backup/restore and server/client update services and app controls are
implemented in the [deployment checkpoint](DEPLOYMENT.md), awaiting consolidated installation
acceptance. They are enabled only for configured installations. The remaining administration
backlog below follows family-PC setup; Jellyfin/files-only playback is outside this release.

Source review of the Linux administration routes and their current services. This is a proposed
next-work list, not authorization to start additional phases or publish a release. No website is shipped.

## Current pages

| Page                          | Current implementation                                                                                  | Useful next improvement                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Overview                      | Server status, catalog distributions, six-month additions, missing-data links and recent audit activity | Review chart hierarchy and usefulness with Aqua; do not invent playback or hardware metrics |
| Works                         | Paginated editing, selection, JSON, six catalog filters, missing-data filters                           | Review remaining filter needs with Aqua; retain reviewed compact header                     |
| People                        | Drawer editing, credits, aliases, images, JSON and guarded deletion                                     | Better duplicate discovery and merge previews, if requested                                 |
| Studios                       | Shared entity editor plus organization relationships                                                    | Review contribution/reference shortcuts; keep relations contextual                          |
| Planets                       | Definitions, membership and movement                                                                    | Preserve the approved page; no redesign requested                                           |
| Awards                        | Organizations, categories, year/ceremony navigation, recognition cards/table                            | Review search scopes and recognition editing shortcuts                                      |
| Images                        | Upload, assignment, guarded delete, rename and type-specific previews                                   | Review mixed-image ordering and identify broken files with real storage checks              |
| Vocabularies and translations | Read-only table inspector                                                                               | Highest priority: tabs per vocabulary, translation gaps, search and guarded editing         |
| JSON                          | Whole-work and entity editors with review/save                                                          | Improve entry guidance for selecting records; retain schema validation                      |
| Revision history              | Read-only editorial revisions                                                                           | Human-readable diffs and record links; restore needs its own guarded preview/service        |
| All tables                    | Read-only schema/row inspector                                                                          | Keep as an advanced inspection tool, not a generic write console                            |
| File library                  | Read-only roots/files/tracks/Jellyfin tables                                                            | A real file/link health workflow; never infer physical existence from rows                  |
| Server downloads              | Read-only account-download rows                                                                         | Server job/queue services before adding acquisition controls                                |
| Accounts and access           | Users/devices/viewing/policy inspector tabs                                                             | Dedicated management with authorization and session/device handling                         |
| Server activity               | Background-job and audit-log inspector tabs                                                             | Structured job details, errors and filters; controls only when backed by services           |
| Maintenance                   | Library action center; backups/updates/validation remain unavailable                                    | Durable jobs, resumption and recovery after validating foreground batch UX                  |
| Settings and connections      | Server name and write-only provider settings; Jellyfin table inspection                                 | Actual connection management and explicit connection tests                                  |

Episodes, Relations, Contributions, References and Relationship Graph have no standalone admin
pages. Related records remain available in their editors or All Tables. Statistics belongs in Overview.

## Action ownership and limits

- **Maintenance → Library actions** owns operations across records. Overview provides shortcuts.
- Missing episode images: review TMDB series/season mapping, preview available stills, select images,
  then explicitly import. A batch contains at most 48 missing episodes. Existing primary stills
  are protected by assignment revision checks. Special/grouped episode orders use the Work editor.
- Unattached images: explicitly collect a preview, check every candidate's protection status, then
  confirm deleting only reviewed records. Each deletion revalidates authorization, SHA and dependencies.
  Files remain on disk. The preview refuses more than 10,000 records and concurrent list changes.
- Foreground operations show progress, stop after the current item on request, and report partial
  failures. They are not durable server jobs. A failed assignment after ingest may leave an unassigned
  recovery image; cleanup handles it later. Navigation is blocked during active operations.
- Overview reads do not fetch provider images, scan all storage, delete anything, or run migrations.
  Additions measure catalog record creation, not releases or viewing. Image-role counts can overlap.
- No live mutation or provider import was executed while implementing this checkpoint. Read-only SQL,
  static/build results and isolated browser fixtures are reported separately from native acceptance.

## Recommended order after review

1. Vocabularies and translations: compact per-type tabs and safe editing.
2. Revision history: useful diffs and links before considering restoration.
3. Library actions: durable background execution/resume for long operations.
4. Real file-library and server-download operations, then account/device management.

Keep backups, updates and database repair unavailable until their actual services and recovery paths
are implemented and verified. Avoid adding more placeholder admin pages.
