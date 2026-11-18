# Nahhasio

Private Arabic-first family catalog/database, tracking and media system. **Current milestone: 0.1 Alpha, a reliable base.**
The target is a **Fedora Silverblue/Podman home server and Linux Flatpak client**. No website
ships in the delivered product; Linux is the only client through v1.0.

Start with the [documentation index](docs/README.md) or the [project guide](docs/PROJECT.md).
The [roadmap](docs/ROADMAP.md) is a backlog, not an Alpha release checklist.

Approximately 70 Arabic-dubbed works use supplied server files, independently of torrents.
Other catalog works may have no video or download. English audio/Arabic subtitles are normal
preferences; actual available tracks and manual language choice belong to playback.

## Current implementation

Rust/Axum/SQLx server, PostgreSQL catalog, Rust GTK4/libadwaita/WebKitGTK/libmpv desktop,
React/Vite/TanStack Router/Query/Tailwind/shadcn UI. Accounts/discovery/viewer/playback/device
code exists; the complete admin work/bulk/JSON editor is committed as `8aa716a`.

The server and operator CLI are Rust. Stored media uses authenticated Nahhasio original-file
streams through the native mpv client; Jellyfin is retired. A separate rootless media worker
uses FFmpeg/ffprobe and packaged yt-dlp/Deno tools for reviewed imports. Catalog metadata,
artwork and tracking remain owned by Nahhasio. The new media source checkpoint still requires
packaged native and installed acceptance; it is not enabled by upgrading the client alone.
The retired web dashboard and Hono API are removed. React/TypeScript remains the desktop UI,
with Node/pnpm required only for development/build and recovery/reference tooling.

Delivery uses rootless Podman and signed Flatpak distribution. See [Operations](docs/OPERATIONS.md)
for the latest recorded checkpoint and the [family-server handoff](docs/FAMILY-SERVER.md) for what
was verified on the installed machine. Neither is a live status check.

## Guides

- [Development](docs/DEVELOPMENT.md) and [verification](docs/TESTING.md) for contributors.
- [Deployment](docs/DEPLOYMENT.md) and [operations](docs/OPERATIONS.md) for maintainers.
- [Repository instructions](AGENTS.md) and the [agent playbook](docs/AGENTS-PLAYBOOK.md) for agent-assisted work.
- [All guides and release notes](docs/README.md).

## Run locally

```sh
devenv processes list
devenv --profile dev up
```

`devenv --profile dev up` (or `devenv -P dev up`) starts PostgreSQL, the Rust API,
Vite and the GTK client with live UI updates. Plain `devenv up` starts PostgreSQL,
prepares the persistent three-show development demo, starts the API and opens the built client.
Demo logins: `admin@demo.local` / `friend@demo.local`, initially using `demo12345`. Your local
edits and watch history survive subsequent starts; the family catalog is never used.
Stop the previous manager before switching modes; see the [development guide](docs/DEVELOPMENT.md#runbuild).
Ports: database 23102, Rust 23103, desktop Vite 23110.
Use the repository devenv environment. Build/static and runtime verification commands are in
the development/testing guides; avoid duplicate processes.

PostgreSQL and the single `packages/database/drizzle/` history own persistent catalog data.
Startup never migrates/seeds/imports. Backups/artwork/captures are private; retained recovery
files are not disposable caches. Licensed MIT; catalog/media/artwork are not distributed with code.
