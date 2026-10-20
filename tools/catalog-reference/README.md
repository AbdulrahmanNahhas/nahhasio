# Catalog reference checks

Development-only comparison oracle for the Rust catalog implementation. This package has no
public CLI entry point, server or frontend. Never install it on the family server.

`bin/test-rust-catalog` runs `src/editor/parity-fixture.ts` against its own disposable Unix-socket
PostgreSQL cluster and compares work exports and report results. The remaining SQL helpers and
legacy work reconciliation are dependencies of that oracle and its acceptance scripts. Keep them
until the preservation review establishes a replacement for these independent checks.

The actual operator tool is `crates/cli`, launched by `bin/nahhasio`. Shared validation contracts
and their Rust/OpenAPI generators live in `packages/contracts`.
