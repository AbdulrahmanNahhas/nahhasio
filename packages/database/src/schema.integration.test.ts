import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const connection = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { max: 1 }) : null;
const integration = connection ? describe : describe.skip;

integration("PostgreSQL v2 constraints", () => {
  it("has account-owned policy and reusable media tables", async () => {
    if (!connection) throw new Error("DATABASE_URL is required");
    const rows = await connection`select tablename from pg_tables where schemaname='public'`;
    const names = new Set(rows.map((row) => row.tablename));
    for (const name of [
      "titles",
      "installments",
      "episodes",
      "account_preferences",
      "account_admin_restrictions",
      "account_playback_states",
      "media_assets",
      "media_asset_assignments",
      "media_files",
      "media_tracks",
      "jellyfin_items",
      "award_recognitions",
    ])
      expect(names.has(name)).toBe(true);
  });

  it("enforces playback ownership and exactly one media owner", async () => {
    if (!connection) throw new Error("DATABASE_URL is required");
    const [constraint] =
      await connection`select conname from pg_constraint where conname='media_file_single_owner_check'`;
    const [assignmentConstraint] =
      await connection`select conname from pg_constraint where conname='media_assignment_one_owner_check'`;
    const [playbackConstraint] =
      await connection`select conname from pg_constraint where conname='account_playback_episode_installment_fk'`;
    expect(constraint?.conname).toBe("media_file_single_owner_check");
    expect(assignmentConstraint?.conname).toBe("media_assignment_one_owner_check");
    expect(playbackConstraint?.conname).toBe("account_playback_episode_installment_fk");
  });

  it("enforces unique episode numbers and primary media assignments", async () => {
    if (!connection) throw new Error("DATABASE_URL is required");
    const indexes = await connection`select indexname from pg_indexes where indexname in
      ('episodes_installment_number_uq', 'media_assignment_title_primary_uq', 'title_planets_featured_rank_uq')`;
    expect(new Set(indexes.map((row) => row.indexname))).toEqual(
      new Set([
        "episodes_installment_number_uq",
        "media_assignment_title_primary_uq",
        "title_planets_featured_rank_uq",
      ]),
    );
  });

  it("keeps installment awards within their owning title", async () => {
    if (!connection) throw new Error("DATABASE_URL is required");
    const [scopeConstraint] =
      await connection`select conname from pg_constraint where conname='award_recognitions_installment_title_fk'`;
    const [valueConstraint] =
      await connection`select conname from pg_constraint where conname='award_recognitions_values_check'`;
    expect(scopeConstraint?.conname).toBe("award_recognitions_installment_title_fk");
    expect(valueConstraint?.conname).toBe("award_recognitions_values_check");
  });

  it("separates person and organization contribution roles", async () => {
    if (!connection) throw new Error("DATABASE_URL is required");
    const roles = await connection`select slug, entity_kind from roles order by position`;
    expect(roles).toEqual(
      expect.arrayContaining([
        { slug: "creator", entity_kind: "person" },
        { slug: "original_author", entity_kind: "person" },
        { slug: "director", entity_kind: "person" },
        { slug: "writer", entity_kind: "person" },
        { slug: "producer", entity_kind: "person" },
        { slug: "executive_producer", entity_kind: "person" },
        { slug: "creative_producer", entity_kind: "person" },
        { slug: "character_designer", entity_kind: "person" },
        { slug: "art_director", entity_kind: "person" },
        { slug: "scene_design", entity_kind: "person" },
        { slug: "composer", entity_kind: "person" },
        { slug: "animation_studio", entity_kind: "organization" },
        { slug: "production_company", entity_kind: "organization" },
        { slug: "distributor", entity_kind: "organization" },
        { slug: "publisher", entity_kind: "organization" },
        { slug: "dubbing_studio", entity_kind: "organization" },
      ]),
    );
    const [trigger] =
      await connection`select tgname from pg_trigger where tgname='contributions_entity_kind_check' and not tgisinternal`;
    const [roleConstraint] =
      await connection`select conname from pg_constraint where conname='roles_slug_check'`;
    expect(trigger?.tgname).toBe("contributions_entity_kind_check");
    expect(roleConstraint?.conname).toBe("roles_slug_check");
  });
});

afterAll(async () => connection?.end());
