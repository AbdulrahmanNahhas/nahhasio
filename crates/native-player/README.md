# Nahhasio native player adapter

The production Linux shell consumes `NativePlayer`. This crate isolates GTK/libmpv lifecycle
and the private FFI boundary; `ProofPlayer` and the examples are diagnostics, not another app.
Read [DEVELOPMENT](../../docs/DEVELOPMENT.md) and [TESTING](../../docs/TESTING.md) for application
transport, source restrictions and evidence limits. Historical rendering reports are in Git.

## Ownership and safety

Workspace/server unsafe restrictions remain intact. This crate denies unsafe except for its
private `backend.rs`; callers do not own raw mpv/GL pointers. `NativePlayer::local` accepts a
validated local file and `NativePlayer::loopback` accepts the approved contained gateway source.
It is not a generic remote-URL player or a server/library/download service.

GTK owns the render context and lifecycle. Keep callbacks bounded and free of GTK work/panics,
copy native event data before its ownership expires, and free renderer/callback/core resources
in the correct context/order. Locale-sensitive mpv numeric parsing needs the established C
numeric locale before runtime threads. Preserve protocol/config/script restrictions.

Public controls include playback/seek, volume/mute/speed, audio/subtitle tracks, external subtitle
loading, delays and subtitle style. Do not expose arbitrary mpv commands through the UI bridge.
Diagnostic render samples/smoke success do not establish physical input, HDR, hardware decode,
GPU smoothness or release portability.

## Diagnostic examples

```sh
devenv shell -- cargo build -p nahhasio-native-player --example gtk_local --locked
devenv shell -- cargo run -p nahhasio-native-player --example gtk_local --locked -- /absolute/path/to/local-video.mp4
```

`gtk_local` accepts diagnostic `--smoke` and `--web-overlay`; inspect its actual result/window.
Use synthetic/private fixture media, not a public transfer. `examples/run-on-shadow.sh` is a
process-local development graphics-loader workaround; it is not an AppImage packaging solution.
The application launcher uses `bin/nahhasio-native-runtime`. Never change system configuration
or relax WebKit sandbox/CSP to make a diagnostic pass. Inspect dependency/source licenses before
reusing upstream implementation. libmpv render FFI is isolated here; do not reintroduce the
historically rejected wrapper layout/teardown assumptions without reviewing its current ABI.
