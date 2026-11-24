# Nahhasio Linux shell

Rust GTK4/libadwaita/WebKitGTK shell hosting the independent React/Vite UI, with libmpv and
native-owned sessions/network/device storage. It supports viewing and administration.
Linux is the current viewing and administration client. The [Android plan](../../docs/project/android.md) describes the proposed 0.3.0 phone and TV clients.

Read [PROJECT](../../docs/project/overview.md), [DEVELOPMENT](../../docs/development/getting-started.md) and
[TESTING](../../docs/development/testing.md). `src/main.rs` owns lifecycle/origin; `bridge.rs` bounded calls;
`services.rs` authenticated HTTP/session; `assets.rs` contained packaged UI. The separate
`crates/native-player` and `crates/media-transfer` own player/transfer adapters.

Run `devenv shell -- nahhasio-client`. Production is `nahhasio://app/`; development is exactly
`http://127.0.0.1:23110/`. Fully close/relaunch after rebuilding the native bridge.
Preserve origin/CSP/session/file boundaries. Do not execute downloads or expose arbitrary URLs.

For selected Rust exercises, follow [Aqua's learning workflow](../../docs/development/getting-started.md#development-after-transfer-and-learning).
