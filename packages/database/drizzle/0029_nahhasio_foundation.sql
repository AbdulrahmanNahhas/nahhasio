-- Nahhasio foundation. Replaces ONLY the never-applied TVDB removal proposal.
-- Existing TVDB columns/indexes and every catalog UUID remain intact.
-- Applied migrations 0000..0028 are unchanged. This file is explicit maintenance, never startup SQL.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
SET LOCAL statement_timeout = '60s';
--> statement-breakpoint
CREATE FUNCTION nahhasio_language_codes_valid(values_to_check text[])
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT values_to_check IS NOT NULL
    AND cardinality(values_to_check) = (SELECT count(DISTINCT value) FROM unnest(values_to_check) value)
    AND NOT EXISTS (SELECT 1 FROM unnest(values_to_check) value
      WHERE value IS NULL OR value !~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$');
$$;
--> statement-breakpoint
ALTER TABLE "award_categories" ADD CONSTRAINT "award_categories_id_organization_uq" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "award_ceremonies" ADD CONSTRAINT "award_ceremonies_id_organization_uq" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "title_comments" ADD CONSTRAINT "title_comments_id_title_uq" UNIQUE("id","title_id");--> statement-breakpoint
ALTER TYPE "public"."media_asset_role" ADD VALUE 'still';--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"platform" text DEFAULT 'unknown' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_installation_id_unique" UNIQUE("installation_id"),
	CONSTRAINT "devices_installation_id_check" CHECK (char_length(btrim("devices"."installation_id")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "library_roots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"is_read_only" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_scanned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_roots_path_unique" UNIQUE("path"),
	CONSTRAINT "library_roots_values_check" CHECK (btrim("library_roots"."name") <> '' and "library_roots"."path" like '/%' and "library_roots"."path" !~ '(^|/)\.\.(/|$)')
);
--> statement-breakpoint
CREATE TABLE "server_instance" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT 'مكتبة العائلة' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "server_instance_id_uq" UNIQUE("id"),
	CONSTRAINT "server_instance_singleton_check" CHECK ("server_instance"."singleton")
);
--> statement-breakpoint
CREATE TABLE "title_trailers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_id" uuid NOT NULL,
	"youtube_video_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"language" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "title_trailers_video_uq" UNIQUE("title_id","youtube_video_id"),
	CONSTRAINT "title_trailers_values_check" CHECK ("title_trailers"."youtube_video_id" ~ '^[A-Za-z0-9_-]{11}$' and "title_trailers"."position" >= 0 and ("title_trailers"."language" is null or nahhasio_language_codes_valid(ARRAY["title_trailers"."language"])))
);
--> statement-breakpoint
ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_mime_check";--> statement-breakpoint
ALTER TABLE "roles" DROP CONSTRAINT "roles_typed_slug_check";--> statement-breakpoint
DROP INDEX "external_identity_provider_uq";--> statement-breakpoint
DROP INDEX "media_assignment_identity_uq";--> statement-breakpoint
ALTER TABLE "account_preferences" ALTER COLUMN "preferred_audio" SET DEFAULT ARRAY['en','ar','es']::text[];--> statement-breakpoint
ALTER TABLE "account_preferences" ALTER COLUMN "allowed_audio" SET DEFAULT ARRAY['ar','en','es']::text[];--> statement-breakpoint
ALTER TABLE "media_tracks" ALTER COLUMN "stream_index" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "title_reviews" ALTER COLUMN "rating" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "account_playback_states" ADD COLUMN "revision" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "account_playback_states" ADD COLUMN "last_device_id" uuid;--> statement-breakpoint
ALTER TABLE "account_preferences" ADD COLUMN "preferred_subtitles" text[] DEFAULT ARRAY['ar']::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD COLUMN "max_attempts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD COLUMN "run_after" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD COLUMN "lease_owner" text;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD COLUMN "heartbeat_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD COLUMN "cancel_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "contributions" ADD COLUMN "languages" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "library_root_id" uuid;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "relative_path" text;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "byte_size" bigint;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "sha256" text;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "modified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "availability" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "probe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "media_tracks" ADD COLUMN "source" text DEFAULT 'embedded' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_tracks" ADD COLUMN "relative_path" text;--> statement-breakpoint
ALTER TABLE "media_tracks" ADD COLUMN "sha256" text;--> statement-breakpoint
ALTER TABLE "media_tracks" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "media_tracks" ADD COLUMN "provider_id" text;--> statement-breakpoint
ALTER TABLE "media_tracks" ADD COLUMN "is_hearing_impaired" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "device_id" uuid;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "playback_policy" text DEFAULT 'torrents-allowed' NOT NULL;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "dub_languages" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "dubbing_notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "title_trailers" ADD CONSTRAINT "title_trailers_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "title_trailers_primary_uq" ON "title_trailers" USING btree ("title_id") WHERE "title_trailers"."is_primary";--> statement-breakpoint
CREATE INDEX "title_trailers_order_idx" ON "title_trailers" USING btree ("title_id","position","id");--> statement-breakpoint
INSERT INTO devices(installation_id,name,platform)
SELECT device_id,max(device_name),'legacy-linux' FROM account_downloads GROUP BY device_id;
--> statement-breakpoint
ALTER TABLE "account_downloads" ADD CONSTRAINT "account_downloads_device_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("installation_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_downloads" ADD CONSTRAINT "account_downloads_episode_installment_fk" FOREIGN KEY ("episode_id","installment_id") REFERENCES "public"."episodes"("id","installment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_playback_states" ADD CONSTRAINT "account_playback_states_last_device_id_devices_id_fk" FOREIGN KEY ("last_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_recognitions" ADD CONSTRAINT "award_recognitions_category_organization_fk" FOREIGN KEY ("category_id","organization_id") REFERENCES "public"."award_categories"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_recognitions" ADD CONSTRAINT "award_recognitions_ceremony_organization_fk" FOREIGN KEY ("ceremony_id","organization_id") REFERENCES "public"."award_ceremonies"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_variant_of_asset_id_media_assets_id_fk" FOREIGN KEY ("variant_of_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_library_root_id_library_roots_id_fk" FOREIGN KEY ("library_root_id") REFERENCES "public"."library_roots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_comments" ADD CONSTRAINT "title_comments_parent_title_fk" FOREIGN KEY ("parent_id","title_id") REFERENCES "public"."title_comments"("id","title_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "background_jobs_idempotency_uq" ON "background_jobs" USING btree (coalesce("created_by_account_id", '00000000-0000-0000-0000-000000000000'::uuid),"type","idempotency_key") WHERE "background_jobs"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "background_jobs_queue_idx" ON "background_jobs" USING btree ("status","run_after","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_files_root_path_uq" ON "media_files" USING btree ("library_root_id","relative_path") WHERE "media_files"."library_root_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "media_tracks_sidecar_uq" ON "media_tracks" USING btree ("media_file_id","relative_path") WHERE "media_tracks"."source"='external';--> statement-breakpoint
CREATE INDEX "titles_visibility_sort_idx" ON "titles" USING btree ("workflow_status","is_private","sort_title","id");--> statement-breakpoint
CREATE INDEX "titles_dub_languages_idx" ON "titles" USING gin ("dub_languages");--> statement-breakpoint
CREATE UNIQUE INDEX "external_identity_provider_uq" ON "external_identities" USING btree (coalesce("title_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("installment_id", '00000000-0000-0000-0000-000000000000'::uuid),lower(btrim("provider")),"external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assignment_identity_uq" ON "media_asset_assignments" USING btree ("asset_id","role",coalesce("title_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("installment_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("episode_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("entity_id", '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
ALTER TABLE "title_planets" ADD CONSTRAINT "title_planets_single_planet_uq" UNIQUE("title_id");--> statement-breakpoint
ALTER TABLE "account_downloads" ADD CONSTRAINT "account_downloads_size_check" CHECK ("account_downloads"."size_bytes" >= 0);--> statement-breakpoint
ALTER TABLE "account_playback_states" ADD CONSTRAINT "playback_revision_check" CHECK ("account_playback_states"."revision" >= 0);--> statement-breakpoint
ALTER TABLE "award_recognitions" ADD CONSTRAINT "award_recognitions_owner_check" CHECK (("award_recognitions"."category_id" is null and "award_recognitions"."ceremony_id" is null) or "award_recognitions"."organization_id" is not null);--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_attempts_check" CHECK ("background_jobs"."attempts" >= 0 and "background_jobs"."max_attempts" between 1 and 100 and "background_jobs"."attempts" <= "background_jobs"."max_attempts");--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_lease_check" CHECK (("background_jobs"."lease_owner" is null) = ("background_jobs"."lease_expires_at" is null));--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_languages_check" CHECK (nahhasio_language_codes_valid("contributions"."languages"));--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_variant_self_check" CHECK ("media_assets"."variant_of_asset_id" is null or "media_assets"."variant_of_asset_id" <> "media_assets"."id");--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_mime_check" CHECK ("media_assets"."mime_type" in ('image/jpeg','image/png','image/webp','image/gif','image/avif'));--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_location_check" CHECK (("media_files"."library_root_id" is null and "media_files"."relative_path" is null) or ("media_files"."library_root_id" is not null and "media_files"."relative_path" is not null and "media_files"."relative_path" <> '' and "media_files"."relative_path" not like '/%' and "media_files"."relative_path" !~ '(^|/)\.\.(/|$)'));--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_values_check" CHECK (("media_files"."byte_size" is null or "media_files"."byte_size" >= 0) and ("media_files"."sha256" is null or "media_files"."sha256" ~ '^[0-9a-f]{64}$') and "media_files"."availability" in ('unknown','present','missing','unreadable') and jsonb_typeof("media_files"."probe_metadata")='object');--> statement-breakpoint
ALTER TABLE "media_tracks" ADD CONSTRAINT "media_tracks_source_check" CHECK (("media_tracks"."source"='embedded' and "media_tracks"."stream_index" is not null and "media_tracks"."relative_path" is null) or ("media_tracks"."source"='external' and "media_tracks"."kind"='subtitle' and "media_tracks"."stream_index" is null and "media_tracks"."relative_path" is not null and "media_tracks"."relative_path" <> '' and "media_tracks"."relative_path" not like '/%' and "media_tracks"."relative_path" !~ '(^|/)\.\.(/|$)'));--> statement-breakpoint
ALTER TABLE "media_tracks" ADD CONSTRAINT "media_tracks_hash_check" CHECK ("media_tracks"."sha256" is null or "media_tracks"."sha256" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_slug_check" CHECK ("roles"."slug" ~ '^[a-z][a-z0-9_]{0,79}$' and btrim("roles"."label_en") <> '' and btrim("roles"."label_ar") <> '');--> statement-breakpoint
ALTER TABLE "title_comments" ADD CONSTRAINT "title_comments_parent_self_check" CHECK ("title_comments"."parent_id" is null or "title_comments"."parent_id" <> "title_comments"."id");--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_playback_policy_check" CHECK ("titles"."playback_policy" in ('torrents-allowed','files-only'));--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_dub_languages_check" CHECK (nahhasio_language_codes_valid("titles"."dub_languages"));
--> statement-breakpoint
INSERT INTO server_instance(singleton) VALUES(true);
--> statement-breakpoint
INSERT INTO roles(slug,label_en,label_ar,entity_kind,position,is_active)
SELECT 'dubbing_studio','Dubbing studio','استوديو الدبلجة','organization',coalesce(max(position),0)+1,true FROM roles;
--> statement-breakpoint
-- Increment revisions in the database so legacy writers cannot bypass conflict detection.
CREATE FUNCTION nahhasio_playback_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER account_playback_revision BEFORE UPDATE ON account_playback_states
FOR EACH ROW EXECUTE FUNCTION nahhasio_playback_revision();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_contribution_entity_kind() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM entities e JOIN roles r ON r.id=NEW.role_id
    WHERE e.id=NEW.entity_id AND e.kind=r.entity_kind FOR SHARE OF e,r) THEN
    RAISE EXCEPTION 'Contribution role and entity type must match' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
-- Changing the kind of an already credited role/entity must preserve the graph as well.
CREATE FUNCTION nahhasio_credit_kind_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='roles' THEN
    IF EXISTS(SELECT 1 FROM contributions c JOIN entities e ON e.id=c.entity_id WHERE c.role_id=NEW.id AND e.kind<>NEW.entity_kind) THEN
      RAISE EXCEPTION 'Existing credits do not match the new role kind' USING ERRCODE='23514';
    END IF;
  ELSE
    IF EXISTS(SELECT 1 FROM contributions c JOIN roles r ON r.id=c.role_id WHERE c.entity_id=NEW.id AND r.entity_kind<>NEW.kind) THEN
      RAISE EXCEPTION 'Existing credits do not match the new entity kind' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER roles_credit_kind_update BEFORE UPDATE OF entity_kind ON roles
FOR EACH ROW EXECUTE FUNCTION nahhasio_credit_kind_update();
--> statement-breakpoint
CREATE TRIGGER entities_credit_kind_update BEFORE UPDATE OF kind ON entities
FOR EACH ROW EXECUTE FUNCTION nahhasio_credit_kind_update();
--> statement-breakpoint
-- Do not silently resolve a disagreement between two historically independent rating fields.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM title_reviews r JOIN account_title_states s USING(account_id,title_id)
    WHERE r.rating IS NOT NULL AND s.personal_rating IS NOT NULL AND r.rating<>s.personal_rating) THEN
    RAISE EXCEPTION 'Review/personal rating conflicts require explicit reconciliation';
  END IF;
END $$;
--> statement-breakpoint
INSERT INTO account_title_states(account_id,title_id,personal_rating)
SELECT account_id,title_id,rating FROM title_reviews WHERE rating IS NOT NULL
ON CONFLICT(account_id,title_id) DO UPDATE SET personal_rating=excluded.personal_rating
WHERE account_title_states.personal_rating IS NULL;
--> statement-breakpoint
CREATE FUNCTION nahhasio_review_rating_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO account_title_states(account_id,title_id,personal_rating)
  VALUES(NEW.account_id,NEW.title_id,NEW.rating)
  ON CONFLICT(account_id,title_id) DO UPDATE SET personal_rating=excluded.personal_rating,updated_at=now()
  WHERE account_title_states.personal_rating IS DISTINCT FROM excluded.personal_rating;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE FUNCTION nahhasio_personal_rating_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE title_reviews SET rating=NEW.personal_rating
  WHERE account_id=NEW.account_id AND title_id=NEW.title_id AND rating IS DISTINCT FROM NEW.personal_rating;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER title_reviews_rating_write AFTER INSERT OR UPDATE OF rating ON title_reviews
FOR EACH ROW EXECUTE FUNCTION nahhasio_review_rating_write();
--> statement-breakpoint
CREATE TRIGGER account_title_rating_projection AFTER INSERT OR UPDATE OF personal_rating ON account_title_states
FOR EACH ROW EXECUTE FUNCTION nahhasio_personal_rating_projection();
