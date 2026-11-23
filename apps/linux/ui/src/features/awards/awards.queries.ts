import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { gateway } from "@/lib/bridge";

const page = z
  .string()
  .regex(/^(?:[1-9]\d{0,4}|100000)$/)
  .catch("1");
export const awardsSearch = z.object({ page });
export const awardSearch = awardsSearch.extend({
  year: z
    .string()
    .regex(/^(19\d{2}|20\d{2}|2100|undated)$/)
    .catch(""),
});

export const AWARDS_PAGE_SIZE = 12;
export const RECOGNITIONS_PAGE_SIZE = 40;
export const awardsQuery = (query: { slug?: string; year?: string; page?: number } = {}) =>
  queryOptions({
    queryKey: ["catalog", "awards", query],
    queryFn: ({ signal }) => gateway.awards(query, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
