/**
 * Flag parsing for the Nahhasio CLI.
 *
 * Deliberately dependency-free and permissive about ordering: agents compose these commands
 * from templates, so `--flag value`, `--flag=value`, bare booleans, `--no-flag`, and repeated
 * flags all have to work without the caller having to remember which form a given flag wants.
 */

export type FlagValue = string | boolean;

export type ParsedArgs = {
  /** Non-flag arguments, in order: typically `<group> <verb> <ref>`. */
  positionals: string[];
  /** Last-wins scalar view of the flags. */
  flags: Map<string, FlagValue>;
  /** Every occurrence of each flag, for options that legitimately repeat (`--set`, `--where`). */
  repeated: Map<string, FlagValue[]>;
};

const booleanNegationPrefix = "no-";

/**
 * Flags that never take a value.
 *
 * Without this, `nahhasio sql --write "delete from …"` parses the statement as the value of
 * `--write` and the command sees no SQL at all. Valueless flags have to be known up front
 * because "is the next token a value or a positional?" is otherwise undecidable.
 */
export const booleanFlags: ReadonlySet<string> = new Set([
  "all-columns",
  "camel",
  "count",
  "create-missing",
  "csv",
  "dry-run",
  "enums",
  "help",
  "json",
  "ndjson",
  "pretty",
  "resources",
  "wide",
  "write",
  "yes",
]);

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const repeated = new Map<string, FlagValue[]>();
  let onlyPositionals = false;

  const push = (name: string, value: FlagValue) => {
    const existing = repeated.get(name);
    if (existing) existing.push(value);
    else repeated.set(name, [value]);
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;
    if (onlyPositionals || !token.startsWith("--")) {
      if (token === "--") {
        onlyPositionals = true;
        continue;
      }
      positionals.push(token);
      continue;
    }
    if (token === "--") {
      onlyPositionals = true;
      continue;
    }

    const body = token.slice(2);
    const equals = body.indexOf("=");
    if (equals !== -1) {
      push(body.slice(0, equals), body.slice(equals + 1));
      continue;
    }
    if (body.startsWith(booleanNegationPrefix)) {
      push(body.slice(booleanNegationPrefix.length), false);
      continue;
    }
    const next = argv[index + 1];
    // A following token is this flag's value unless the flag is a known boolean or the token is
    // itself a flag. `--limit -1` still works because negative numbers do not start with `--`.
    if (!booleanFlags.has(body) && next !== undefined && !next.startsWith("--")) {
      push(body, next);
      index += 1;
      continue;
    }
    push(body, true);
  }

  const flags = new Map<string, FlagValue>();
  for (const [name, values] of repeated) {
    const last = values[values.length - 1];
    if (last !== undefined) flags.set(name, last);
  }
  return { positionals, flags, repeated };
}

/** A flag written as `--name value` carries text; a bare `--name` carries a boolean. */
function isTextFlag(value: FlagValue): value is string {
  return typeof value === "string";
}

export function stringFlag(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags.get(name);
  if (value === undefined || !isTextFlag(value)) return undefined;
  return value;
}

export function boolFlag(args: ParsedArgs, name: string): boolean {
  const value = args.flags.get(name);
  if (value === undefined) return false;
  if (!isTextFlag(value)) return value;
  return value !== "false" && value !== "0";
}

export function intFlag(args: ParsedArgs, name: string): number | undefined {
  const value = stringFlag(args, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed))
    throw new Error(`--${name} expects an integer, received "${value}"`);
  return parsed;
}

export function listFlag(args: ParsedArgs, name: string): string[] {
  const values = args.repeated.get(name) ?? [];
  return values
    .filter(isTextFlag)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/** Every occurrence of a repeatable flag, unsplit — for `--set key=value` style options. */
export function rawListFlag(args: ParsedArgs, name: string): string[] {
  return (args.repeated.get(name) ?? []).filter(isTextFlag);
}
