# Query client context

Construct one desktop QueryClient and pass it to Router context and QueryClientProvider.
Type the root with createRootRouteWithContext and register the router for inferred params/search.
Use shared feature query options in loaders and components.

The packaged Vite desktop does not use setupRouterSsrQueryIntegration or per-request hydration.
See the official Router external-data-loading guide for the Vite integration.
