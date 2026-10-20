import { describe, expect, it } from "vitest";

import { boolFlag, intFlag, listFlag, parseArgs, rawListFlag, stringFlag } from "./args";

describe("parseArgs", () => {
  it("separates positionals from flags", () => {
    const args = parseArgs(["title", "get", "Arcane", "--json"]);
    expect(args.positionals).toEqual(["title", "get", "Arcane"]);
    expect(boolFlag(args, "json")).toBe(true);
  });

  it("accepts both --flag value and --flag=value", () => {
    expect(stringFlag(parseArgs(["--limit", "10"]), "limit")).toBe("10");
    expect(stringFlag(parseArgs(["--limit=10"]), "limit")).toBe("10");
  });

  it("does not let a boolean flag swallow the next token", () => {
    // Regression: `sql --write "delete …"` used to parse the statement as --write's value.
    const args = parseArgs(["sql", "--write", "delete from titles"]);
    expect(boolFlag(args, "write")).toBe(true);
    expect(args.positionals).toEqual(["sql", "delete from titles"]);
  });

  it("collects repeated flags", () => {
    const args = parseArgs(["--where", "a=1", "--where", "b=2"]);
    expect(rawListFlag(args, "where")).toEqual(["a=1", "b=2"]);
  });

  it("splits comma lists but keeps raw values intact", () => {
    const args = parseArgs(["--columns", "id,name", "--set", "summary=a,b"]);
    expect(listFlag(args, "columns")).toEqual(["id", "name"]);
    expect(rawListFlag(args, "set")).toEqual(["summary=a,b"]);
  });

  it("supports --no-flag negation", () => {
    expect(boolFlag(parseArgs(["--no-camel"]), "camel")).toBe(false);
  });

  it("treats a trailing flag with no value as true", () => {
    expect(boolFlag(parseArgs(["--dry-run"]), "dry-run")).toBe(true);
  });

  it("accepts negative integers as values", () => {
    expect(intFlag(parseArgs(["--limit", "-1"]), "limit")).toBe(-1);
  });

  it("rejects a non-integer where an integer is required", () => {
    expect(() => intFlag(parseArgs(["--limit", "abc"]), "limit")).toThrow(/expects an integer/);
  });
});
