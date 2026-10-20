import assert from "node:assert/strict";

import { workExport, workApply } from "../src/commands/work.ts";
import { openDatabase, closeDatabase } from "../src/db.ts";
const sql = openDatabase();
const [{ name }] = await sql`select current_database() as name`;
assert.equal(name, "nahhasio_dashboard_test");
const [{ id }] =
  await sql`select id from titles where exists(select 1 from title_trivia where title_id=titles.id) order by canonical_title limit 1`;
const original = await workExport(sql, id);
const args = {
  positionals: [],
  flags: new Map<string, string | boolean>([
    ["json", JSON.stringify(original)],
    ["mode", "merge"],
    ["dry-run", true],
  ]),
  repeated: new Map(),
};
const dry = await workApply(sql, args, undefined);
assert.equal(dry.rolledBack, true);
assert.deepEqual(await workExport(sql, id), original);
args.flags.set("dry-run", false);
await workApply(sql, args, undefined);
const first = await workExport(sql, id);
assert.deepEqual(first, original);
await workApply(sql, args, undefined);
assert.deepEqual(await workExport(sql, id), original);
console.log(
  "Whole-work dry run rolled back; repeated merges retained IDs, values and trivia without duplicates.",
);
await closeDatabase();
