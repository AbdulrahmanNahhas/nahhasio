import { createHashHistory, createRouter } from "@tanstack/react-router";

import { routeTree } from "../routeTree.gen";
import { queryClient } from "./query-client";
export { queryClient } from "./query-client";

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  // The scroll container and focus belong to the GTK viewing shell.
  scrollRestoration: false,
  parseSearch: (search) => Object.fromEntries(new URLSearchParams(search)),
  stringifySearch: (search) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (value !== undefined) params.set(key, String(value));
    }
    return params.size ? `?${params}` : "";
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
