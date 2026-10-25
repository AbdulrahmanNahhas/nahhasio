# Nahhasio project guide

Updated 2026-10-25. This guide owns product decisions; [ROADMAP](ROADMAP.md) owns the future
inventory, and [DEPLOYMENT](DEPLOYMENT.md) owns the current hosting release.

## Product and current release

Nahhasio is an Arabic-first private family catalog, artwork and tracking system with a Linux
viewing and administration client. Current milestone: **0.1 Alpha**. Catalog identities and
editorial data are the foundation; a work can exist without any available video.

The home server targets Fedora Atomic/Silverblue with rootless Podman Quadlets and PostgreSQL.
The GTK4/libadwaita/WebKitGTK/libmpv client ships as Flatpak. React/Vite/TypeScript provides its
interface, with TanStack Router/Query and official shadcn Base UI Maia/Mist components. The
installed server and operator CLI are Rust-only. Node/pnpm and Nix/devenv are development/build
tools. There is no shipped website. Linux is the only client through v1.0.

The current release covers rootless hosting, coordinated backup/restore, catalog transfer,
independent laptop development, signed server/Flatpak delivery and app maintenance controls.
The code checkpoint exists; complete SDK builds and installed Fedora acceptance remain pending.
Player/provider testing, Jellyfin and files-only playback are outside this release. Remaining
catalog/admin improvements can follow installation.

## Family use and ownership

- Initial access is on the home network, often on the server PC connected to the TV. Public
  access/VPN, other client platforms and advanced family profiles are future work.
- Initial accounts are administrator and family user. Keep account, viewing profile, device,
  server identity and library policy distinct.
- PostgreSQL owns catalog records, identities, links, editorial notes/scores, permissions and
  personal tracking. The server owns artwork and private provider configuration.
- The native client owns sessions, server trust, device storage, saved snapshots and queued
  personal updates. The React interface uses the typed native bridge and contains no credentials.
- Preserve the reviewed Arabic/RTL design. New features use existing tokens and components.
- English audio with Arabic subtitles is the usual preference; Arabic dub and other available
  tracks remain selectable. Approximately 70 works have supplied Arabic-dubbed files.

## Separate media workflows

**Save work** retains authorized metadata/artwork and source identities on a device. It never
starts a video download. **Download to device** retains device-owned video. **Download to server**
is an explicit acquisition job that retains server media. **Play** selects an available source.
These actions have distinct state, ownership and recovery rules.

Torrent streaming runs on the client only. The server acquires torrents only after an explicit
Download to server request. Whole-work files-only policy suppresses torrent actions; there are
no per-part/episode overrides initially. Existing files should be scanned and linked without
moving or renaming originals. Stored-media integration is deferred; Jellyfin, if used, supplies
media delivery and minimal track identities, never catalog/artwork authority or tracking sync.

Saved browsing and downloaded files work without the home server. Online source resolution
still needs internet. Server/account-scoped offline mutations are progress and watched/unwatched
only; reconnect synchronization must preserve ownership and resolve conflicts. Cached metadata
is not permission to expose secrets or infer that a device has complete files.

## Catalog rules

Dub languages and notes belong to the whole work; contributions can identify dubbing studios and
credit languages. Each work has at most one planet. Trailers use validated YouTube IDs. Episode
stills are registered server artwork attached to episode UUIDs. Do not introduce edition systems,
alternate episode listings or extra availability labels.

Keep Save work, favorites, source selection and download state distinct. Existing schema concepts
must be inspected before adding replacements. See [DATABASE](DATABASE.md) and [BASELINE](BASELINE.md).

## Administration and delivery

Administration lives in the Linux client. Permissions are enforced by server services; a table
inspector or placeholder page does not establish mutation/job support. Provider keys stay
server-owned, write-only through settings, with masked status responses.

Server updates use verified artifacts, compatibility checks, recovery checkpoints and health
rollback. Flatpak/Software owns client updates and host automatic-update policy. Startup never
migrates or seeds; schema and PostgreSQL major upgrades are explicit maintenance.

A future operator CLI will run on Shadow and connect to the server over authenticated HTTPS
using a server address and an API key. It is deferred, not currently implemented. Its design
should use scoped, revocable credentials, server authorization/auditing and the same guarded
catalog services. It must not expose PostgreSQL credentials, arbitrary SQL or host commands over
the network. The existing direct-database Rust CLI remains available for local development and
explicit host maintenance; SSH is not the desired routine catalog-editing workflow.

## Working guides

- [Development](DEVELOPMENT.md): commands, architecture and storage boundaries.
- [Client behavior](CLIENT.md): reviewed administration/viewer behavior.
- [Testing](TESTING.md): isolated checks and acceptance limits.
- [Operations](OPERATIONS.md): runtime configuration, trust and recovery.
- [Deployment](DEPLOYMENT.md): hosting sequence and remaining acceptance.
- [Features](FEATURES.md) and [roadmap](ROADMAP.md): proposed backlog, not completion claims.
