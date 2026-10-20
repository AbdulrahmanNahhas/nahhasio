import { describe, expect, it } from "vitest";

import { deriveSortTitle } from "./commands/work";
import type { TableInfo } from "./introspect";
import { CliError } from "./output";
import { buildCondition, combine, QueryBuilder, sanitizeOrderBy } from "./query";
import { coerceValue, splitAssignment } from "./values";

function captureError(run: () => void): Error {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error("expected the call to throw");
}

function hintOf(error: Error): string | undefined {
  return error instanceof CliError ? error.hint : undefined;
}

const titles: TableInfo = {
  name: "titles",
  primaryKey: ["id"],
  foreignKeys: [],
  columns: [
    {
      name: "id",
      type: "uuid",
      nullable: false,
      hasDefault: true,
      isArray: false,
      isGenerated: false,
    },
    {
      name: "canonical_title",
      type: "text",
      nullable: false,
      hasDefault: false,
      isArray: false,
      isGenerated: false,
    },
    {
      name: "release_year",
      type: "int4",
      nullable: true,
      hasDefault: false,
      isArray: false,
      isGenerated: false,
    },
    {
      name: "theology_risk",
      type: "risk_level",
      nullable: false,
      hasDefault: true,
      isArray: false,
      isGenerated: false,
      enumValues: ["none", "low", "medium", "high"],
    },
  ],
};

describe("buildCondition", () => {
  it("parameterizes equality", () => {
    const builder = new QueryBuilder();
    expect(buildCondition(builder, titles, "release_year=2024").text).toBe('"release_year" = $1');
    expect(builder.params).toEqual([2024]);
  });

  it("maps =null onto IS NULL without binding a parameter", () => {
    const builder = new QueryBuilder();
    expect(buildCondition(builder, titles, "release_year=null").text).toBe(
      '"release_year" is null',
    );
    expect(buildCondition(builder, titles, "release_year!=null").text).toBe(
      '"release_year" is not null',
    );
    expect(builder.params).toEqual([]);
  });

  it("builds IN lists", () => {
    const builder = new QueryBuilder();
    expect(buildCondition(builder, titles, "theology_risk:in=medium,high").text).toBe(
      '"theology_risk" in ($1, $2)',
    );
    expect(builder.params).toEqual(["medium", "high"]);
  });

  it("casts non-text columns for substring search", () => {
    const builder = new QueryBuilder();
    expect(buildCondition(builder, titles, "release_year~199").text).toBe(
      '"release_year"::text ilike $1',
    );
    expect(builder.params).toEqual(["%199%"]);
  });

  it("rejects an unknown column with a suggestion", () => {
    expect(() => buildCondition(new QueryBuilder(), titles, "relase_year=2024")).toThrow(
      /no column "relase_year"/,
    );
  });

  it("rejects an enum value outside the column's members and lists them in the hint", () => {
    const failure = captureError(() =>
      buildCondition(new QueryBuilder(), titles, "theology_risk=extreme"),
    );
    expect(failure).toBeInstanceOf(CliError);
    expect(failure.message).toMatch(/rejects "extreme"/);
    expect(hintOf(failure)).toBe("Allowed values: none, low, medium, high");
  });

  it("rejects an unparseable filter", () => {
    expect(() => buildCondition(new QueryBuilder(), titles, "nonsense")).toThrow(
      /Could not parse filter/,
    );
  });
});

describe("combine", () => {
  it("omits the WHERE keyword when there are no conditions", () => {
    expect(combine([])).toBe("");
    expect(combine([{ text: "a" }, { text: "b" }])).toBe("where a and b");
  });
});

describe("sanitizeOrderBy", () => {
  it("accepts direction and null placement", () => {
    expect(sanitizeOrderBy(titles, "release_year desc nulls last")).toBe(
      '"release_year" desc nulls last',
    );
  });

  it("refuses anything that is not a plain sort segment", () => {
    expect(() => sanitizeOrderBy(titles, "release_year; drop table titles")).toThrow(
      /Cannot sort by/,
    );
  });
});

describe("coerceValue", () => {
  const yearColumn = titles.columns[2];
  if (!yearColumn) throw new Error("fixture missing release_year");

  it("parses integers", () => {
    expect(coerceValue(yearColumn, "2024")).toBe(2024);
  });

  it("rejects a non-integer", () => {
    expect(() => coerceValue(yearColumn, "20x4")).toThrow(/is an integer/);
  });

  it("maps the null literal to SQL NULL for a nullable column", () => {
    expect(coerceValue(yearColumn, "null")).toBeNull();
  });

  it("refuses to null a NOT NULL column", () => {
    const titleColumn = titles.columns[1];
    if (!titleColumn) throw new Error("fixture missing canonical_title");
    expect(() => coerceValue(titleColumn, "null")).toThrow(/NOT NULL/);
  });
});

describe("splitAssignment", () => {
  it("splits on the first equals only", () => {
    expect(splitAssignment("summary=a=b")).toEqual({ key: "summary", value: "a=b" });
  });

  it("rejects a value with no equals", () => {
    expect(() => splitAssignment("summary")).toThrow(/Expected key=value/);
  });
});

describe("deriveSortTitle", () => {
  it("lowercases and keeps leading articles, matching the existing catalog", () => {
    expect(deriveSortTitle("The Boy and the Heron")).toBe("the boy and the heron");
    expect(deriveSortTitle("Arcane")).toBe("arcane");
  });
});
