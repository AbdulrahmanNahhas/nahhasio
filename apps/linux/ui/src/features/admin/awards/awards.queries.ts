import {
  rpcInputs,
  rpcResults,
  awardTables,
  awardDefinitionTables,
} from "@arcadia/contracts/editor-rpc";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { gateway } from "@/lib/bridge";

export type AwardTable = (typeof awardTables)[number];
export type DefinitionTable = (typeof awardDefinitionTables)[number];
export type AwardRow = z.infer<typeof rpcResults.awardDetail>["row"];
export type AwardDetail = z.infer<typeof rpcResults.awardDetail>;
export const awardSearchSchema = z.object({
  tab: z.enum(awardTables).catch("award_recognitions").default("award_recognitions"),
  organization: z
    .union([z.string().uuid(), z.literal("")])
    .catch("")
    .default(""),
  category: z
    .union([z.string().uuid(), z.literal("")])
    .catch("")
    .default(""),
  ceremony: z
    .union([z.string().uuid(), z.literal("")])
    .catch("")
    .default(""),
  year: z
    .string()
    .regex(/^(19|20)[0-9]{2}$|^2100$|^$/)
    .catch("")
    .default(""),
  featured: z.enum(["", "yes"]).catch("").default(""),
  source: z.enum(["all", "documented", "missing"]).catch("all").default("all"),
  sort: z.enum(["newest", "oldest", "work"]).catch("newest").default("newest"),
  view: z.enum(["grid", "table"]).catch("grid").default("grid"),
  q: z.string().max(300).catch("").default(""),
  page: z
    .string()
    .regex(/^[1-9][0-9]{0,4}$/)
    .catch("1")
    .default("1"),
  result: z.enum(["all", "winner", "nominee"]).catch("all").default("all"),
});
export type AwardSearch = z.infer<typeof awardSearchSchema>;
export const awardListQuery = (search: AwardSearch) =>
  queryOptions({
    queryKey: ["admin", "awards", "list", search],
    queryFn: async ({ signal }) =>
      rpcResults.awardList.parse(
        await gateway.editorCall(
          {
            operation: "awardList",
            data: {
              table: search.tab,
              organization: search.organization || null,
              q: search.q,
              page: Number(search.page),
              result: search.result,
              category: search.category || null,
              ceremony: search.ceremony || null,
              year: search.year ? Number(search.year) : null,
              featured: search.featured === "yes",
              source: search.source,
              sort: search.sort,
            },
          },
          signal,
        ),
      ),
    staleTime: 30000,
  });
export const awardDetailQuery = (table: DefinitionTable, id: string) =>
  queryOptions({
    queryKey: ["admin", "awards", "detail", table, id],
    queryFn: async ({ signal }) =>
      rpcResults.awardDetail.parse(
        await gateway.editorCall({ operation: "awardDetail", data: { table, id } }, signal),
      ),
    staleTime: Infinity,
  });
export const saveAward = async (data: z.infer<typeof rpcInputs.awardSave>) =>
  rpcResults.awardSave.parse(await gateway.editorCall({ operation: "awardSave", data }));
export const deleteAward = async (data: z.infer<typeof rpcInputs.awardDelete>) =>
  rpcResults.awardDelete.parse(await gateway.editorCall({ operation: "awardDelete", data }));
export const text = (row: AwardRow, key: string) => z.string().safeParse(row[key]).data ?? "";
export const awardLabels = {
  award_organizations: "الجهات المانحة",
  award_categories: "الفئات",
  award_ceremonies: "الدورات",
  award_recognitions: "الجوائز والترشيحات",
} satisfies Record<AwardTable, string>;
export const awardLabel = (row: AwardRow) =>
  text(row, "name_ar") || text(row, "label") || String(row.year ?? "");

export const resetAwardFilters = {
  category: "",
  ceremony: "",
  year: "",
  featured: "",
  source: "all",
  result: "all",
  q: "",
  page: "1",
} satisfies Partial<AwardSearch>;
