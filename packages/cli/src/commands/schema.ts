/**
 * `nahhasio schema` — machine-readable schema discovery.
 *
 * Exists so an agent never has to open `packages/database/src/schema.ts` (1400+ lines) just to
 * learn a column name or the members of an enum.
 */

import type { ParsedArgs } from "../args";
import { boolFlag, stringFlag } from "../args";
import type { Sql } from "../db";
import { loadSchema, requireTable } from "../introspect";
import { findResource, resources } from "../registry";
import type { CommandResult } from "../types";

export async function schemaCommand(
  sql: Sql,
  args: ParsedArgs,
  target: string | undefined,
): Promise<CommandResult> {
  const schema = await loadSchema(sql);

  if (boolFlag(args, "enums")) {
    return [...schema.enums.entries()].map(([name, values]) => ({
      enum: name,
      values: values.join(", "),
    }));
  }

  if (boolFlag(args, "resources")) {
    return resources.map((resource) => ({
      resource: resource.name,
      table: resource.table,
      aliases: (resource.aliases ?? []).join(", "),
      summary: resource.summary,
    }));
  }

  if (!target) {
    const filter = stringFlag(args, "search")?.toLowerCase();
    return [...schema.tables.values()]
      .filter((table) => !filter || table.name.includes(filter))
      .map((table) => ({
        table: table.name,
        resource: findResource(table.name)?.name ?? "",
        columns: table.columns.length,
        primaryKey: table.primaryKey.join(", "),
      }));
  }

  const resource = findResource(target);
  const table = requireTable(schema, resource?.table ?? target.replace(/-/g, "_"));
  const foreignKeys = new Map(table.foreignKeys.map((key) => [key.column, key]));

  return table.columns.map((column) => {
    const foreignKey = foreignKeys.get(column.name);
    return {
      column: column.name,
      type: column.isArray ? `${column.type}[]` : column.type,
      null: column.nullable ? "yes" : "NOT NULL",
      default: column.hasDefault ? "yes" : "",
      generated: column.isGenerated,
      pk: table.primaryKey.includes(column.name) ? "pk" : "",
      references: foreignKey ? `${foreignKey.referencesTable}.${foreignKey.referencesColumn}` : "",
      values: column.enumValues ? column.enumValues.join(" | ") : "",
    };
  });
}
