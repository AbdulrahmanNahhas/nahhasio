# Watch-page checkpoint

The Linux watch page keeps catalog context, episode navigation and family discussion visible
independently of source lookup. The existing source selection, file choice, media ownership,
resume/progress, player controls and dedicated download flows remain in place. A failed source
search occupies only the video frame. It does not fake playback or replace the watch page.

## Layout and native video

The desktop Arabic layout places the native video and details beside an episode column. Narrow
windows place a collapsible episode section before discussion. Theater mode hides the episode
column. Movies use the full width and expose no episode sidebar or episode toggle. Their
installment selector, status badges and watched control sit below the video, with the selector alone on the left and equally tall status badges opposite it.
Installment menus open below their triggers. Local files hide episode navigation as well; files without catalog identity retain playback
without fabricated work discussion. The player has no title/back overlay; fullscreen lives in
the bottom controls. The page presents the filename once below the video.

`player.viewport` carries only bounded, session-scoped logical geometry. A non-measuring GTK
Fixed overlay positions the native GLArea beneath WebKit; the native video cannot impose its
previous width as the window minimum. A background mask leaves a transparent video aperture
while painting the rest of the page. Resize/scroll measurements are coalesced and native updates
are serialized. Layout and fullscreen changes retain the playback session.

Window fullscreen (Niri/F11) and video fullscreen are separate. Only the player command enters
video-only mode. Leaving it preserves a window that was already fullscreen. Leaving window
fullscreen clears video-only mode. Closing playback does not undo independently requested window
fullscreen. Keyboard transport is scoped to the video area in page mode, preserving text input.

## Family discussion

Discussion remains work-level, using the existing title_comments and title_reviews tables.
The viewer feed is reused, with 30-second refresh while online. The new bounded comments endpoint
supports create/reply, update and hide-own-comment actions. Identity comes from the authenticated
account, checked in a write transaction; parent comments must belong to the same work and be
visible. Edits cannot change parent/work/author. Hiding a comment preserves other people's replies.
The request body supports 1200 Arabic characters without exceeding the byte limit.

Comment drafts stay in component state across source errors and episode changes within the work.
Posting failures retain the draft. Switching a nonempty draft to another reply/edit requires an
explicit discard decision. Spoiler text is concealed, and delete has a confirmation. Offline mode
shows discussion as unavailable; comments are not added to the offline mutation queue.

## Acceptance boundaries

The focused browser fixtures simulate source failure, discussion writes and native geometry without
SQL or real provider access. Unit tests cover comment input/identity restrictions and viewport
bounds. The explicit ignored GTK geometry test requires a real display and one test thread.
Comment database mutation acceptance requires a disposable migrated database, never the family
catalog. Fresh GTK/WebKit interaction, physical Niri fullscreen, video/subtitle rendering and native
scroll/resizing need manual acceptance against the rebuilt binary; browser checks do not certify
those properties. Reopen the client after native changes. This checkpoint does not build an AppImage.
