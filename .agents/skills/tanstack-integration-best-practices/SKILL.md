---
name: tanstack-integration-best-practices
description: Integrate TanStack Router and Query in Nahhasio's Vite desktop UI, including typed route context, native bridge queries, cancellation, preloading and cache invalidation.
---

# Router and Query integration

For apps/linux/ui, read the sibling nahhasio-desktop-ui skill. The packaged client uses Vite,
Router and Query; native Rust owns transport and secrets. No Start server functions, SSR
hydration or direct browser fetch belong in the desktop. The old Start dashboard is retired.

- Pass one QueryClient to Router context and QueryClientProvider; Query owns remote caching.
- Share typed feature query options between loaders/components. Include all filter and identity
  dependencies in keys; forward cancellation to the native gateway and clear private data on logout.
- Prefer intent preloading with defaultPreloadStaleTime: 0 so Query decides freshness.
- Keep bounded queries, parsed mutations and targeted invalidation. Route guards never grant
  administrative permission; the server enforces it.
- Preserve hash URLs, native origin/CSP and scroll/focus restoration. Remove the parallel
  hashchange implementation when Router history owns navigation.

Read focused context/loader/cache examples in rules when working on those boundaries.
Current APIs: https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading
and https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation.
