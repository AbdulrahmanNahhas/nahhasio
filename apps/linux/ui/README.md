# Nahhasio desktop interface

React/Vite/TypeScript with TanStack Router/Query, Tailwind 4 and shadcn Base UI. The current
registry is `base-maia` with Mist tokens and RTL. Preserve Aqua's reviewed source/design.

Read [PROJECT](../../../docs/PROJECT.md), [design rules](../../../docs/design-rules.md),
[DEVELOPMENT](../../../docs/DEVELOPMENT.md) and [TESTING](../../../docs/TESTING.md).

Native Rust owns sessions, network, player and storage. UI uses typed `src/lib/bridge.ts` calls
and generated OpenAPI validation; no tokens, direct browser server fetch or arbitrary native
operations. Native session persistence/server selection are pending work.

Small `src/routes` entries use hash history and one QueryClient. Never hand-edit the generated
route tree. Feature queries are bounded/cancellable and caches belong to server/account identity.
Desktop uses Vite/Router/Query, not Start. The transitional website is a separate migration surface.

`src/styles/tailwind.css` owns fonts/tokens/global rules; feature layouts use static utilities.
Official primitives stay generated; CSPProvider disables Base UI injected styles, while the
trusted CodeMirror style module uses the existing native per-page nonce. Do not relax CSP guards.

Run through devenv: `pnpm --filter @nahhasio/linux-ui dev`, `build`, or `typecheck`.
Browser fixtures use 23110; isolated player fixtures use 23112 and do not establish GTK input.
