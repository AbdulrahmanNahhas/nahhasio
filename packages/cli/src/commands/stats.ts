/**
 * `nahhasio stats` — aggregate reporting.
 *
 * Two layers: named presets for the questions asked most often about a catalog (coverage gaps,
 * score distribution, vocabulary usage), and a generic group-by that works on any resource so
 * an unanticipated question does not require a code change.
 */

import { scoreWeights } from "@arcadia/domain";

import type { ParsedArgs } from "../args";
import { intFlag, listFlag, rawListFlag, stringFlag } from "../args";
import { assertIdentifier, parameters, type Sql } from "../db";
import { loadSchema, requireColumn, requireTable } from "../introspect";
import { CliError } from "../output";
import { buildCondition, combine, QueryBuilder } from "../query";
import { resolveResource } from "../registry";
import type { CommandResult, Row } from "../types";

/** The weighted editorial rating, expressed in SQL so it can be aggregated server-side. */
const ratingExpression = `(
  s.story * ${scoreWeights.story} + s.characters * ${scoreWeights.characters} +
  s.depth * ${scoreWeights.depth} + s.world_building * ${scoreWeights.worldBuilding} +
  s.originality * ${scoreWeights.originality} + s.craft * ${scoreWeights.craft}
)`;

const metricPattern = /^(count|count-distinct|avg|sum|min|max)(?::([a-z_][a-z0-9_]*))?$/;

type Metric = { alias: string; sql: string };

function metricExpression(metric: string, tableName: string): Metric {
  const match = metricPattern.exec(metric.trim());
  if (!match) {
    throw new CliError(
      `Unsupported metric "${metric}"`,
      "Use count, count-distinct:column, avg:column, sum:column, min:column, or max:column.",
    );
  }
  const [, kind, column] = match;
  if (kind === "count") return { alias: "count", sql: "count(*)::int" };
  if (!column) throw new CliError(`Metric "${kind}" needs a column, e.g. ${kind}:story`);
  assertIdentifier(column, "column name");
  const reference = `"${tableName}"."${column}"`;
  if (kind === "count-distinct") {
    return { alias: `distinct_${column}`, sql: `count(distinct ${reference})::int` };
  }
  if (kind === "avg")
    return { alias: `avg_${column}`, sql: `round(avg(${reference})::numeric, 2)` };
  return { alias: `${kind}_${column}`, sql: `${kind}(${reference})` };
}

async function genericStats(
  sql: Sql,
  args: ParsedArgs,
  resourceName: string,
): Promise<CommandResult> {
  const schema = await loadSchema(sql);
  const resource = resolveResource(resourceName, new Set(schema.tables.keys()));
  const table = requireTable(schema, resource.table);

  const builder = new QueryBuilder();
  const conditions = Object.entries(resource.scope ?? {}).map(([name, value]) => ({
    text: `"${assertIdentifier(name, "column name")}" = ${builder.bind(value)}`,
  }));
  for (const expression of rawListFlag(args, "where")) {
    conditions.push(buildCondition(builder, table, expression));
  }

  const groupColumns = listFlag(args, "by").map(
    (name) => requireColumn(table, assertIdentifier(name, "column name")).name,
  );
  const metrics = listFlag(args, "metric");
  const selected = (metrics.length > 0 ? metrics : ["count"]).map((metric) =>
    metricExpression(metric, table.name),
  );

  const selectParts = [
    ...groupColumns.map((name) => `"${table.name}"."${name}"`),
    ...selected.map((metric) => `${metric.sql} as "${metric.alias}"`),
  ];
  const order = stringFlag(args, "order") ?? `"${selected[0]?.alias ?? "count"}" desc nulls last`;
  if (!/^"?[a-z_][a-z0-9_]*"?(\s+(asc|desc))?(\s+nulls\s+(first|last))?$/i.test(order.trim())) {
    throw new CliError(`Cannot sort stats by "${order}"`, 'Use e.g. --order "count desc".');
  }

  const text = [
    `select ${selectParts.join(", ")} from "${table.name}"`,
    combine(conditions),
    groupColumns.length > 0
      ? `group by ${groupColumns.map((name) => `"${table.name}"."${name}"`).join(", ")}`
      : "",
    `order by ${order}`,
    `limit ${builder.bind(intFlag(args, "limit") ?? 100)}`,
  ]
    .filter((part) => part.length > 0)
    .join(" ");
  return sql.unsafe<Row[]>(text, parameters(builder.params));
}

const presets = new Map<string, (sql: Sql) => Promise<CommandResult>>(
  Object.entries({
    async overview(sql) {
      const [row] = await sql<Row[]>`
      select
        (select count(*)::int from titles) as titles,
        (select count(*)::int from titles where workflow_status = 'published') as published,
        (select count(*)::int from titles where workflow_status = 'draft') as draft,
        (select count(*)::int from titles where is_private) as private,
        (select count(*)::int from installments) as installments,
        (select count(*)::int from episodes) as episodes,
        (select count(*)::int from entities where kind = 'person') as people,
        (select count(*)::int from entities where kind = 'organization') as organizations,
        (select count(*)::int from award_recognitions) as awards,
        (select count(*)::int from planets where is_active) as planets,
        (select count(*)::int from media_assets) as media_assets,
        (select count(*)::int from accounts) as accounts`;
      return row ?? {};
    },

    /** Where the catalog is incomplete — the report that decides what to work on next. */
    async coverage(sql) {
      return sql<Row[]>`
      select 'titles without a summary' as gap, count(*)::int as n from titles where btrim(summary) = ''
      union all select 'titles without content warnings', count(*)::int from titles
        where content_warnings is null or btrim(content_warnings) = ''
      union all select 'titles without analysis notes', count(*)::int from titles
        where analysis_notes is null or btrim(analysis_notes) = ''
      union all select 'titles without a release year', count(*)::int from titles where release_year is null
      union all select 'titles without a planet', count(*)::int from titles t
        where not exists (select 1 from title_planets p where p.title_id = t.id)
      union all select 'titles without a genre', count(*)::int from titles t
        where not exists (select 1 from title_genres g where g.title_id = t.id)
      union all select 'titles without credits', count(*)::int from titles t
        where not exists (select 1 from contributions c where c.title_id = t.id)
      union all select 'titles without a poster', count(*)::int from titles t
        where not exists (
          select 1 from media_asset_assignments m
          where m.title_id = t.id and m.role = 'poster' and m.is_primary)
      union all select 'installments with no score row', count(*)::int from installments i
        where not exists (select 1 from installment_scores s where s.installment_id = i.id)
      union all select 'installments scored only partly', count(*)::int from installment_scores
        where (story is null or characters is null or depth is null
               or world_building is null or originality is null or craft is null)
          and not (story is null and characters is null and depth is null
               and world_building is null and originality is null and craft is null)
      union all select 'seasons with no episodes', count(*)::int from installments i
        where i.kind = 'season' and not exists (select 1 from episodes e where e.installment_id = i.id)
      union all select 'media assets referenced by nothing', count(*)::int from media_assets a
        where not exists (select 1 from media_asset_assignments x where x.asset_id = a.id)
      order by n desc`;
    },

    async scores(sql) {
      return sql<Row[]>`
      select 'story' as criterion, round(avg(story)::numeric,2) as avg, min(story) as min, max(story) as max,
             count(story)::int as scored from installment_scores
      union all select 'characters', round(avg(characters)::numeric,2), min(characters), max(characters), count(characters)::int from installment_scores
      union all select 'depth', round(avg(depth)::numeric,2), min(depth), max(depth), count(depth)::int from installment_scores
      union all select 'world_building', round(avg(world_building)::numeric,2), min(world_building), max(world_building), count(world_building)::int from installment_scores
      union all select 'originality', round(avg(originality)::numeric,2), min(originality), max(originality), count(originality)::int from installment_scores
      union all select 'craft', round(avg(craft)::numeric,2), min(craft), max(craft), count(craft)::int from installment_scores`;
    },

    /** Highest-rated installments by the weighted editorial formula. */
    async top(sql) {
      return sql.unsafe<Row[]>(`
      select t.canonical_title, i.title as installment,
             round(${ratingExpression}::numeric, 2) as rating
      from installment_scores s
      join installments i on i.id = s.installment_id
      join titles t on t.id = i.title_id
      where s.story is not null and s.characters is not null and s.depth is not null
        and s.world_building is not null and s.originality is not null and s.craft is not null
      order by rating desc limit 25`);
    },

    async vocabulary(sql) {
      return sql<Row[]>`
      select 'genre' as kind, g.slug, g.label_en, count(tg.title_id)::int as titles
        from genres g left join title_genres tg on tg.value_id = g.id group by 1,2,3
      union all select 'tone', t.slug, t.label_en, count(tt.title_id)::int
        from tones t left join title_tones tt on tt.value_id = t.id group by 1,2,3
      union all select 'tag', g.slug, g.label_en, count(tt.title_id)::int
        from tags g left join title_tags tt on tt.value_id = g.id group by 1,2,3
      union all select 'country', c.slug, c.label_en, count(tc.title_id)::int
        from countries c left join title_countries tc on tc.value_id = c.id group by 1,2,3
      order by titles desc, kind`;
    },

    async classification(sql) {
      return sql<Row[]>`
      select audience, age, sexuality_risk, behavioral_risk, theology_risk, count(*)::int as titles
      from titles group by 1,2,3,4,5 order by titles desc`;
    },

    async planets(sql) {
      return sql<Row[]>`
      select p.slug, p.name_ar, p.name_en, count(tp.title_id)::int as titles,
             count(tp.featured_rank)::int as featured
      from planets p left join title_planets tp on tp.planet_id = p.id
      group by 1,2,3 order by titles desc`;
    },

    async awards(sql) {
      return sql<Row[]>`
      select organization_name, result, count(*)::int as n,
             count(distinct title_id)::int as titles,
             min(year) as earliest, max(year) as latest
      from award_recognitions group by 1,2 order by n desc`;
    },

    async people(sql) {
      return sql<Row[]>`
      select e.name, e.kind, r.label_en as role, count(*)::int as credits
      from contributions c
      join entities e on e.id = c.entity_id
      join roles r on r.id = c.role_id
      group by 1,2,3 order by credits desc limit 40`;
    },

    async media(sql) {
      return sql<Row[]>`
      select x.role, count(*)::int as assignments,
             count(distinct x.asset_id)::int as assets,
             pg_size_pretty(sum(a.byte_size)::bigint) as total_size
      from media_asset_assignments x join media_assets a on a.id = x.asset_id
      group by 1 order by assignments desc`;
    },
  }),
);

export const statsPresets = [...presets.keys()];

export async function statsCommand(
  sql: Sql,
  args: ParsedArgs,
  target: string | undefined,
): Promise<CommandResult> {
  const name = target ?? "overview";
  const preset = presets.get(name);
  // A preset wins unless the caller asked for a grouping, in which case they want the generic
  // aggregate over that resource (`nahhasio stats titles --by audience`).
  if (preset && listFlag(args, "by").length === 0 && listFlag(args, "metric").length === 0) {
    return preset(sql);
  }
  return genericStats(sql, args, name);
}
