# Nahhasio

Private Arabic-first family catalog/database, tracking and media system. **Current milestone: 0.1 Alpha, a reliable base.**
The target is a **Fedora Silverblue/Podman home server and Linux Flatpak client**. No website
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

Current delivery: rootless Podman hosting/recovery and signed Flatpak client distribution.
Version [0.1.1](docs/RELEASE-0.1.1.md) adds coordinated server/host-tool updates and fixes Fedora
query performance, signed package metadata and the desktop icon.
Release 0.1.0 is installed on Fedora with restored catalog/artwork, trusted HTTPS and working
client login/library access. The 0.1.1 source checkpoint still needs its release build/publication
and installed update/recovery acceptance. See [the deployment guide](docs/DEPLOYMENT.md).

## Guides

- [PROJECT](docs/PROJECT.md): product, decisions, architecture, current status and unresolved choices.
- [FEATURES](docs/FEATURES.md): page-by-page feature and UI/UX backlog.
- [ROADMAP](docs/ROADMAP.md): Alpha shortlist and technical delivery tasks.
- [DATABASE](docs/DATABASE.md): inspected catalog inventory and storage/source ownership.
- [Current database baseline](docs/BASELINE.md): verified preservation and future migration procedure.
- [Client behavior](docs/CLIENT.md): reviewed viewer/admin contracts and current coverage.
- [DEVELOPMENT](docs/DEVELOPMENT.md): repository map, commands and native/media boundaries.
- [TESTING](docs/TESTING.md): lean checkpoints and isolated consolidated acceptance.
- [OPERATIONS](docs/OPERATIONS.md): configuration, storage, planned deployment and recovery.
- [Design rules](docs/design-rules.md): reviewed desktop composition.

## Run locally

```sh
devenv processes list
devenv --profile dev up
```

`devenv --profile dev up` (or `devenv -P dev up`) starts PostgreSQL, the Rust API,
Vite and the GTK client with live UI updates. Plain `devenv up` starts only PostgreSQL
and the API; `devenv up client` also builds and launches the desktop bundle.
Stop the previous manager before switching modes; see the [development guide](docs/DEVELOPMENT.md#runbuild).
Ports: database 23102, Rust 23103, desktop Vite 23110.
Use the repository devenv environment. Build/static and runtime verification commands are in
the development/testing guides; avoid duplicate processes.

PostgreSQL and the single `packages/database/drizzle/` history own persistent catalog data.
Startup never migrates/seeds/imports. Backups/artwork/captures are private; retained recovery
files are not disposable caches. Licensed MIT; catalog/media/artwork are not distributed with code.
