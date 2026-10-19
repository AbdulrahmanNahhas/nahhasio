import { rpcInputs, rpcResults } from "@arcadia/contracts/editor-rpc";
import { queryOptions } from "@tanstack/react-query";

import { gateway } from "@/lib/bridge";

import type { DatabaseRow } from "./database-model";
export const databaseKeys = {
  all: ["admin", "editor"] as const,
  schema: ["admin", "editor", "schema"] as const,
  records: (table: string) => ["admin", "editor", "records", table] as const,
};
export const databaseSchemaOptions = () =>
  queryOptions({
    queryKey: databaseKeys.schema,
    queryFn: async ({ signal }) => {
      const response = await gateway.editorCall({ operation: "schema", data: {} }, signal);
      const parsed = rpcResults.schema.safeParse(response);
      if (!parsed.success)
        throw new Error("تعذّر قراءة تعريف الحقول من الخادم. أعد المحاولة بعد تحديث الخادم.");
      return parsed.data;
    },
    staleTime: 60000,
  });
export const databaseRecordsOptions = (
  table: string,
  offset = 0,
  search = "",
  filters: DatabaseRow = {},
  sort: "default" | "newest" | "oldest" = "default",
) =>
  queryOptions({
    queryKey: [...databaseKeys.records(table), { offset, search, filters, sort }],
    queryFn: async ({ signal }) =>
      rpcResults.refs.parse(
        await gateway.editorCall(
          {
            operation: "refs",
            data: rpcInputs.refs.parse({ table, offset, search, filters, sort }),
          },
          signal,
        ),
      ),
  });
