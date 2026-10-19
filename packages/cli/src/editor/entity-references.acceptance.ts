import { strict as assert } from "node:assert";
/** Explicit acceptance on a restored database. Fixtures are always rolled back. */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { adminEntityDraftSchema } from "@arcadia/contracts/editor-rpc";
import { z } from "zod";

import { openDatabase } from "../db";
import { applyEntity, snapshot } from "./entities";

const directory = process.argv[2];
if (!directory) throw new Error("Pass the private backup directory containing rehearsal.json");
const receipt = JSON.parse(await readFile(`${directory}/rehearsal.json`, "utf8"));
const name = z
  .string()
  .regex(/^nahhasio_schema_rehearsal_[0-9]+$/)
  .parse(receipt.database);
const target = new URL(process.env.DATABASE_URL ?? "postgresql://127.0.0.1:23102/arcadia");
target.pathname = `/${name}`;
process.env.DATABASE_URL = target.toString();
const sql = openDatabase();
const rollback = new Error("fixture rollback");
let checks = 0;
try {
  await sql.begin(async (tx) => {
    const [actor] = await tx<{ id: string }[]>`select id from accounts where kind='admin' limit 1`;
    assert(actor);
    const context = { accountId: actor.id, sessionKey: "unused-by-internal-reconciler" };
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const [i, id] of ids.entries())
      await tx`insert into entities(id,kind,name,sort_name) values(${id},'organization',${`Fixture ${i}`},${id})`;
    const current = await snapshot(tx, ids[0]!, "organization");
    const draft = adminEntityDraftSchema.parse({
      ...current.draft,
      urls: [{ label: "Official", url: "https://example.test/studio" }],
      relations: [
        {
          id: null,
          entityId: ids[1],
          entityName: "Fixture 1",
          direction: "outgoing",
          relationType: "subsidiary",
          occurredOn: "2020-01-02",
          description: "Owned relationship",
        },
      ],
    });
    await applyEntity(
      tx,
      { id: ids[0]!, kind: "organization", revision: current.revision, draft },
      context,
    );
    const saved = await snapshot(tx, ids[0]!, "organization");
    assert.deepEqual(saved.draft.urls, draft.urls);
    checks++;
    assert.equal(saved.draft.relations?.[0]?.occurredOn, "2020-01-02");
    checks++;
    const other = await snapshot(tx, ids[1]!, "organization");
    assert.equal(other.draft.relations?.[0]?.direction, "incoming");
    checks++;
    const legacy = {
      ...saved.draft,
      name: "Renamed fixture",
      urls: undefined,
      relations: undefined,
    };
    await applyEntity(
      tx,
      { id: ids[0]!, kind: "organization", revision: saved.revision, draft: legacy },
      context,
    );
    const preserved = await snapshot(tx, ids[0]!, "organization");
    assert.deepEqual(preserved.draft.urls, draft.urls);
    checks++;
    assert.equal(preserved.draft.relations?.length, 1);
    checks++;
    await assert.rejects(
      tx.savepoint(async (sp) =>
        applyEntity(
          sp,
          { id: ids[0]!, kind: "organization", revision: current.revision, draft },
          context,
        ),
      ),
    );
    checks++;
    for (const invalid of [
      {
        ...preserved.draft,
        relations: [
          { ...preserved.draft.relations![0]!, entityId: ids[0]!, entityName: "Renamed fixture" },
        ],
      },
      { ...preserved.draft, relations: [{ ...preserved.draft.relations![0]!, id: randomUUID() }] },
      { ...preserved.draft, urls: [...draft.urls!, ...draft.urls!] },
    ]) {
      await assert.rejects(
        tx.savepoint(async (sp) =>
          applyEntity(
            sp,
            { id: ids[0]!, kind: "organization", revision: preserved.revision, draft: invalid },
            context,
          ),
        ),
      );
      checks++;
    }
    assert.equal(
      adminEntityDraftSchema.safeParse({
        ...draft,
        urls: [{ label: "Bad", url: "javascript:alert(1)" }],
      }).success,
      false,
    );
    checks++;
    assert.equal(
      adminEntityDraftSchema.safeParse({
        ...draft,
        urls: [{ label: "Bad", url: "https://user:secret@example.test" }],
      }).success,
      false,
    );
    checks++;
    const updatedOther = await snapshot(tx, ids[1]!, "organization");
    await applyEntity(
      tx,
      {
        id: ids[1]!,
        kind: "organization",
        revision: updatedOther.revision,
        draft: { ...updatedOther.draft, relations: [] },
      },
      context,
    );
    assert.equal((await snapshot(tx, ids[0]!, "organization")).draft.relations?.length, 0);
    checks++;
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await sql.end();
}
console.log(
  `${checks} Studios persistence assertions passed on the restored database; fixtures rolled back.`,
);
