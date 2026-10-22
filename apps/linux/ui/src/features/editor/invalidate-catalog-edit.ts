import type { QueryClient } from "@tanstack/react-query";

// Work credits, entities and artwork assignments share catalog records. Every editor
// refreshes the same consumers so switching editors cannot reuse stale linked data.
export async function invalidateCatalogEdit(client: QueryClient) {
  await Promise.all(
    [
      ["admin", "entities"],
      ["admin", "awards"],
      ["database"],
      ["admin", "database"],
      ["admin", "planets"],
      ["admin", "editor"],
      ["admin", "images"],
      ["admin", "works"],
      ["catalog"],
      ["work"],
      ["home"],
    ].map((queryKey) => client.invalidateQueries({ queryKey })),
  );
}
