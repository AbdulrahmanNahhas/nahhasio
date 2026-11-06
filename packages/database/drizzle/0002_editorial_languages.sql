ALTER TABLE "installments" ADD COLUMN "languages" text[];--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "languages" text[] DEFAULT ARRAY['en']::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "titles_languages_idx" ON "titles" USING gin ("languages");--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_languages_check" CHECK ("installments"."languages" is null or nahhasio_language_codes_valid("installments"."languages"));--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_languages_check" CHECK (nahhasio_language_codes_valid("titles"."languages"));
--> statement-breakpoint
-- Editorial defaults only; these labels do not assert a playable audio track.
UPDATE titles t SET languages = CASE
  WHEN 'ar' = ANY(t.dub_languages) THEN ARRAY['ar']::text[]
  WHEN t.format = 'animated' AND EXISTS (
    SELECT 1 FROM title_tags tt JOIN tags tag ON tag.id = tt.value_id
    WHERE tt.title_id = t.id AND tag.slug IN ('anime-series', 'anime-movie')
  ) THEN ARRAY['en', 'ja']::text[]
  ELSE ARRAY(SELECT DISTINCT code FROM unnest(ARRAY['en']::text[] || t.dub_languages) code ORDER BY code)
END;
--> statement-breakpoint
CREATE FUNCTION nahhasio_work_languages(work_id uuid) RETURNS text[]
LANGUAGE sql STABLE AS $$
  SELECT ARRAY(SELECT DISTINCT code FROM (
    SELECT unnest(languages) code FROM titles WHERE id = work_id
    UNION ALL
    SELECT unnest(languages) code FROM installments WHERE title_id = work_id
  ) languages ORDER BY code)
$$;
