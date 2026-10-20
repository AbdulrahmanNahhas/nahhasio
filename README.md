# Nahhasio

Private Arabic-first family catalog/database, tracking and media system. **Current milestone: 0.1 Alpha, a reliable base.**
The target is a **Fedora Silverblue/Podman home server and Linux AppImage client**. No website
ships in the delivered product; Linux is the only client through v1.0.

Start with [the project guide](docs/PROJECT.md) and [the large roadmap](docs/ROADMAP.md).
The roadmap contains future ideas as well as near-term tasks; all 280 tasks are not Alpha gates.

Approximately 70 Arabic-dubbed works use supplied server files, independently of torrents.
Other catalog works may have no video or download. English audio/Arabic subtitles are normal
preferences; actual available tracks and manual language choice belong to playback.

## Current implementation

Rust/Axum/SQLx server, PostgreSQL catalog, Rust GTK4/libadwaita/WebKitGTK/libmpv desktop,
React/Vite/TanStack Router/Query/Tailwind/shadcn UI. Accounts/discovery/viewer/playback/device
code exists; the complete admin work/bulk/JSON editor is committed as `8aa716a`.

The installed server and operator CLI are Rust-only. Jellyfin is the confirmed future backend
for stored-media playback/streaming; Nahhasio owns catalog metadata, artwork and tracking.
The retired web dashboard and Hono API are removed. React/TypeScript remains the desktop UI,
with Node/pnpm required only for development/build and recovery/reference tooling.

Next: pre-deployment schema/logic review, Podman packaging and recovery, then the remaining
Overview/Settings services and verified server/AppImage updates.

## Guides

- [PROJECT](docs/PROJECT.md): product, decisions, architecture, current status and unresolved choices.
- [FEATURES](docs/FEATURES.md): short page-by-page feature and UI/UX checklist.
- [ROADMAP](docs/ROADMAP.md): Alpha shortlist and technical delivery tasks.
- [DATABASE](docs/DATABASE.md): inspected catalog inventory and storage/source ownership.
- [DEVELOPMENT](docs/DEVELOPMENT.md): repository map, commands and native/media boundaries.
- [TESTING](docs/TESTING.md): lean checkpoints and isolated consolidated acceptance.
- [OPERATIONS](docs/OPERATIONS.md): configuration, storage, planned deployment and recovery.
- [Design rules](docs/design-rules.md): reviewed desktop composition.

## Run locally

```sh
devenv processes list
devenv up postgres server
devenv shell -- nahhasio-client
```

`devenv up` starts PostgreSQL, the Rust API and the Linux desktop.
Ports: database 23102, Rust 23103, desktop Vite 23110.
Use the repository devenv environment. Build/static and runtime verification commands are in
the development/testing guides; avoid duplicate processes.

PostgreSQL and the single `packages/database/drizzle/` history own persistent catalog data.
Startup never migrates/seeds/imports. Backups/artwork/captures are private; retained recovery
files are not disposable caches. Licensed MIT; catalog/media/artwork are not distributed with code.
