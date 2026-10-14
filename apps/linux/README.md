# Nahhasio Linux shell

Rust GTK4/libadwaita/WebKitGTK shell hosting the independent React/Vite UI, with libmpv and
native-owned sessions/network/device storage. It supports viewing and administration.
Linux is the only client through v1.0; the current milestone is 0.1 Alpha.

Read [PROJECT](../../docs/PROJECT.md), [DEVELOPMENT](../../docs/DEVELOPMENT.md) and
[TESTING](../../docs/TESTING.md). `src/main.rs` owns lifecycle/origin; `bridge.rs` bounded calls;
`services.rs` authenticated HTTP/session; `assets.rs` contained packaged UI. The separate
`crates/native-player` and `crates/media-transfer` own player/transfer adapters.

Run `devenv shell -- nahhasio-client`. Production is `nahhasio://app/`; development is exactly
`http://127.0.0.1:23110/`. Fully close/relaunch after rebuilding the native bridge.
Preserve origin/CSP/session/file boundaries. Do not execute downloads or expose arbitrary URLs.

Rust learning ownership remains in AGENTS.md: preserve the working app and let Aqua implement
selected exercises unless implementation is explicitly requested.
