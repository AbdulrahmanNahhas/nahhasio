import type { TrailerEntry } from "@nahhasio/api-contract";
import { z } from "zod";

import { gateway, type TrailersQuery } from "@/lib/bridge";

const unsupportedMediaFilter = z.union([
  z.object({ status: z.union([z.literal(400), z.literal(422)]) }),
  z.object({ code: z.literal("bad_request") }),
]);

// Keep the legacy classification aligned with the server's MUSIC_TITLE rule.
const themeTitle =
  /(?:^|[^\p{L}\p{N}])(?:ost|soundtrack|theme songs?|music videos?|original score|opening (?:theme|song|credits)|ending (?:theme|song|credits)|موسيقى|الموسيقى|أغني[ةه]|الأغني[ةه]|أغاني|شارة|الشارة|ألحان|أنشودة)(?:[^\p{L}\p{N}]|$)|^(?:opening|ending)(?:\s+[0-9]+)?$/iu;
const pageSize = 24;
const legacyScanLimit = 4;

export const firstClipPage = { number: 1, legacy: false };

export async function fetchClips(
  query: TrailersQuery,
  cursor: typeof firstClipPage,
  signal: AbortSignal,
) {
  const { media, ...filters } = query;
  if (!cursor.legacy) {
    try {
      const page = await gateway.trailers({ ...query, page: cursor.number, pageSize }, signal);
      return {
        items: page.items,
        total: page.total,
        next:
          page.page * page.pageSize < page.total
            ? { number: page.page + 1, legacy: false }
            : undefined,
      };
    } catch (error) {
      if (
        !media ||
        cursor.number !== 1 ||
        !(error instanceof Error) ||
        !unsupportedMediaFilter.safeParse(error.cause).success
      )
        throw error;
    }
  }
  const items: TrailerEntry[] = [];
  let number = cursor.number;
  for (let scanned = 0; scanned < legacyScanLimit; scanned++) {
    const page = await gateway.trailers({ ...filters, page: number, pageSize }, signal);
    items.push(
      ...page.items.filter(
        ({ trailer }) => themeTitle.test(trailer.title.trim()) === (media === "music"),
      ),
    );
    if (page.page * page.pageSize >= page.total) return { items };
    number = page.page + 1;
    if (items.length >= pageSize) break;
  }
  return { items, next: { number, legacy: true } };
}
