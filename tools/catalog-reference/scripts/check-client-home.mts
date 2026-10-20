/** Read-only API/dashboard score parity and home-feed verification. Credentials: private stdin. */
import assert from "node:assert/strict";

import { installmentRating, workScore } from "@arcadia/domain";
import { HomeFeedSchema, LoginResponseSchema, WorkPageSchema } from "@nahhasio/api-contract";
import { z } from "zod";

import { closeDatabase, openDatabase } from "../src/db";

let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 2048) throw new Error("Credential input too large");
}
const credentials = z.object({ email: z.string(), password: z.string() }).parse(JSON.parse(input));
const base = "http://127.0.0.1:23103";
const login = await fetch(`${base}/api/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(credentials),
});
assert.equal(login.status, 200, "Owner login must work");
const session = LoginResponseSchema.parse(await login.json());
const headers = { Authorization: `Bearer ${session.token}` };
try {
  assert.equal((await fetch(`${base}/api/v1/catalog/home`)).status, 401);
  const pages = [];
  for (let page = 1; ; page++) {
    const response = await fetch(`${base}/api/v1/works?pageSize=100&page=${page}`, { headers });
    assert.equal(response.status, 200);
    const parsed = WorkPageSchema.parse(await response.json());
    pages.push(...parsed.items);
    if (page * parsed.pageSize >= parsed.total) break;
  }
  const homeResponse = await fetch(`${base}/api/v1/catalog/home`, { headers });
  assert.equal(homeResponse.status, 200);
  const home = HomeFeedSchema.parse(await homeResponse.json());
  const sql = openDatabase();
  const baseline = await sql.begin(
    "isolation level repeatable read read only",
    async (transaction) => {
      const scores = z
        .array(
          z.object({
            id: z.string(),
            title_id: z.string(),
            story: z.number().nullable(),
            characters: z.number().nullable(),
            depth: z.number().nullable(),
            worldBuilding: z.number().nullable(),
            originality: z.number().nullable(),
            craft: z.number().nullable(),
          }),
        )
        .parse(
          await transaction`select i.id,i.title_id,s.story::double precision,s.characters::double precision,s.depth::double precision,s.world_building::double precision as "worldBuilding",s.originality::double precision,s.craft::double precision from installments i join titles t on t.id=i.title_id left join installment_scores s on s.installment_id=i.id where not t.is_private order by i.title_id,i.position,i.id`,
        );
      const upcoming =
        await transaction`select i.id from installments i join titles t on t.id=i.title_id where not t.is_private and ((i.status='announced' and (i.release_date is null or i.release_date>=current_date)) or (i.status='unknown' and i.release_date>current_date)) order by i.release_date asc nulls last,t.sort_title,i.position,i.id limit 10`;
      return { scores, upcoming: upcoming.map((item) => String(item.id)) };
    },
  );
  for (const work of pages) {
    assert.equal(work.isPrivate, false);
    assert.deepEqual(
      work.score,
      workScore(baseline.scores.filter((score) => score.title_id === work.id)),
      `Dashboard parity for ${work.id}`,
    );
  }
  assert.deepEqual(
    home.upcoming.map((item) => item.id),
    baseline.upcoming,
  );
  for (const item of home.upcoming) {
    const score = baseline.scores.find((row) => row.id === item.id);
    const rating = installmentRating(score ?? {});
    assert.deepEqual(item.score, { rating, scored: rating === null ? 0 : 1, total: 1 });
  }
  assert.ok(home.comments.length <= 6 && home.upcoming.length <= 10);
  assert.ok(home.comments.every((item) => !item.work.isPrivate));
  console.log(
    `Verified ${pages.length} public work scores against the dashboard; ${home.comments.length} comments/reviews and ${home.upcoming.length} upcoming installments. No catalog writes.`,
  );
} finally {
  await closeDatabase();
  const logout = await fetch(`${base}/api/v1/auth/logout`, { method: "POST", headers });
  assert.equal(logout.status, 204);
}
