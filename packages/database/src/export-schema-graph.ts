/** Export public schema metadata only; never opens a database connection. */
import { writeFileSync } from "node:fs";

import { is, SQL } from "drizzle-orm";
import { getTableConfig, PgDialect, PgTable } from "drizzle-orm/pg-core";

import * as schema from "./schema.js";

const dialect = new PgDialect();
const tables = Object.values(schema)
  .filter((value) => is(value, PgTable))
  .map((table) => {
    const config = getTableConfig(table);
    const primary = new Set(
      config.primaryKeys.flatMap((key) => key.columns.map((column) => column.name)),
    );
    return {
      name: config.name,
      columns: config.columns.map((column) => ({
        name: column.name,
        type: column.getSQLType(),
        nullable: !column.notNull,
        primary: column.primary || primary.has(column.name),
        unique: column.isUnique,
        default:
          column.default === undefined
            ? null
            : is(column.default, SQL)
              ? dialect.sqlToQuery(column.default).sql
              : String(column.default),
        enumValues: column.enumValues ?? [],
      })),
      foreignKeys: config.foreignKeys.map((key) => {
        const reference = key.reference();
        return {
          name: key.getName(),
          columns: reference.columns.map((column) => column.name),
          target: getTableConfig(reference.foreignTable).name,
          targetColumns: reference.foreignColumns.map((column) => column.name),
          onDelete: key.onDelete ?? "no action",
          onUpdate: key.onUpdate ?? "no action",
        };
      }),
      indexes: config.indexes.map(({ config: indexConfig }) => ({
        name: indexConfig.name,
        unique: indexConfig.unique,
        method: indexConfig.method,
        columns: indexConfig.columns.map((column) =>
          is(column, SQL) ? dialect.sqlToQuery(column).sql : "name" in column ? column.name : null,
        ),
        where: indexConfig.where ? dialect.sqlToQuery(indexConfig.where).sql : null,
      })),
      uniqueConstraints: config.uniqueConstraints.map((constraint) => ({
        name: constraint.getName(),
        columns: constraint.columns.map((column) => column.name),
      })),
      checks: config.checks.map((constraint) => ({
        name: constraint.name,
        expression: dialect.sqlToQuery(constraint.value).sql,
      })),
    };
  })
  .toSorted((a, b) => a.name.localeCompare(b.name));
writeFileSync(process.argv[2] ?? 1, `${JSON.stringify(tables, null, 2)}\n`);
console.error(
  `Exported ${tables.length} tables, ${tables.reduce((sum, table) => sum + table.columns.length, 0)} columns, ${tables.reduce((sum, table) => sum + table.foreignKeys.length, 0)} foreign keys.`,
);
