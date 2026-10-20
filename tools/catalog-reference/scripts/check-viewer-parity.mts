/** Read-only viewer integration. Credentials arrive on private stdin; no catalog writes. */
import assert from "node:assert/strict";

import { ApiClient, LoginResponseSchema } from "@nahhasio/api-contract";
import { z } from "zod";

import { openDatabase, closeDatabase } from "../src/db";
const filter = (include: string[], exclude: string[]) =>
  JSON.stringify({
    facets: [{ key: "genres", include, exclude }],
    minimumRating: 0,
    minimumScores: {},
  });

let raw = "";
for await (const chunk of process.stdin) {
  raw += chunk;
  if (raw.length > 2048) throw new Error("Input too large");
}
const credentials = z.object({ email: z.string(), password: z.string() }).parse(JSON.parse(raw));
const origin = "http://127.0.0.1:23103";
const response = await fetch(`${origin}/api/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(credentials),
});
assert.equal(response.status, 200);
const session = LoginResponseSchema.parse(await response.json());
const api = new ApiClient(origin, () => session.token);
try {
  for (const path of ["browse", "facets", "recommendations"]) {
    assert.equal((await fetch(`${origin}/api/v1/catalog/${path}`)).status, 401);
  }
  const works = await api.browseCatalog({ view: "works", pageSize: 30 });
  const units = await api.browseCatalog({ view: "installments", pageSize: 30 });
  assert.ok(works.items.every((e) => !e.work.isPrivate && e.installment === null));
  assert.ok(units.items.every((e) => !e.work.isPrivate && e.installment !== null));
  const sql = openDatabase();
  const [counts] =
    await sql`select (select count(*)::integer from titles where not is_private) works,(select count(*)::integer from installments i join titles t on t.id=i.title_id where not t.is_private) units,(select count(*)::integer from titles where is_private) private`;
  assert.equal(works.total, counts.works);
  assert.equal(units.total, counts.units);
  const privatePage = await api.browseCatalog({ privacy: "private" });
  assert.equal(privatePage.total, counts.private);
  assert.ok(privatePage.items.every((e) => e.work.isPrivate));
  const facets = await api.getCatalogFacets({ view: "works" });
  const genre = facets.groups.find((g) => g.key === "genres")?.options[0];
  assert.ok(genre);
  const included = await api.browseCatalog({ filters: filter([genre.value], []) });
  assert.equal(included.total, genre.count);
  const excluded = await api.browseCatalog({ filters: filter([], [genre.value]) });
  assert.equal(excluded.total, works.total - genre.count);
  const score = await api.browseCatalog({
    filters: JSON.stringify({ minimumRating: 8.5 }),
    sort: "score-desc",
  });
  assert.ok(score.items.every((e) => (e.work.score.rating ?? 0) >= 8.5));
  const recs = await api.getRecommendations({ workId: works.items[0].work.id });
  assert.equal(recs.basis, "related");
  assert.ok(recs.items.every((w) => !w.isPrivate && w.id !== works.items[0].work.id));
  const headers = { Authorization: `Bearer ${session.token}` };
  for (const query of [
    "pageSize=101",
    "sort=bad",
    "view=bad",
    `filters=${encodeURIComponent(JSON.stringify({ facets: [{ key: "injected", include: ["x"], exclude: [] }] }))}`,
  ])
    assert.equal(
      (await fetch(`${origin}/api/v1/catalog/browse?${query}`, { headers })).status,
      400,
    );
  console.log(
    `Viewer API verified: ${works.total} public works, ${units.total} installments, ${facets.groups.length} facet groups; include/exclude, scores, private opt-in, recommendations and authorization passed. No catalog writes.`,
  );
} finally {
  await closeDatabase();
  await api.logout();
}
