/**
 * `nahhasio help` — self-description.
 *
 * The command tree is data, not a printf block, so `--json` can hand an agent the whole
 * interface in one call and it never has to guess at a flag name.
 */

import { resources } from "../registry";
import { statsPresets } from "./stats";

export type CommandDoc = {
  usage: string;
  summary: string;
  flags?: Record<string, string>;
  examples?: string[];
};

export const globalFlags = {
  "--json": "Emit JSON instead of the default text table.",
  "--ndjson": "Emit one JSON object per line.",
  "--csv": "Emit CSV.",
  "--wide": "Do not truncate long cells in table output.",
  "--dry-run": "Show what a write would do without committing it.",
  "--yes": "Confirm a write that affects more than one row.",
  "--camel": "Return camelCase keys instead of the database's snake_case.",
} satisfies Record<string, string>;

export const commands = new Map<string, CommandDoc>(
  Object.entries<CommandDoc>({
    "<resource> list": {
      usage:
        "nahhasio <resource> list [--search TEXT] [--where EXPR]… [--columns a,b] [--limit N] [--offset N] [--order COL[ desc]] [--count] [--all-columns]",
      summary: "List rows. Shows a curated column set unless --columns or --all-columns is given.",
      flags: {
        "--where":
          "Repeatable filter: col=v, col!=v, col~substring, col>v, col<v, col:in=a,b,c, col=null.",
        "--search": "Substring match across the resource's searchable columns.",
        "--limit": "Page size 1..500, default 50; use --offset for following pages.",
        "--count": "Return only the number of matching rows.",
      },
      examples: [
        "nahhasio title list --search frieren",
        "nahhasio title list --where theology_risk:in=medium,high --where workflow_status=published --limit 20",
        "nahhasio installment list --where title_id=$(nahhasio title get Arcane --json | jq -r .id)",
        'nahhasio title list --count --where "release_year>=2020"',
      ],
    },
    "<resource> get": {
      usage: "nahhasio <resource> get <ref>",
      summary: "Fetch one row. <ref> may be a UUID, a slug, a name, or a title alias.",
      examples: ["nahhasio title get Arcane", "nahhasio planet get emerald"],
    },
    "<resource> create": {
      usage: "nahhasio <resource> create --set col=value [--set …] [--json-set col=<json>]",
      summary: "Insert a row. Foreign keys accept references, not just UUIDs.",
      examples: [
        "nahhasio person create --set name='Naoko Yamada' --set sort_name='Yamada, Naoko'",
        "nahhasio genre create --set slug=isekai --set label_en=Isekai --set label_ar=إيسيكاي",
      ],
    },
    "<resource> update": {
      usage: "nahhasio <resource> update [<ref>] --set col=value [--where EXPR]…",
      summary:
        "Update one row by reference, or every row matching --where. Never both, never neither.",
      examples: [
        "nahhasio title update Arcane --set theology_risk=high",
        'nahhasio title update --where "workflow_status=draft" --set workflow_status=published --yes',
      ],
    },
    "<resource> delete": {
      usage: "nahhasio <resource> delete [<ref>] [--where EXPR]… [--yes]",
      summary: "Delete by reference or filter. Deleting more than one row requires --yes.",
      examples: ['nahhasio alias delete --where "title_id=…" --yes'],
    },
    "work apply": {
      usage:
        "nahhasio work apply <file.json> [--mode merge|replace] [--create-missing] [--dry-run]",
      summary:
        "Reconcile a whole work — title, classification, vocabulary, credits, installments, episodes, scores, awards, media — from one JSON document, in one transaction.",
      flags: {
        "--mode":
          "merge (default) only touches what the document mentions; replace deletes anything absent.",
        "--create-missing":
          "Create referenced genres/tones/tags/entities/award orgs that do not exist yet.",
        "--json": "Pass the document inline instead of via a file.",
      },
      examples: [
        "nahhasio work template > new-work.json",
        "nahhasio work apply new-work.json --dry-run",
        "nahhasio work apply new-work.json --create-missing",
      ],
    },
    "work export": {
      usage: "nahhasio work export <ref>",
      summary: "Emit a work as an apply-compatible document. Round-trips with `work apply`.",
      examples: ["nahhasio work export Arcane --json > arcane.json"],
    },
    "work schema": {
      usage: "nahhasio work schema --json",
      summary:
        "Discover the work input JSON Schema without connecting to PostgreSQL. Database constraints and semantic validation still apply.",
    },
    health: {
      usage: "nahhasio health --json",
      summary: "Read database connectivity and catalog count without exposing credentials.",
    },
    "work template": {
      usage: "nahhasio work template",
      summary: "Print a filled-in example document to start a new work from.",
    },
    stats: {
      usage:
        "nahhasio stats [<preset>|<resource>] [--by col,col] [--metric M,…] [--where EXPR]… [--order …] [--limit N]",
      summary: `Aggregate reporting. Presets: ${statsPresets.join(", ")}. Any resource also supports a generic group-by.`,
      flags: {
        "--by": "Group by these columns.",
        "--metric": "count (default), count-distinct:col, avg:col, sum:col, min:col, max:col.",
      },
      examples: [
        "nahhasio stats coverage",
        "nahhasio stats titles --by audience,theology_risk",
        "nahhasio stats score --metric avg:story,avg:craft",
        'nahhasio stats titles --by release_year --where "release_year>=2015" --order "release_year desc"',
      ],
    },
    schema: {
      usage: "nahhasio schema [<table|resource>] [--enums] [--resources] [--search TEXT]",
      summary:
        "Describe tables, columns, types, foreign keys, and enum members from the live database.",
      examples: ["nahhasio schema", "nahhasio schema titles", "nahhasio schema --enums"],
    },
    sql: {
      usage: 'nahhasio sql "<statement>" [--write] [--dry-run] [--file query.sql]',
      summary:
        "Run raw SQL. Read-only by default, enforced by a READ ONLY transaction. --write allows mutations; --write --dry-run runs then rolls back.",
      examples: [
        'nahhasio sql "select canonical_title from titles where release_year = 2024"',
        "nahhasio sql --write --dry-run \"update titles set quality_score = 5 where id = '…'\"",
      ],
    },
    media: {
      usage:
        "nahhasio media ingest <file-or-url> --role poster|banner|logo|profile|still [--title|--installment|--episode|--entity <ref>]",
      summary:
        "Ingest an image (content-addressed, deduplicated by sha256) and optionally assign it. Also: media assign, media purge.",
      examples: [
        "nahhasio media ingest ./poster.jpg --role poster --title Arcane",
        "nahhasio media ingest https://example.com/banner.jpg --role banner --title Arcane",
        "nahhasio media purge --dry-run",
      ],
    },
    refs: {
      usage: "(concept)",
      summary:
        "Anywhere a <ref> or a foreign-key value is accepted you may pass a UUID, a slug, a name, or a title/entity alias. Resolution tries exact match first, then prefix, then substring; an ambiguous reference fails with the candidate ids listed.",
    },
  }),
);

export function helpDocument() {
  return {
    usage: "nahhasio <command> [args] [flags]",
    product: "nahhasio",
    schemaVersion: 1,
    environment: {
      actor: "NAHHASIO_CLI_ACTOR",
      artwork: "NAHHASIO_MEDIA_ROOT",
      database: "DATABASE_URL",
    },
    safety:
      "Direct PostgreSQL operator tool; not an authenticated remote API. Preserve IDs and preview writes with --dry-run.",
    globalFlags,
    commands: Object.fromEntries(commands),
    resources: resources.map((resource) => ({
      name: resource.name,
      table: resource.table,
      aliases: (resource.aliases ?? []).join(", "),
      summary: resource.summary,
    })),
    note: "Any table not in the resource list is still reachable by its real table name.",
  };
}

export function helpText(topic?: string): string {
  const doc = topic ? commands.get(topic) : undefined;
  if (doc) {
    return [
      doc.usage,
      "",
      doc.summary,
      ...(doc.flags
        ? [
            "",
            "Flags:",
            ...Object.entries(doc.flags).map(([name, text]) => `  ${name.padEnd(18)}${text}`),
          ]
        : []),
      ...(doc.examples ? ["", "Examples:", ...doc.examples.map((line) => `  ${line}`)] : []),
    ].join("\n");
  }

  const lines = [
    "nahhasio — read and edit the Nahhasio PostgreSQL catalog.",
    "",
    "Usage: nahhasio <command> [args] [flags]",
    "",
    "Commands:",
    ...[...commands.entries()].map(
      ([name, entry]) => `  ${name.padEnd(18)}${entry.summary.split(".")[0]}.`,
    ),
    "",
    "Resources:",
    `  ${resources.map((resource) => resource.name).join(", ")}`,
    "  (plus any table by its real name — see: nahhasio schema)",
    "",
    "Global flags:",
    ...Object.entries(globalFlags).map(([name, text]) => `  ${name.padEnd(14)}${text}`),
    "",
    'Detail: nahhasio help "<command>"   Full tree as JSON: nahhasio help --json',
  ];
  return lines.join("\n");
}
