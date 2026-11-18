# Nahhasio client core

UI-independent client policies and models, consumed by the current Linux shell and mpv adapter.
The package has no native UI SDK, player, HTTP runtime or canonical database dependency.

```sh
devenv shell -- cargo test --locked -p nahhasio-client-core
devenv shell -- cargo build --locked -p nahhasio-client-core
devenv shell -- pnpm check:architecture
```

This initial extraction owns error/ID validation, server-origin policy, Browse/playback preference
models, player defaults, byte ranges and explicit-input Linux storage-layout rules. It does not yet
own the entire client API/session/offline runtime. Preference persistence and OS integration remain
in the desktop adapters; existing serialized documents and file locations are preserved.

The library is statically linked into its consumers. It can be built/tested separately, but updating
an installed desktop to use a new core still requires rebuilding and delivering that desktop.
Future independent repositories need versioned packages and contract ownership, not a dynamic ABI.
See [the architecture guide](../../docs/desktop/architecture.md) for boundaries, remaining extraction work,
release implications and the prerequisites for a repository split.
