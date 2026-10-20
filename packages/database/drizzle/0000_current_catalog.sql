-- Current-catalog baseline, captured 2026-10-20 from the preserved database.
-- No family catalog, accounts, artwork paths or viewing data are embedded here.
-- Existing databases adopt only its ledger entry after backup and restored comparison.
-- Minimum PostgreSQL major version: 17. Future changes are additive migrations.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';
SET LOCAL check_function_bodies = false;
SET LOCAL standard_conforming_strings = on;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
--> statement-breakpoint
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: account_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_kind AS ENUM (
    'admin',
    'family',
    'personal'
);


--
-- Name: account_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_status AS ENUM (
    'invited',
    'active',
    'suspended'
);


--
-- Name: age_rating; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.age_rating AS ENUM (
    'all',
    '7+',
    '10+',
    '13+',
    '16+',
    '18+'
);


--
-- Name: audience; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audience AS ENUM (
    'general',
    'teen',
    'young-adult',
    'adult'
);


--
-- Name: award_result; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.award_result AS ENUM (
    'winner',
    'nominee'
);


--
-- Name: background_job_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.background_job_status AS ENUM (
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: collection_visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.collection_visibility AS ENUM (
    'private',
    'family'
);


--
-- Name: entity_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.entity_kind AS ENUM (
    'person',
    'organization'
);


--
-- Name: installment_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.installment_kind AS ENUM (
    'season',
    'movie',
    'special'
);


--
-- Name: media_asset_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.media_asset_role AS ENUM (
    'poster',
    'banner',
    'logo',
    'profile',
    'still'
);


--
-- Name: moderation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.moderation_status AS ENUM (
    'published',
    'hidden'
);


--
-- Name: notification_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_kind AS ENUM (
    'reply',
    'reaction',
    'review',
    'catalog',
    'system'
);


--
-- Name: recommendation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recommendation_status AS ENUM (
    'pending',
    'accepted',
    'deferred',
    'dismissed'
);


--
-- Name: release_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.release_status AS ENUM (
    'announced',
    'airing',
    'completed',
    'unknown'
);


--
-- Name: risk_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.risk_level AS ENUM (
    'none',
    'low',
    'medium',
    'high'
);


--
-- Name: title_format; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.title_format AS ENUM (
    'animated',
    'live-action'
);


--
-- Name: title_relation_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.title_relation_kind AS ENUM (
    'sequel',
    'adaptation',
    'spin-off',
    'side-story',
    'compilation',
    'alternative',
    'related'
);


--
-- Name: track_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.track_kind AS ENUM (
    'video',
    'audio',
    'subtitle'
);


--
-- Name: workflow_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workflow_status AS ENUM (
    'draft',
    'in_review',
    'approved',
    'published',
    'archived'
);


--
-- Name: enforce_contribution_entity_kind(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_contribution_entity_kind() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM entities e JOIN roles r ON r.id=NEW.role_id
    WHERE e.id=NEW.entity_id AND e.kind=r.entity_kind FOR SHARE OF e,r) THEN
    RAISE EXCEPTION 'Contribution role and entity type must match' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: nahhasio_credit_kind_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.nahhasio_credit_kind_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: nahhasio_language_codes_valid(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.nahhasio_language_codes_valid(values_to_check text[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $_$
  SELECT values_to_check IS NOT NULL
    AND cardinality(values_to_check) = (SELECT count(DISTINCT value) FROM unnest(values_to_check) value)
    AND NOT EXISTS (SELECT 1 FROM unnest(values_to_check) value
      WHERE value IS NULL OR value !~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$');
$_$;


--
-- Name: nahhasio_personal_rating_projection(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.nahhasio_personal_rating_projection() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE title_reviews SET rating=NEW.personal_rating
  WHERE account_id=NEW.account_id AND title_id=NEW.title_id AND rating IS DISTINCT FROM NEW.personal_rating;
  RETURN NEW;
END $$;


--
-- Name: nahhasio_playback_revision(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.nahhasio_playback_revision() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END $$;


--
-- Name: nahhasio_review_rating_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.nahhasio_review_rating_write() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO account_title_states(account_id,title_id,personal_rating)
  VALUES(NEW.account_id,NEW.title_id,NEW.rating)
  ON CONFLICT(account_id,title_id) DO UPDATE SET personal_rating=excluded.personal_rating,updated_at=now()
  WHERE account_title_states.personal_rating IS DISTINCT FROM excluded.personal_rating;
  RETURN NEW;
END $$;




--
-- Name: account_admin_restrictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_admin_restrictions (
    account_id uuid NOT NULL,
    audience public.audience DEFAULT 'general'::public.audience NOT NULL,
    age public.age_rating DEFAULT 'all'::public.age_rating NOT NULL,
    sexuality_risk public.risk_level DEFAULT 'none'::public.risk_level NOT NULL,
    behavioral_risk public.risk_level DEFAULT 'none'::public.risk_level NOT NULL,
    theology_risk public.risk_level DEFAULT 'none'::public.risk_level NOT NULL,
    notes text DEFAULT ''::text NOT NULL
);


--
-- Name: account_capabilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_capabilities (
    account_id uuid NOT NULL,
    capability text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_capabilities_value_check CHECK ((capability = ANY (ARRAY['catalog.view'::text, 'catalog.edit'::text, 'people.edit'::text, 'studios.edit'::text, 'awards.edit'::text, 'accounts.manage'::text, 'policies.manage'::text, 'social.moderate'::text, 'media.manage'::text, 'analytics.view'::text])))
);


--
-- Name: account_content_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_content_policies (
    account_id uuid NOT NULL,
    audience public.audience DEFAULT 'general'::public.audience NOT NULL,
    age public.age_rating DEFAULT 'all'::public.age_rating NOT NULL,
    sexuality_risk public.risk_level DEFAULT 'none'::public.risk_level NOT NULL,
    behavioral_risk public.risk_level DEFAULT 'none'::public.risk_level NOT NULL,
    theology_risk public.risk_level DEFAULT 'none'::public.risk_level NOT NULL,
    inclusion_filter jsonb
);


--
-- Name: account_downloads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_downloads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    installment_id uuid NOT NULL,
    episode_id uuid,
    device_id text NOT NULL,
    device_name text DEFAULT ''::text NOT NULL,
    path text NOT NULL,
    size_bytes bigint DEFAULT 0 NOT NULL,
    state text DEFAULT 'completed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_downloads_size_check CHECK ((size_bytes >= 0)),
    CONSTRAINT account_downloads_state_check CHECK ((state = ANY (ARRAY['queued'::text, 'downloading'::text, 'paused'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: account_entity_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_entity_blocks (
    account_id uuid NOT NULL,
    entity_id uuid NOT NULL
);


--
-- Name: account_genre_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_genre_blocks (
    account_id uuid NOT NULL,
    genre_id uuid NOT NULL
);


--
-- Name: account_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token_hash text NOT NULL,
    display_name text NOT NULL,
    username text NOT NULL,
    kind public.account_kind NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    avatar_key text DEFAULT 'avatar-1.png'::text NOT NULL,
    capabilities text[] DEFAULT ARRAY[]::text[] NOT NULL,
    created_by_account_id uuid NOT NULL,
    accepted_by_account_id uuid,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_invites_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'editor'::text, 'member'::text])))
);


--
-- Name: account_planet_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_planet_blocks (
    account_id uuid NOT NULL,
    planet_id uuid NOT NULL
);


--
-- Name: account_playback_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_playback_states (
    account_id uuid NOT NULL,
    installment_id uuid NOT NULL,
    episode_id uuid,
    position_seconds integer DEFAULT 0 NOT NULL,
    is_played boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    duration_seconds integer,
    played_manually boolean DEFAULT false NOT NULL,
    played_at timestamp with time zone,
    subtitle_offset_ms integer,
    revision bigint DEFAULT 0 NOT NULL,
    last_device_id uuid,
    CONSTRAINT playback_position_check CHECK (((position_seconds >= 0) AND ((duration_seconds IS NULL) OR (duration_seconds >= 0)))),
    CONSTRAINT playback_revision_check CHECK ((revision >= 0))
);


--
-- Name: account_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_preferences (
    account_id uuid NOT NULL,
    locale text DEFAULT 'ar'::text NOT NULL,
    theme text DEFAULT 'dark'::text NOT NULL,
    preferred_audio text[] DEFAULT ARRAY['en'::text, 'ar'::text, 'es'::text] NOT NULL,
    allowed_audio text[] DEFAULT ARRAY['ar'::text, 'en'::text, 'es'::text] NOT NULL,
    subtitle_mode text DEFAULT 'allowed'::text NOT NULL,
    can_switch_tracks boolean DEFAULT true NOT NULL,
    autoplay boolean DEFAULT false NOT NULL,
    hide_spoilers boolean DEFAULT true NOT NULL,
    notify_family_activity boolean DEFAULT true NOT NULL,
    notify_replies boolean DEFAULT true NOT NULL,
    spoiler_mode text DEFAULT 'cover'::text NOT NULL,
    default_saved_view_id uuid,
    home_layout jsonb DEFAULT '{}'::jsonb NOT NULL,
    dashboard_layout jsonb DEFAULT '{}'::jsonb NOT NULL,
    visible_title_kinds text[] DEFAULT ARRAY['animated-movie'::text, 'animated-series'::text, 'live-action-movie'::text, 'live-action-series'::text] NOT NULL,
    preferred_subtitles text[] DEFAULT ARRAY['ar'::text] NOT NULL,
    CONSTRAINT account_preferences_visible_title_kinds_check CHECK (((array_length(visible_title_kinds, 1) >= 1) AND (visible_title_kinds <@ ARRAY['animated-movie'::text, 'animated-series'::text, 'live-action-movie'::text, 'live-action-series'::text])))
);


--
-- Name: account_tag_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_tag_blocks (
    account_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: account_title_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_title_blocks (
    account_id uuid NOT NULL,
    title_id uuid NOT NULL
);


--
-- Name: account_title_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_title_states (
    account_id uuid NOT NULL,
    title_id uuid NOT NULL,
    is_favorite boolean DEFAULT false NOT NULL,
    personal_rating integer,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    saved_offline boolean DEFAULT false NOT NULL,
    CONSTRAINT account_title_states_rating_check CHECK (((personal_rating IS NULL) OR ((personal_rating >= 1) AND (personal_rating <= 5))))
);


--
-- Name: account_view_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_view_history (
    account_id uuid NOT NULL,
    title_id uuid NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    visit_count integer DEFAULT 1 NOT NULL,
    CONSTRAINT account_view_history_count_check CHECK ((visit_count > 0))
);


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind public.account_kind NOT NULL,
    display_name text NOT NULL,
    invited_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    auth_user_id text,
    status public.account_status DEFAULT 'invited'::public.account_status NOT NULL,
    slug text,
    avatar_key text DEFAULT 'avatar-1.png'::text NOT NULL,
    bio text DEFAULT ''::text NOT NULL,
    is_discoverable boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_account_id uuid,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text,
    summary text DEFAULT ''::text NOT NULL,
    changes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_accounts (
    id text NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id text NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp with time zone,
    refresh_token_expires_at timestamp with time zone,
    scope text,
    password text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_sessions (
    id text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    token text NOT NULL,
    ip_address text,
    user_agent text,
    user_id text NOT NULL,
    impersonated_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    device_id uuid
);


--
-- Name: auth_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_users (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    image text,
    username text,
    display_username text,
    role text DEFAULT 'member'::text NOT NULL,
    banned boolean DEFAULT false NOT NULL,
    ban_reason text,
    ban_expires timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_verifications (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: award_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.award_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    slug text NOT NULL,
    name_ar text NOT NULL,
    name_en text,
    description text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT award_categories_values_check CHECK (((btrim(slug) <> ''::text) AND (btrim(name_ar) <> ''::text)))
);


--
-- Name: award_ceremonies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.award_ceremonies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    year integer NOT NULL,
    edition integer,
    label text DEFAULT ''::text NOT NULL,
    held_on date,
    source_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT award_ceremonies_year_check CHECK (((year >= 1900) AND (year <= 2100)))
);


--
-- Name: award_organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.award_organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name_ar text NOT NULL,
    name_en text,
    description text DEFAULT ''::text NOT NULL,
    website_url text,
    logo_path text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT award_organizations_values_check CHECK (((btrim(slug) <> ''::text) AND (btrim(name_ar) <> ''::text)))
);


--
-- Name: award_recognitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.award_recognitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title_id uuid NOT NULL,
    installment_id uuid,
    organization_slug text NOT NULL,
    organization_name text NOT NULL,
    category text NOT NULL,
    year integer,
    result public.award_result NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    source_url text,
    notes text,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid,
    category_id uuid,
    ceremony_id uuid,
    CONSTRAINT award_recognitions_owner_check CHECK ((((category_id IS NULL) AND (ceremony_id IS NULL)) OR (organization_id IS NOT NULL))),
    CONSTRAINT award_recognitions_values_check CHECK (((btrim(organization_slug) <> ''::text) AND (btrim(organization_name) <> ''::text) AND (btrim(category) <> ''::text) AND ((year IS NULL) OR ((year >= 1900) AND (year <= 2100))) AND ("position" >= 0)))
);


--
-- Name: background_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.background_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by_account_id uuid,
    type text NOT NULL,
    status public.background_job_status DEFAULT 'queued'::public.background_job_status NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    result jsonb,
    error text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    run_after timestamp with time zone DEFAULT now() NOT NULL,
    lease_owner text,
    lease_expires_at timestamp with time zone,
    heartbeat_at timestamp with time zone,
    cancel_requested_at timestamp with time zone,
    idempotency_key text,
    CONSTRAINT background_jobs_attempts_check CHECK (((attempts >= 0) AND ((max_attempts >= 1) AND (max_attempts <= 100)) AND (attempts <= max_attempts))),
    CONSTRAINT background_jobs_lease_check CHECK (((lease_owner IS NULL) = (lease_expires_at IS NULL))),
    CONSTRAINT background_jobs_progress_check CHECK (((progress >= 0) AND (progress <= 100)))
);


--
-- Name: collection_contributors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_contributors (
    collection_id uuid NOT NULL,
    account_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collection_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_items (
    collection_id uuid NOT NULL,
    title_id uuid NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    added_by_account_id uuid,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT collection_items_position_check CHECK (("position" >= 0))
);


--
-- Name: collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_account_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    visibility public.collection_visibility DEFAULT 'private'::public.collection_visibility NOT NULL,
    is_smart boolean DEFAULT false NOT NULL,
    ranked boolean DEFAULT false NOT NULL,
    rules jsonb,
    cover_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: comment_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comment_reactions (
    comment_id uuid NOT NULL,
    account_id uuid NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comment_reactions_emoji_check CHECK ((emoji = ANY (ARRAY['heart'::text, 'clap'::text, 'laugh'::text, 'wow'::text, 'think'::text])))
);


--
-- Name: contributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contributions (
    title_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    role_id uuid NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    languages text[] DEFAULT ARRAY[]::text[] NOT NULL,
    CONSTRAINT contributions_languages_check CHECK (public.nahhasio_language_codes_valid(languages)),
    CONSTRAINT contributions_position_check CHECK (("position" >= 0))
);


--
-- Name: countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.countries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    label_en text NOT NULL,
    label_ar text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    description_en text DEFAULT ''::text NOT NULL,
    description_ar text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT countries_position_check CHECK (("position" >= 0))
);


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    installation_id text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    platform text DEFAULT 'unknown'::text NOT NULL,
    last_seen_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT devices_installation_id_check CHECK (((char_length(btrim(installation_id)) >= 1) AND (char_length(btrim(installation_id)) <= 200)))
);


--
-- Name: editorial_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.editorial_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_account_id uuid,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    revision integer NOT NULL,
    action text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    snapshot jsonb NOT NULL,
    changes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: entities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind public.entity_kind NOT NULL,
    name text NOT NULL,
    sort_name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    urls jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: entity_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_id uuid NOT NULL,
    alias text NOT NULL,
    language text
);


--
-- Name: episodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.episodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    installment_id uuid NOT NULL,
    number numeric(8,2) NOT NULL,
    "position" integer NOT NULL,
    title text,
    release_date date,
    runtime_minutes integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    CONSTRAINT episodes_values_check CHECK ((("position" >= 0) AND ((runtime_minutes IS NULL) OR (runtime_minutes >= 0))))
);


--
-- Name: external_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title_id uuid,
    provider text NOT NULL,
    external_id text NOT NULL,
    url text,
    installment_id uuid,
    CONSTRAINT external_identity_owner_check CHECK ((num_nonnulls(title_id, installment_id) = 1)),
    CONSTRAINT external_identity_provider_check CHECK ((btrim(provider) <> ''::text))
);


--
-- Name: family_event_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_event_candidates (
    event_id uuid NOT NULL,
    title_id uuid NOT NULL,
    nominated_by_account_id uuid
);


--
-- Name: family_event_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_event_votes (
    event_id uuid NOT NULL,
    title_id uuid NOT NULL,
    account_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: family_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by_account_id uuid NOT NULL,
    name text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    scheduled_for timestamp with time zone,
    status text DEFAULT 'planning'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT family_events_status_check CHECK ((status = ANY (ARRAY['planning'::text, 'scheduled'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: family_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_recommendations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_account_id uuid NOT NULL,
    recipient_account_id uuid NOT NULL,
    title_id uuid NOT NULL,
    reason text NOT NULL,
    status public.recommendation_status DEFAULT 'pending'::public.recommendation_status NOT NULL,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: genres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.genres (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    label_en text NOT NULL,
    label_ar text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    description_en text DEFAULT ''::text NOT NULL,
    description_ar text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT genres_position_check CHECK (("position" >= 0))
);


--
-- Name: installment_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.installment_scores (
    installment_id uuid NOT NULL,
    story numeric(3,1),
    characters numeric(3,1),
    depth numeric(3,1),
    world_building numeric(3,1),
    originality numeric(3,1),
    craft numeric(3,1),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT installment_scores_range_check CHECK ((((story IS NULL) OR ((story >= (0)::numeric) AND (story <= (10)::numeric))) AND ((characters IS NULL) OR ((characters >= (0)::numeric) AND (characters <= (10)::numeric))) AND ((depth IS NULL) OR ((depth >= (0)::numeric) AND (depth <= (10)::numeric))) AND ((world_building IS NULL) OR ((world_building >= (0)::numeric) AND (world_building <= (10)::numeric))) AND ((originality IS NULL) OR ((originality >= (0)::numeric) AND (originality <= (10)::numeric))) AND ((craft IS NULL) OR ((craft >= (0)::numeric) AND (craft <= (10)::numeric)))))
);


--
-- Name: installments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.installments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title_id uuid NOT NULL,
    kind public.installment_kind NOT NULL,
    "position" integer NOT NULL,
    title text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    release_date date,
    runtime_minutes integer,
    status public.release_status DEFAULT 'unknown'::public.release_status NOT NULL,
    audience_override public.audience,
    age_override public.age_rating,
    sexuality_risk_override public.risk_level,
    behavioral_risk_override public.risk_level,
    theology_risk_override public.risk_level,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tmdb_id integer,
    imdb_id text,
    tvdb_id integer,
    anilist_id integer,
    mal_id integer,
    CONSTRAINT installments_imdb_id_check CHECK (((imdb_id IS NULL) OR (imdb_id ~ '^tt[0-9]{7,10}$'::text))),
    CONSTRAINT installments_values_check CHECK ((("position" >= 0) AND ((runtime_minutes IS NULL) OR (runtime_minutes >= 0))))
);


--
-- Name: jellyfin_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jellyfin_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_id uuid NOT NULL,
    media_file_id uuid,
    external_item_id text NOT NULL,
    etag text,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: jellyfin_servers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jellyfin_servers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    base_url text NOT NULL,
    external_server_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: library_roots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_roots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    path text NOT NULL,
    is_read_only boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_scanned_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT library_roots_values_check CHECK (((btrim(name) <> ''::text) AND (path ~~ '/%'::text) AND (path !~ '(^|/)\.\.(/|$)'::text)))
);


--
-- Name: media_asset_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_asset_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    role public.media_asset_role NOT NULL,
    title_id uuid,
    installment_id uuid,
    episode_id uuid,
    entity_id uuid,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_assignment_one_owner_check CHECK ((num_nonnulls(title_id, installment_id, episode_id, entity_id) = 1))
);


--
-- Name: media_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    path text NOT NULL,
    sha256 text NOT NULL,
    mime_type text NOT NULL,
    byte_size integer NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    original_filename text NOT NULL,
    deletion_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    focal_x integer DEFAULT 50 NOT NULL,
    focal_y integer DEFAULT 50 NOT NULL,
    variant_of_asset_id uuid,
    CONSTRAINT media_assets_mime_check CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text, 'image/gif'::text, 'image/avif'::text]))),
    CONSTRAINT media_assets_path_check CHECK (((path ~~ '/media/%'::text) AND (path !~ '(^|/)\.\.(/|$)'::text))),
    CONSTRAINT media_assets_sha256_check CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT media_assets_values_check CHECK (((byte_size > 0) AND (width > 0) AND (height > 0) AND ((focal_x >= 0) AND (focal_x <= 100)) AND ((focal_y >= 0) AND (focal_y <= 100)))),
    CONSTRAINT media_assets_variant_self_check CHECK (((variant_of_asset_id IS NULL) OR (variant_of_asset_id <> id)))
);


--
-- Name: media_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    installment_id uuid,
    episode_id uuid,
    path text NOT NULL,
    duration_seconds integer,
    probe_version text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    library_root_id uuid,
    relative_path text,
    byte_size bigint,
    sha256 text,
    modified_at timestamp with time zone,
    last_verified_at timestamp with time zone,
    availability text DEFAULT 'unknown'::text NOT NULL,
    probe_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT media_file_duration_check CHECK (((duration_seconds IS NULL) OR (duration_seconds >= 0))),
    CONSTRAINT media_file_single_owner_check CHECK ((num_nonnulls(installment_id, episode_id) = 1)),
    CONSTRAINT media_files_location_check CHECK ((((library_root_id IS NULL) AND (relative_path IS NULL)) OR ((library_root_id IS NOT NULL) AND (relative_path IS NOT NULL) AND (relative_path <> ''::text) AND (relative_path !~~ '/%'::text) AND (relative_path !~ '(^|/)\.\.(/|$)'::text)))),
    CONSTRAINT media_files_values_check CHECK ((((byte_size IS NULL) OR (byte_size >= 0)) AND ((sha256 IS NULL) OR (sha256 ~ '^[0-9a-f]{64}$'::text)) AND (availability = ANY (ARRAY['unknown'::text, 'present'::text, 'missing'::text, 'unreadable'::text])) AND (jsonb_typeof(probe_metadata) = 'object'::text)))
);


--
-- Name: media_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_tracks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    media_file_id uuid NOT NULL,
    kind public.track_kind NOT NULL,
    stream_index integer,
    language text,
    codec text,
    title text,
    is_default boolean DEFAULT false NOT NULL,
    is_forced boolean DEFAULT false NOT NULL,
    source text DEFAULT 'embedded'::text NOT NULL,
    relative_path text,
    sha256 text,
    provider text,
    provider_id text,
    is_hearing_impaired boolean DEFAULT false NOT NULL,
    CONSTRAINT media_tracks_hash_check CHECK (((sha256 IS NULL) OR (sha256 ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT media_tracks_source_check CHECK ((((source = 'embedded'::text) AND (stream_index IS NOT NULL) AND (relative_path IS NULL)) OR ((source = 'external'::text) AND (kind = 'subtitle'::public.track_kind) AND (stream_index IS NULL) AND (relative_path IS NOT NULL) AND (relative_path <> ''::text) AND (relative_path !~~ '/%'::text) AND (relative_path !~ '(^|/)\.\.(/|$)'::text)))),
    CONSTRAINT media_tracks_stream_index_check CHECK ((stream_index >= 0))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    actor_account_id uuid,
    kind public.notification_kind NOT NULL,
    title_id uuid,
    object_id uuid,
    message text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_relations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id uuid NOT NULL,
    target_id uuid NOT NULL,
    relation_type text NOT NULL,
    occurred_on date,
    description text DEFAULT ''::text NOT NULL,
    CONSTRAINT organization_relation_distinct_check CHECK ((source_id <> target_id))
);


--
-- Name: planets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name_ar text NOT NULL,
    name_en text,
    icon text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    primary_color text NOT NULL,
    secondary_color text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: review_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_reactions (
    review_id uuid NOT NULL,
    account_id uuid NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_reactions_emoji_check CHECK ((emoji = ANY (ARRAY['heart'::text, 'clap'::text, 'laugh'::text, 'wow'::text, 'think'::text])))
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    label_en text NOT NULL,
    label_ar text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    description_en text DEFAULT ''::text NOT NULL,
    description_ar text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    entity_kind public.entity_kind DEFAULT 'person'::public.entity_kind NOT NULL,
    CONSTRAINT roles_position_check CHECK (("position" >= 0)),
    CONSTRAINT roles_slug_check CHECK (((slug ~ '^[a-z][a-z0-9_]{0,79}$'::text) AND (btrim(label_en) <> ''::text) AND (btrim(label_ar) <> ''::text)))
);


--
-- Name: saved_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    name text NOT NULL,
    query jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    notify_new boolean DEFAULT false NOT NULL,
    last_matched_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: server_instance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.server_instance (
    singleton boolean DEFAULT true NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text DEFAULT 'مكتبة العائلة'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT server_instance_singleton_check CHECK (singleton)
);


--
-- Name: source_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source_evidence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    field_path text NOT NULL,
    source_note text NOT NULL,
    source_url text,
    verification_status text DEFAULT 'unverified'::text NOT NULL,
    checked_by_account_id uuid,
    checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    label_en text NOT NULL,
    label_ar text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    description_en text DEFAULT ''::text NOT NULL,
    description_ar text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT tags_position_check CHECK (("position" >= 0))
);


--
-- Name: title_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.title_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title_id uuid NOT NULL,
    title text NOT NULL,
    language text,
    script text,
    is_preferred boolean DEFAULT false NOT NULL
);


--
-- Name: title_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.title_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    title_id uuid NOT NULL,
    parent_id uuid,
    body text NOT NULL,
    contains_spoilers boolean DEFAULT false NOT NULL,
    moderation_status public.moderation_status DEFAULT 'published'::public.moderation_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT title_comments_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 1200))),
    CONSTRAINT title_comments_parent_self_check CHECK (((parent_id IS NULL) OR (parent_id <> id)))
);


--
-- Name: title_countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.title_countries (
    title_id uuid NOT NULL,
    value_id uuid NOT NULL
);


--
-- Name: title_follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.title_follows (
    account_id uuid NOT NULL,
    title_id uuid NOT NULL,
    reminder_days integer DEFAULT 7 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT title_follows_days_check CHECK (((reminder_days >= 0) AND (reminder_days <= 365)))
);


--
-- Name: title_genres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.title_genres (
    title_id uuid NOT NULL,
    value_id uuid NOT NULL
);


--
-- Name: title_planets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.title_planets (
    title_id uuid NOT NULL,
    planet_id uuid NOT NULL,
    featured_rank integer,
    CONSTRAINT title_planets_featured_rank_check CHECK (((featured_rank IS NULL) OR (featured_rank >= 0)))
);


--
-- Name: title_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.title_relations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_title_id uuid NOT NULL,
    target_title_id uuid NOT NULL,
    kind public.title_relation_kind NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    CONSTRAINT title_relations_distinct_check CHECK ((source_title_id <> target_title_id))
);


--
-- Name: title_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.title_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    title_id uuid NOT NULL,
    rating integer,
    body text DEFAULT ''::text NOT NULL,
    contains_spoilers boolean DEFAULT false NOT NULL,
    moderation_status public.moderation_status DEFAULT 'published'::public.moderation_status NOT NULL,
    moderated_by_account_id uuid,
    moderated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT title_reviews_body_check CHECK ((char_length(body) <= 1200)),
    CONSTRAINT title_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: title_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.title_tags (
    title_id uuid NOT NULL,
    value_id uuid NOT NULL
);


--
-- Name: title_tones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.title_tones (
    title_id uuid NOT NULL,
    value_id uuid NOT NULL
);


--
-- Name: title_trailers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.title_trailers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title_id uuid NOT NULL,
    youtube_video_id text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    language text,
    is_primary boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT title_trailers_values_check CHECK (((youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'::text) AND ("position" >= 0) AND ((language IS NULL) OR public.nahhasio_language_codes_valid(ARRAY[language]))))
);


--
-- Name: title_trivia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.title_trivia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title_id uuid NOT NULL,
    "position" integer NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT title_trivia_values_check CHECK ((btrim(text) <> ''::text))
);


--
-- Name: titles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.titles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    canonical_title text NOT NULL,
    sort_title text NOT NULL,
    title_ar text,
    summary text DEFAULT ''::text NOT NULL,
    release_year integer,
    audience public.audience DEFAULT 'general'::public.audience NOT NULL,
    age public.age_rating DEFAULT 'all'::public.age_rating NOT NULL,
    sexuality_risk public.risk_level DEFAULT 'none'::public.risk_level NOT NULL,
    behavioral_risk public.risk_level DEFAULT 'none'::public.risk_level NOT NULL,
    theology_risk public.risk_level DEFAULT 'none'::public.risk_level NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    content_warnings text,
    analysis_notes text,
    is_private boolean DEFAULT false NOT NULL,
    workflow_status public.workflow_status DEFAULT 'published'::public.workflow_status NOT NULL,
    quality_score integer DEFAULT 0 NOT NULL,
    curator_notes text DEFAULT ''::text NOT NULL,
    provenance jsonb DEFAULT '{}'::jsonb NOT NULL,
    verified_at timestamp with time zone,
    verified_by_account_id uuid,
    tmdb_id integer,
    imdb_id text,
    tvdb_id integer,
    anilist_id integer,
    mal_id integer,
    format public.title_format DEFAULT 'animated'::public.title_format NOT NULL,
    playback_policy text DEFAULT 'torrents-allowed'::text NOT NULL,
    dub_languages text[] DEFAULT ARRAY[]::text[] NOT NULL,
    dubbing_notes text DEFAULT ''::text NOT NULL,
    CONSTRAINT titles_dub_languages_check CHECK (public.nahhasio_language_codes_valid(dub_languages)),
    CONSTRAINT titles_imdb_id_check CHECK (((imdb_id IS NULL) OR (imdb_id ~ '^tt[0-9]{7,10}$'::text))),
    CONSTRAINT titles_playback_policy_check CHECK ((playback_policy = ANY (ARRAY['torrents-allowed'::text, 'files-only'::text])))
);


--
-- Name: tones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    label_en text NOT NULL,
    label_ar text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    description_en text DEFAULT ''::text NOT NULL,
    description_ar text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT tones_position_check CHECK (("position" >= 0))
);


--
-- Name: vocabulary_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vocabulary_labels (
    vocabulary text NOT NULL,
    value text NOT NULL,
    label_en text NOT NULL,
    label_ar text NOT NULL,
    description_en text DEFAULT ''::text NOT NULL,
    description_ar text DEFAULT ''::text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT vocabulary_labels_position_check CHECK (("position" >= 0)),
    CONSTRAINT vocabulary_labels_vocabulary_check CHECK ((vocabulary = ANY (ARRAY['audiences'::text, 'ages'::text, 'risk-levels'::text, 'release-statuses'::text])))
);


--
-- Name: account_admin_restrictions account_admin_restrictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_admin_restrictions
    ADD CONSTRAINT account_admin_restrictions_pkey PRIMARY KEY (account_id);


--
-- Name: account_capabilities account_capabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_capabilities
    ADD CONSTRAINT account_capabilities_pkey PRIMARY KEY (account_id, capability);


--
-- Name: account_content_policies account_content_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_content_policies
    ADD CONSTRAINT account_content_policies_pkey PRIMARY KEY (account_id);


--
-- Name: account_downloads account_downloads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_downloads
    ADD CONSTRAINT account_downloads_pkey PRIMARY KEY (id);


--
-- Name: account_entity_blocks account_entity_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_entity_blocks
    ADD CONSTRAINT account_entity_blocks_pkey PRIMARY KEY (account_id, entity_id);


--
-- Name: account_genre_blocks account_genre_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_genre_blocks
    ADD CONSTRAINT account_genre_blocks_pkey PRIMARY KEY (account_id, genre_id);


--
-- Name: account_invites account_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invites
    ADD CONSTRAINT account_invites_pkey PRIMARY KEY (id);


--
-- Name: account_planet_blocks account_planet_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_planet_blocks
    ADD CONSTRAINT account_planet_blocks_pkey PRIMARY KEY (account_id, planet_id);


--
-- Name: account_playback_states account_playback_owner_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_playback_states
    ADD CONSTRAINT account_playback_owner_uq UNIQUE NULLS NOT DISTINCT (account_id, installment_id, episode_id);


--
-- Name: account_playback_states account_playback_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_playback_states
    ADD CONSTRAINT account_playback_states_pkey PRIMARY KEY (id);


--
-- Name: account_preferences account_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_preferences
    ADD CONSTRAINT account_preferences_pkey PRIMARY KEY (account_id);


--
-- Name: account_tag_blocks account_tag_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_tag_blocks
    ADD CONSTRAINT account_tag_blocks_pkey PRIMARY KEY (account_id, tag_id);


--
-- Name: account_title_blocks account_title_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_title_blocks
    ADD CONSTRAINT account_title_blocks_pkey PRIMARY KEY (account_id, title_id);


--
-- Name: account_title_states account_title_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_title_states
    ADD CONSTRAINT account_title_states_pkey PRIMARY KEY (account_id, title_id);


--
-- Name: account_view_history account_view_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_view_history
    ADD CONSTRAINT account_view_history_pkey PRIMARY KEY (account_id, title_id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_accounts auth_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_accounts
    ADD CONSTRAINT auth_accounts_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (id);


--
-- Name: auth_users auth_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_users
    ADD CONSTRAINT auth_users_pkey PRIMARY KEY (id);


--
-- Name: auth_verifications auth_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_verifications
    ADD CONSTRAINT auth_verifications_pkey PRIMARY KEY (id);


--
-- Name: award_categories award_categories_id_organization_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_categories
    ADD CONSTRAINT award_categories_id_organization_uq UNIQUE (id, organization_id);


--
-- Name: award_categories award_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_categories
    ADD CONSTRAINT award_categories_pkey PRIMARY KEY (id);


--
-- Name: award_ceremonies award_ceremonies_id_organization_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_ceremonies
    ADD CONSTRAINT award_ceremonies_id_organization_uq UNIQUE (id, organization_id);


--
-- Name: award_ceremonies award_ceremonies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_ceremonies
    ADD CONSTRAINT award_ceremonies_pkey PRIMARY KEY (id);


--
-- Name: award_organizations award_organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_organizations
    ADD CONSTRAINT award_organizations_pkey PRIMARY KEY (id);


--
-- Name: award_recognitions award_recognitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_recognitions
    ADD CONSTRAINT award_recognitions_pkey PRIMARY KEY (id);


--
-- Name: background_jobs background_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_pkey PRIMARY KEY (id);


--
-- Name: collection_contributors collection_contributors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_contributors
    ADD CONSTRAINT collection_contributors_pkey PRIMARY KEY (collection_id, account_id);


--
-- Name: collection_items collection_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_pkey PRIMARY KEY (collection_id, title_id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: comment_reactions comment_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comment_reactions
    ADD CONSTRAINT comment_reactions_pkey PRIMARY KEY (comment_id, account_id, emoji);


--
-- Name: contributions contributions_title_id_entity_id_role_id_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contributions
    ADD CONSTRAINT contributions_title_id_entity_id_role_id_pk PRIMARY KEY (title_id, entity_id, role_id);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: countries countries_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_slug_unique UNIQUE (slug);


--
-- Name: devices devices_installation_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_installation_id_unique UNIQUE (installation_id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: editorial_revisions editorial_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.editorial_revisions
    ADD CONSTRAINT editorial_revisions_pkey PRIMARY KEY (id);


--
-- Name: entities entities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_pkey PRIMARY KEY (id);


--
-- Name: entity_aliases entity_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_aliases
    ADD CONSTRAINT entity_aliases_pkey PRIMARY KEY (id);


--
-- Name: episodes episodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episodes
    ADD CONSTRAINT episodes_pkey PRIMARY KEY (id);


--
-- Name: external_identities external_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_identities
    ADD CONSTRAINT external_identities_pkey PRIMARY KEY (id);


--
-- Name: family_event_candidates family_event_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_event_candidates
    ADD CONSTRAINT family_event_candidates_pkey PRIMARY KEY (event_id, title_id);


--
-- Name: family_event_votes family_event_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_event_votes
    ADD CONSTRAINT family_event_votes_pkey PRIMARY KEY (event_id, title_id, account_id);


--
-- Name: family_events family_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_events
    ADD CONSTRAINT family_events_pkey PRIMARY KEY (id);


--
-- Name: family_recommendations family_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_recommendations
    ADD CONSTRAINT family_recommendations_pkey PRIMARY KEY (id);


--
-- Name: genres genres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_pkey PRIMARY KEY (id);


--
-- Name: genres genres_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_slug_unique UNIQUE (slug);


--
-- Name: installment_scores installment_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_scores
    ADD CONSTRAINT installment_scores_pkey PRIMARY KEY (installment_id);


--
-- Name: installments installments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT installments_pkey PRIMARY KEY (id);


--
-- Name: jellyfin_items jellyfin_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jellyfin_items
    ADD CONSTRAINT jellyfin_items_pkey PRIMARY KEY (id);


--
-- Name: jellyfin_servers jellyfin_servers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jellyfin_servers
    ADD CONSTRAINT jellyfin_servers_pkey PRIMARY KEY (id);


--
-- Name: library_roots library_roots_path_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_roots
    ADD CONSTRAINT library_roots_path_unique UNIQUE (path);


--
-- Name: library_roots library_roots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_roots
    ADD CONSTRAINT library_roots_pkey PRIMARY KEY (id);


--
-- Name: media_asset_assignments media_asset_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_asset_assignments
    ADD CONSTRAINT media_asset_assignments_pkey PRIMARY KEY (id);


--
-- Name: media_assets media_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);


--
-- Name: media_files media_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_pkey PRIMARY KEY (id);


--
-- Name: media_tracks media_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_tracks
    ADD CONSTRAINT media_tracks_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organization_relations organization_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_relations
    ADD CONSTRAINT organization_relations_pkey PRIMARY KEY (id);


--
-- Name: planets planets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planets
    ADD CONSTRAINT planets_pkey PRIMARY KEY (id);


--
-- Name: planets planets_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planets
    ADD CONSTRAINT planets_slug_unique UNIQUE (slug);


--
-- Name: review_reactions review_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_reactions
    ADD CONSTRAINT review_reactions_pkey PRIMARY KEY (review_id, account_id, emoji);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: roles roles_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_slug_unique UNIQUE (slug);


--
-- Name: saved_views saved_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_views
    ADD CONSTRAINT saved_views_pkey PRIMARY KEY (id);


--
-- Name: server_instance server_instance_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_instance
    ADD CONSTRAINT server_instance_id_uq UNIQUE (id);


--
-- Name: server_instance server_instance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_instance
    ADD CONSTRAINT server_instance_pkey PRIMARY KEY (singleton);


--
-- Name: source_evidence source_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_evidence
    ADD CONSTRAINT source_evidence_pkey PRIMARY KEY (id);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: tags tags_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_slug_unique UNIQUE (slug);


--
-- Name: title_aliases title_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_aliases
    ADD CONSTRAINT title_aliases_pkey PRIMARY KEY (id);


--
-- Name: title_comments title_comments_id_title_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_comments
    ADD CONSTRAINT title_comments_id_title_uq UNIQUE (id, title_id);


--
-- Name: title_comments title_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_comments
    ADD CONSTRAINT title_comments_pkey PRIMARY KEY (id);


--
-- Name: title_countries title_countries_title_id_value_id_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_countries
    ADD CONSTRAINT title_countries_title_id_value_id_pk PRIMARY KEY (title_id, value_id);


--
-- Name: title_follows title_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_follows
    ADD CONSTRAINT title_follows_pkey PRIMARY KEY (account_id, title_id);


--
-- Name: title_genres title_genres_title_id_value_id_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_genres
    ADD CONSTRAINT title_genres_title_id_value_id_pk PRIMARY KEY (title_id, value_id);


--
-- Name: title_planets title_planets_single_planet_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_planets
    ADD CONSTRAINT title_planets_single_planet_uq UNIQUE (title_id);


--
-- Name: title_planets title_planets_title_id_planet_id_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_planets
    ADD CONSTRAINT title_planets_title_id_planet_id_pk PRIMARY KEY (title_id, planet_id);


--
-- Name: title_relations title_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_relations
    ADD CONSTRAINT title_relations_pkey PRIMARY KEY (id);


--
-- Name: title_reviews title_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_reviews
    ADD CONSTRAINT title_reviews_pkey PRIMARY KEY (id);


--
-- Name: title_tags title_tags_title_id_value_id_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_tags
    ADD CONSTRAINT title_tags_title_id_value_id_pk PRIMARY KEY (title_id, value_id);


--
-- Name: title_tones title_tones_title_id_value_id_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_tones
    ADD CONSTRAINT title_tones_title_id_value_id_pk PRIMARY KEY (title_id, value_id);


--
-- Name: title_trailers title_trailers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_trailers
    ADD CONSTRAINT title_trailers_pkey PRIMARY KEY (id);


--
-- Name: title_trailers title_trailers_video_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_trailers
    ADD CONSTRAINT title_trailers_video_uq UNIQUE (title_id, youtube_video_id);


--
-- Name: title_trivia title_trivia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_trivia
    ADD CONSTRAINT title_trivia_pkey PRIMARY KEY (id);


--
-- Name: titles titles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.titles
    ADD CONSTRAINT titles_pkey PRIMARY KEY (id);


--
-- Name: tones tones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tones
    ADD CONSTRAINT tones_pkey PRIMARY KEY (id);


--
-- Name: tones tones_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tones
    ADD CONSTRAINT tones_slug_unique UNIQUE (slug);


--
-- Name: vocabulary_labels vocabulary_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_labels
    ADD CONSTRAINT vocabulary_labels_pkey PRIMARY KEY (vocabulary, value);


--
-- Name: account_downloads_episode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_downloads_episode_idx ON public.account_downloads USING btree (episode_id);


--
-- Name: account_downloads_installment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_downloads_installment_idx ON public.account_downloads USING btree (installment_id);


--
-- Name: account_downloads_unit_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_downloads_unit_uq ON public.account_downloads USING btree (account_id, device_id, installment_id, COALESCE(episode_id, '00000000-0000-0000-0000-000000000000'::uuid));


--
-- Name: account_entity_blocks_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_entity_blocks_entity_idx ON public.account_entity_blocks USING btree (entity_id);


--
-- Name: account_genre_blocks_genre_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_genre_blocks_genre_idx ON public.account_genre_blocks USING btree (genre_id);


--
-- Name: account_invites_token_hash_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_invites_token_hash_uq ON public.account_invites USING btree (token_hash);


--
-- Name: account_planet_blocks_planet_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_planet_blocks_planet_idx ON public.account_planet_blocks USING btree (planet_id);


--
-- Name: account_playback_episode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_playback_episode_idx ON public.account_playback_states USING btree (episode_id);


--
-- Name: account_playback_installment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_playback_installment_idx ON public.account_playback_states USING btree (installment_id);


--
-- Name: account_tag_blocks_tag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_tag_blocks_tag_idx ON public.account_tag_blocks USING btree (tag_id);


--
-- Name: account_title_blocks_title_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_title_blocks_title_idx ON public.account_title_blocks USING btree (title_id);


--
-- Name: account_title_states_title_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_title_states_title_idx ON public.account_title_states USING btree (title_id);


--
-- Name: account_view_history_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_view_history_recent_idx ON public.account_view_history USING btree (account_id, viewed_at);


--
-- Name: accounts_auth_user_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX accounts_auth_user_uq ON public.accounts USING btree (auth_user_id);


--
-- Name: accounts_slug_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX accounts_slug_uq ON public.accounts USING btree (slug);


--
-- Name: audit_logs_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_target_idx ON public.audit_logs USING btree (target_type, target_id, created_at);


--
-- Name: auth_accounts_provider_identity_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_accounts_provider_identity_uq ON public.auth_accounts USING btree (provider_id, account_id);


--
-- Name: auth_accounts_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_accounts_user_idx ON public.auth_accounts USING btree (user_id);


--
-- Name: auth_sessions_token_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_sessions_token_uq ON public.auth_sessions USING btree (token);


--
-- Name: auth_sessions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_sessions_user_idx ON public.auth_sessions USING btree (user_id);


--
-- Name: auth_users_email_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_users_email_uq ON public.auth_users USING btree (email);


--
-- Name: auth_users_username_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX auth_users_username_uq ON public.auth_users USING btree (username);


--
-- Name: auth_verifications_identifier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_verifications_identifier_idx ON public.auth_verifications USING btree (identifier);


--
-- Name: award_categories_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX award_categories_organization_idx ON public.award_categories USING btree (organization_id, is_active);


--
-- Name: award_categories_organization_slug_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX award_categories_organization_slug_uq ON public.award_categories USING btree (organization_id, slug);


--
-- Name: award_ceremonies_organization_year_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX award_ceremonies_organization_year_uq ON public.award_ceremonies USING btree (organization_id, year);


--
-- Name: award_organizations_slug_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX award_organizations_slug_uq ON public.award_organizations USING btree (slug);


--
-- Name: award_recognitions_filter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX award_recognitions_filter_idx ON public.award_recognitions USING btree (organization_slug, result);


--
-- Name: award_recognitions_installment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX award_recognitions_installment_idx ON public.award_recognitions USING btree (installment_id);


--
-- Name: award_recognitions_title_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX award_recognitions_title_idx ON public.award_recognitions USING btree (title_id);


--
-- Name: background_jobs_idempotency_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX background_jobs_idempotency_uq ON public.background_jobs USING btree (COALESCE(created_by_account_id, '00000000-0000-0000-0000-000000000000'::uuid), type, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: background_jobs_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX background_jobs_queue_idx ON public.background_jobs USING btree (status, run_after, created_at);


--
-- Name: background_jobs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX background_jobs_status_idx ON public.background_jobs USING btree (status, created_at);


--
-- Name: collection_items_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_items_order_idx ON public.collection_items USING btree (collection_id, "position");


--
-- Name: collections_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collections_owner_idx ON public.collections USING btree (owner_account_id, updated_at);


--
-- Name: contributions_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contributions_entity_idx ON public.contributions USING btree (entity_id);


--
-- Name: contributions_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contributions_role_idx ON public.contributions USING btree (role_id);


--
-- Name: editorial_revisions_entity_revision_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX editorial_revisions_entity_revision_uq ON public.editorial_revisions USING btree (entity_type, entity_id, revision);


--
-- Name: editorial_revisions_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX editorial_revisions_recent_idx ON public.editorial_revisions USING btree (entity_type, entity_id, created_at);


--
-- Name: entities_kind_sort_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX entities_kind_sort_uq ON public.entities USING btree (kind, sort_name);


--
-- Name: entity_alias_normalized_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX entity_alias_normalized_uq ON public.entity_aliases USING btree (entity_id, lower(btrim(alias)));


--
-- Name: episodes_id_installment_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX episodes_id_installment_uq ON public.episodes USING btree (id, installment_id);


--
-- Name: episodes_installment_number_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX episodes_installment_number_uq ON public.episodes USING btree (installment_id, number);


--
-- Name: episodes_installment_position_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX episodes_installment_position_uq ON public.episodes USING btree (installment_id, "position");


--
-- Name: external_identities_installment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX external_identities_installment_idx ON public.external_identities USING btree (installment_id);


--
-- Name: external_identities_title_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX external_identities_title_idx ON public.external_identities USING btree (title_id);


--
-- Name: external_identity_provider_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX external_identity_provider_uq ON public.external_identities USING btree (COALESCE(title_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(installment_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(provider)), external_id);


--
-- Name: family_events_schedule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX family_events_schedule_idx ON public.family_events USING btree (status, scheduled_for);


--
-- Name: family_recommendations_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX family_recommendations_recipient_idx ON public.family_recommendations USING btree (recipient_account_id, status);


--
-- Name: installments_anilist_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX installments_anilist_id_uq ON public.installments USING btree (anilist_id) WHERE (anilist_id IS NOT NULL);


--
-- Name: installments_id_title_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX installments_id_title_uq ON public.installments USING btree (id, title_id);


--
-- Name: installments_imdb_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX installments_imdb_id_uq ON public.installments USING btree (imdb_id) WHERE (imdb_id IS NOT NULL);


--
-- Name: installments_mal_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX installments_mal_id_uq ON public.installments USING btree (mal_id) WHERE (mal_id IS NOT NULL);


--
-- Name: installments_title_position_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX installments_title_position_uq ON public.installments USING btree (title_id, "position");


--
-- Name: installments_tmdb_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX installments_tmdb_id_uq ON public.installments USING btree (tmdb_id) WHERE (tmdb_id IS NOT NULL);


--
-- Name: installments_tvdb_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX installments_tvdb_id_uq ON public.installments USING btree (tvdb_id) WHERE (tvdb_id IS NOT NULL);


--
-- Name: jellyfin_item_external_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX jellyfin_item_external_uq ON public.jellyfin_items USING btree (server_id, external_item_id);


--
-- Name: media_assets_path_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX media_assets_path_uq ON public.media_assets USING btree (path);


--
-- Name: media_assets_sha256_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX media_assets_sha256_uq ON public.media_assets USING btree (sha256);


--
-- Name: media_assignment_entity_primary_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX media_assignment_entity_primary_uq ON public.media_asset_assignments USING btree (entity_id, role) WHERE ((entity_id IS NOT NULL) AND is_primary);


--
-- Name: media_assignment_episode_primary_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX media_assignment_episode_primary_uq ON public.media_asset_assignments USING btree (episode_id, role) WHERE ((episode_id IS NOT NULL) AND is_primary);


--
-- Name: media_assignment_identity_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX media_assignment_identity_uq ON public.media_asset_assignments USING btree (asset_id, role, COALESCE(title_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(installment_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(episode_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid));


--
-- Name: media_assignment_installment_primary_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX media_assignment_installment_primary_uq ON public.media_asset_assignments USING btree (installment_id, role) WHERE ((installment_id IS NOT NULL) AND is_primary);


--
-- Name: media_assignment_title_primary_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX media_assignment_title_primary_uq ON public.media_asset_assignments USING btree (title_id, role) WHERE ((title_id IS NOT NULL) AND is_primary);


--
-- Name: media_assignments_asset_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_assignments_asset_idx ON public.media_asset_assignments USING btree (asset_id);


--
-- Name: media_assignments_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_assignments_entity_idx ON public.media_asset_assignments USING btree (entity_id);


--
-- Name: media_assignments_episode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_assignments_episode_idx ON public.media_asset_assignments USING btree (episode_id);


--
-- Name: media_assignments_installment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_assignments_installment_idx ON public.media_asset_assignments USING btree (installment_id);


--
-- Name: media_assignments_title_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_assignments_title_idx ON public.media_asset_assignments USING btree (title_id);


--
-- Name: media_files_episode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_files_episode_idx ON public.media_files USING btree (episode_id);


--
-- Name: media_files_installment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_files_installment_idx ON public.media_files USING btree (installment_id);


--
-- Name: media_files_root_path_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX media_files_root_path_uq ON public.media_files USING btree (library_root_id, relative_path) WHERE (library_root_id IS NOT NULL);


--
-- Name: media_tracks_sidecar_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX media_tracks_sidecar_uq ON public.media_tracks USING btree (media_file_id, relative_path) WHERE (source = 'external'::text);


--
-- Name: media_tracks_stream_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX media_tracks_stream_uq ON public.media_tracks USING btree (media_file_id, stream_index);


--
-- Name: notifications_inbox_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_inbox_idx ON public.notifications USING btree (account_id, read_at, created_at);


--
-- Name: organization_relations_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organization_relations_target_idx ON public.organization_relations USING btree (target_id);


--
-- Name: saved_views_account_default_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX saved_views_account_default_uq ON public.saved_views USING btree (account_id) WHERE is_default;


--
-- Name: saved_views_account_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX saved_views_account_name_uq ON public.saved_views USING btree (account_id, lower(btrim(name)));


--
-- Name: source_evidence_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX source_evidence_entity_idx ON public.source_evidence USING btree (entity_type, entity_id, field_path);


--
-- Name: title_alias_identity_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX title_alias_identity_uq ON public.title_aliases USING btree (title_id, title, language);


--
-- Name: title_alias_normalized_identity_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX title_alias_normalized_identity_uq ON public.title_aliases USING btree (title_id, lower(btrim(title)));


--
-- Name: title_alias_search_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX title_alias_search_trgm_idx ON public.title_aliases USING gin (title public.gin_trgm_ops);


--
-- Name: title_comments_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX title_comments_parent_idx ON public.title_comments USING btree (parent_id);


--
-- Name: title_comments_title_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX title_comments_title_idx ON public.title_comments USING btree (title_id, created_at);


--
-- Name: title_countries_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX title_countries_value_idx ON public.title_countries USING btree (value_id);


--
-- Name: title_genres_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX title_genres_value_idx ON public.title_genres USING btree (value_id);


--
-- Name: title_planets_featured_rank_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX title_planets_featured_rank_uq ON public.title_planets USING btree (planet_id, featured_rank) WHERE (featured_rank IS NOT NULL);


--
-- Name: title_planets_planet_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX title_planets_planet_idx ON public.title_planets USING btree (planet_id);


--
-- Name: title_relations_pair_kind_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX title_relations_pair_kind_uq ON public.title_relations USING btree (source_title_id, target_title_id, kind);


--
-- Name: title_relations_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX title_relations_target_idx ON public.title_relations USING btree (target_title_id);


--
-- Name: title_reviews_account_title_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX title_reviews_account_title_uq ON public.title_reviews USING btree (account_id, title_id);


--
-- Name: title_reviews_title_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX title_reviews_title_idx ON public.title_reviews USING btree (title_id, moderation_status);


--
-- Name: title_tags_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX title_tags_value_idx ON public.title_tags USING btree (value_id);


--
-- Name: title_tones_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX title_tones_value_idx ON public.title_tones USING btree (value_id);


--
-- Name: title_trailers_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX title_trailers_order_idx ON public.title_trailers USING btree (title_id, "position", id);


--
-- Name: title_trailers_primary_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX title_trailers_primary_uq ON public.title_trailers USING btree (title_id) WHERE is_primary;


--
-- Name: title_trivia_title_position_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX title_trivia_title_position_uq ON public.title_trivia USING btree (title_id, "position");


--
-- Name: titles_anilist_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX titles_anilist_id_uq ON public.titles USING btree (anilist_id) WHERE (anilist_id IS NOT NULL);


--
-- Name: titles_dub_languages_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX titles_dub_languages_idx ON public.titles USING gin (dub_languages);


--
-- Name: titles_imdb_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX titles_imdb_id_uq ON public.titles USING btree (imdb_id) WHERE (imdb_id IS NOT NULL);


--
-- Name: titles_mal_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX titles_mal_id_uq ON public.titles USING btree (mal_id) WHERE (mal_id IS NOT NULL);


--
-- Name: titles_release_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX titles_release_year_idx ON public.titles USING btree (release_year);


--
-- Name: titles_search_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX titles_search_trgm_idx ON public.titles USING gin (canonical_title public.gin_trgm_ops);


--
-- Name: titles_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX titles_sort_idx ON public.titles USING btree (sort_title);


--
-- Name: titles_tmdb_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX titles_tmdb_id_uq ON public.titles USING btree (tmdb_id) WHERE (tmdb_id IS NOT NULL);


--
-- Name: titles_tvdb_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX titles_tvdb_id_uq ON public.titles USING btree (tvdb_id) WHERE (tvdb_id IS NOT NULL);


--
-- Name: titles_visibility_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX titles_visibility_sort_idx ON public.titles USING btree (workflow_status, is_private, sort_title, id);


--
-- Name: account_playback_states account_playback_revision; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER account_playback_revision BEFORE UPDATE ON public.account_playback_states FOR EACH ROW EXECUTE FUNCTION public.nahhasio_playback_revision();


--
-- Name: account_title_states account_title_rating_projection; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER account_title_rating_projection AFTER INSERT OR UPDATE OF personal_rating ON public.account_title_states FOR EACH ROW EXECUTE FUNCTION public.nahhasio_personal_rating_projection();


--
-- Name: contributions contributions_entity_kind_check; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER contributions_entity_kind_check BEFORE INSERT OR UPDATE OF entity_id, role_id ON public.contributions FOR EACH ROW EXECUTE FUNCTION public.enforce_contribution_entity_kind();


--
-- Name: entities entities_credit_kind_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER entities_credit_kind_update BEFORE UPDATE OF kind ON public.entities FOR EACH ROW EXECUTE FUNCTION public.nahhasio_credit_kind_update();


--
-- Name: roles roles_credit_kind_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER roles_credit_kind_update BEFORE UPDATE OF entity_kind ON public.roles FOR EACH ROW EXECUTE FUNCTION public.nahhasio_credit_kind_update();


--
-- Name: title_reviews title_reviews_rating_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER title_reviews_rating_write AFTER INSERT OR UPDATE OF rating ON public.title_reviews FOR EACH ROW EXECUTE FUNCTION public.nahhasio_review_rating_write();


--
-- Name: account_admin_restrictions account_admin_restrictions_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_admin_restrictions
    ADD CONSTRAINT account_admin_restrictions_account_fk FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_capabilities account_capabilities_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_capabilities
    ADD CONSTRAINT account_capabilities_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_content_policies account_content_policies_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_content_policies
    ADD CONSTRAINT account_content_policies_account_fk FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_downloads account_downloads_account_id_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_downloads
    ADD CONSTRAINT account_downloads_account_id_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_downloads account_downloads_device_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_downloads
    ADD CONSTRAINT account_downloads_device_fk FOREIGN KEY (device_id) REFERENCES public.devices(installation_id) ON DELETE RESTRICT;


--
-- Name: account_downloads account_downloads_episode_id_episodes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_downloads
    ADD CONSTRAINT account_downloads_episode_id_episodes_id_fk FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: account_downloads account_downloads_episode_installment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_downloads
    ADD CONSTRAINT account_downloads_episode_installment_fk FOREIGN KEY (episode_id, installment_id) REFERENCES public.episodes(id, installment_id) ON DELETE CASCADE;


--
-- Name: account_downloads account_downloads_installment_id_installments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_downloads
    ADD CONSTRAINT account_downloads_installment_id_installments_id_fk FOREIGN KEY (installment_id) REFERENCES public.installments(id) ON DELETE CASCADE;


--
-- Name: account_entity_blocks account_entity_blocks_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_entity_blocks
    ADD CONSTRAINT account_entity_blocks_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_entity_blocks account_entity_blocks_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_entity_blocks
    ADD CONSTRAINT account_entity_blocks_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: account_genre_blocks account_genre_blocks_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_genre_blocks
    ADD CONSTRAINT account_genre_blocks_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_genre_blocks account_genre_blocks_genre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_genre_blocks
    ADD CONSTRAINT account_genre_blocks_genre_id_fkey FOREIGN KEY (genre_id) REFERENCES public.genres(id) ON DELETE CASCADE;


--
-- Name: account_invites account_invites_accepted_by_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invites
    ADD CONSTRAINT account_invites_accepted_by_account_id_fkey FOREIGN KEY (accepted_by_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: account_invites account_invites_created_by_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invites
    ADD CONSTRAINT account_invites_created_by_account_id_fkey FOREIGN KEY (created_by_account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_planet_blocks account_planet_blocks_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_planet_blocks
    ADD CONSTRAINT account_planet_blocks_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_planet_blocks account_planet_blocks_planet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_planet_blocks
    ADD CONSTRAINT account_planet_blocks_planet_id_fkey FOREIGN KEY (planet_id) REFERENCES public.planets(id) ON DELETE CASCADE;


--
-- Name: account_playback_states account_playback_episode_installment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_playback_states
    ADD CONSTRAINT account_playback_episode_installment_fk FOREIGN KEY (episode_id, installment_id) REFERENCES public.episodes(id, installment_id) ON DELETE CASCADE;


--
-- Name: account_playback_states account_playback_states_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_playback_states
    ADD CONSTRAINT account_playback_states_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_playback_states account_playback_states_installment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_playback_states
    ADD CONSTRAINT account_playback_states_installment_id_fkey FOREIGN KEY (installment_id) REFERENCES public.installments(id) ON DELETE CASCADE;


--
-- Name: account_playback_states account_playback_states_last_device_id_devices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_playback_states
    ADD CONSTRAINT account_playback_states_last_device_id_devices_id_fk FOREIGN KEY (last_device_id) REFERENCES public.devices(id) ON DELETE SET NULL;


--
-- Name: account_preferences account_preferences_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_preferences
    ADD CONSTRAINT account_preferences_account_fk FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_tag_blocks account_tag_blocks_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_tag_blocks
    ADD CONSTRAINT account_tag_blocks_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_tag_blocks account_tag_blocks_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_tag_blocks
    ADD CONSTRAINT account_tag_blocks_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: account_title_blocks account_title_blocks_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_title_blocks
    ADD CONSTRAINT account_title_blocks_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_title_blocks account_title_blocks_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_title_blocks
    ADD CONSTRAINT account_title_blocks_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: account_title_states account_title_states_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_title_states
    ADD CONSTRAINT account_title_states_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_title_states account_title_states_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_title_states
    ADD CONSTRAINT account_title_states_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: account_view_history account_view_history_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_view_history
    ADD CONSTRAINT account_view_history_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: account_view_history account_view_history_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_view_history
    ADD CONSTRAINT account_view_history_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: accounts accounts_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_account_id_fkey FOREIGN KEY (actor_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: auth_accounts auth_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_accounts
    ADD CONSTRAINT auth_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE;


--
-- Name: auth_sessions auth_sessions_device_id_devices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_device_id_devices_id_fk FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE SET NULL;


--
-- Name: auth_sessions auth_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE;


--
-- Name: award_categories award_categories_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_categories
    ADD CONSTRAINT award_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.award_organizations(id) ON DELETE CASCADE;


--
-- Name: award_ceremonies award_ceremonies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_ceremonies
    ADD CONSTRAINT award_ceremonies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.award_organizations(id) ON DELETE CASCADE;


--
-- Name: award_recognitions award_recognitions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_recognitions
    ADD CONSTRAINT award_recognitions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.award_categories(id) ON DELETE RESTRICT;


--
-- Name: award_recognitions award_recognitions_category_organization_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_recognitions
    ADD CONSTRAINT award_recognitions_category_organization_fk FOREIGN KEY (category_id, organization_id) REFERENCES public.award_categories(id, organization_id) ON DELETE RESTRICT;


--
-- Name: award_recognitions award_recognitions_ceremony_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_recognitions
    ADD CONSTRAINT award_recognitions_ceremony_id_fkey FOREIGN KEY (ceremony_id) REFERENCES public.award_ceremonies(id) ON DELETE SET NULL;


--
-- Name: award_recognitions award_recognitions_ceremony_organization_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_recognitions
    ADD CONSTRAINT award_recognitions_ceremony_organization_fk FOREIGN KEY (ceremony_id, organization_id) REFERENCES public.award_ceremonies(id, organization_id) ON DELETE RESTRICT;


--
-- Name: award_recognitions award_recognitions_installment_id_installments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_recognitions
    ADD CONSTRAINT award_recognitions_installment_id_installments_id_fk FOREIGN KEY (installment_id) REFERENCES public.installments(id) ON DELETE CASCADE;


--
-- Name: award_recognitions award_recognitions_installment_title_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_recognitions
    ADD CONSTRAINT award_recognitions_installment_title_fk FOREIGN KEY (installment_id, title_id) REFERENCES public.installments(id, title_id) ON DELETE CASCADE;


--
-- Name: award_recognitions award_recognitions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_recognitions
    ADD CONSTRAINT award_recognitions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.award_organizations(id) ON DELETE RESTRICT;


--
-- Name: award_recognitions award_recognitions_title_id_titles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.award_recognitions
    ADD CONSTRAINT award_recognitions_title_id_titles_id_fk FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: background_jobs background_jobs_created_by_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_created_by_account_id_fkey FOREIGN KEY (created_by_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: collection_contributors collection_contributors_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_contributors
    ADD CONSTRAINT collection_contributors_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: collection_contributors collection_contributors_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_contributors
    ADD CONSTRAINT collection_contributors_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- Name: collection_items collection_items_added_by_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_added_by_account_id_fkey FOREIGN KEY (added_by_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: collection_items collection_items_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- Name: collection_items collection_items_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: collections collections_owner_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_owner_account_id_fkey FOREIGN KEY (owner_account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: comment_reactions comment_reactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comment_reactions
    ADD CONSTRAINT comment_reactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: comment_reactions comment_reactions_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comment_reactions
    ADD CONSTRAINT comment_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.title_comments(id) ON DELETE CASCADE;


--
-- Name: contributions contributions_entity_id_entities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contributions
    ADD CONSTRAINT contributions_entity_id_entities_id_fk FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: contributions contributions_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contributions
    ADD CONSTRAINT contributions_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- Name: contributions contributions_title_id_titles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contributions
    ADD CONSTRAINT contributions_title_id_titles_id_fk FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: editorial_revisions editorial_revisions_actor_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.editorial_revisions
    ADD CONSTRAINT editorial_revisions_actor_account_id_fkey FOREIGN KEY (actor_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: entity_aliases entity_aliases_entity_id_entities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_aliases
    ADD CONSTRAINT entity_aliases_entity_id_entities_id_fk FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: episodes episodes_installment_id_installments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episodes
    ADD CONSTRAINT episodes_installment_id_installments_id_fk FOREIGN KEY (installment_id) REFERENCES public.installments(id) ON DELETE CASCADE;


--
-- Name: external_identities external_identities_installment_id_installments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_identities
    ADD CONSTRAINT external_identities_installment_id_installments_id_fk FOREIGN KEY (installment_id) REFERENCES public.installments(id) ON DELETE CASCADE;


--
-- Name: external_identities external_identities_title_id_titles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_identities
    ADD CONSTRAINT external_identities_title_id_titles_id_fk FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: family_event_candidates family_event_candidates_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_event_candidates
    ADD CONSTRAINT family_event_candidates_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.family_events(id) ON DELETE CASCADE;


--
-- Name: family_event_candidates family_event_candidates_nominated_by_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_event_candidates
    ADD CONSTRAINT family_event_candidates_nominated_by_account_id_fkey FOREIGN KEY (nominated_by_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: family_event_candidates family_event_candidates_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_event_candidates
    ADD CONSTRAINT family_event_candidates_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: family_event_votes family_event_votes_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_event_votes
    ADD CONSTRAINT family_event_votes_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: family_event_votes family_event_votes_candidate_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_event_votes
    ADD CONSTRAINT family_event_votes_candidate_fk FOREIGN KEY (event_id, title_id) REFERENCES public.family_event_candidates(event_id, title_id) ON DELETE CASCADE;


--
-- Name: family_events family_events_created_by_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_events
    ADD CONSTRAINT family_events_created_by_account_id_fkey FOREIGN KEY (created_by_account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: family_recommendations family_recommendations_recipient_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_recommendations
    ADD CONSTRAINT family_recommendations_recipient_account_id_fkey FOREIGN KEY (recipient_account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: family_recommendations family_recommendations_sender_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_recommendations
    ADD CONSTRAINT family_recommendations_sender_account_id_fkey FOREIGN KEY (sender_account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: family_recommendations family_recommendations_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_recommendations
    ADD CONSTRAINT family_recommendations_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: installment_scores installment_scores_installment_id_installments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_scores
    ADD CONSTRAINT installment_scores_installment_id_installments_id_fk FOREIGN KEY (installment_id) REFERENCES public.installments(id) ON DELETE CASCADE;


--
-- Name: installments installments_title_id_titles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT installments_title_id_titles_id_fk FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: jellyfin_items jellyfin_items_media_file_id_media_files_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jellyfin_items
    ADD CONSTRAINT jellyfin_items_media_file_id_media_files_id_fk FOREIGN KEY (media_file_id) REFERENCES public.media_files(id) ON DELETE SET NULL;


--
-- Name: jellyfin_items jellyfin_items_server_id_jellyfin_servers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jellyfin_items
    ADD CONSTRAINT jellyfin_items_server_id_jellyfin_servers_id_fk FOREIGN KEY (server_id) REFERENCES public.jellyfin_servers(id) ON DELETE CASCADE;


--
-- Name: media_asset_assignments media_asset_assignments_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_asset_assignments
    ADD CONSTRAINT media_asset_assignments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.media_assets(id) ON DELETE CASCADE;


--
-- Name: media_asset_assignments media_asset_assignments_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_asset_assignments
    ADD CONSTRAINT media_asset_assignments_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: media_asset_assignments media_asset_assignments_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_asset_assignments
    ADD CONSTRAINT media_asset_assignments_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: media_asset_assignments media_asset_assignments_installment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_asset_assignments
    ADD CONSTRAINT media_asset_assignments_installment_id_fkey FOREIGN KEY (installment_id) REFERENCES public.installments(id) ON DELETE CASCADE;


--
-- Name: media_asset_assignments media_asset_assignments_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_asset_assignments
    ADD CONSTRAINT media_asset_assignments_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: media_assets media_assets_variant_of_asset_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_variant_of_asset_id_media_assets_id_fk FOREIGN KEY (variant_of_asset_id) REFERENCES public.media_assets(id) ON DELETE RESTRICT;


--
-- Name: media_files media_files_episode_id_episodes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_episode_id_episodes_id_fk FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE CASCADE;


--
-- Name: media_files media_files_installment_id_installments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_installment_id_installments_id_fk FOREIGN KEY (installment_id) REFERENCES public.installments(id) ON DELETE CASCADE;


--
-- Name: media_files media_files_library_root_id_library_roots_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_library_root_id_library_roots_id_fk FOREIGN KEY (library_root_id) REFERENCES public.library_roots(id) ON DELETE RESTRICT;


--
-- Name: media_tracks media_tracks_media_file_id_media_files_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_tracks
    ADD CONSTRAINT media_tracks_media_file_id_media_files_id_fk FOREIGN KEY (media_file_id) REFERENCES public.media_files(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_actor_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_account_id_fkey FOREIGN KEY (actor_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: organization_relations organization_relations_source_id_entities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_relations
    ADD CONSTRAINT organization_relations_source_id_entities_id_fk FOREIGN KEY (source_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: organization_relations organization_relations_target_id_entities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_relations
    ADD CONSTRAINT organization_relations_target_id_entities_id_fk FOREIGN KEY (target_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: review_reactions review_reactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_reactions
    ADD CONSTRAINT review_reactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: review_reactions review_reactions_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_reactions
    ADD CONSTRAINT review_reactions_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.title_reviews(id) ON DELETE CASCADE;


--
-- Name: saved_views saved_views_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_views
    ADD CONSTRAINT saved_views_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: source_evidence source_evidence_checked_by_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_evidence
    ADD CONSTRAINT source_evidence_checked_by_account_id_fkey FOREIGN KEY (checked_by_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: title_aliases title_aliases_title_id_titles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_aliases
    ADD CONSTRAINT title_aliases_title_id_titles_id_fk FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: title_comments title_comments_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_comments
    ADD CONSTRAINT title_comments_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: title_comments title_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_comments
    ADD CONSTRAINT title_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.title_comments(id) ON DELETE CASCADE;


--
-- Name: title_comments title_comments_parent_title_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_comments
    ADD CONSTRAINT title_comments_parent_title_fk FOREIGN KEY (parent_id, title_id) REFERENCES public.title_comments(id, title_id) ON DELETE CASCADE;


--
-- Name: title_comments title_comments_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_comments
    ADD CONSTRAINT title_comments_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: title_countries title_countries_title_id_titles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_countries
    ADD CONSTRAINT title_countries_title_id_titles_id_fk FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: title_countries title_countries_value_id_countries_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_countries
    ADD CONSTRAINT title_countries_value_id_countries_id_fk FOREIGN KEY (value_id) REFERENCES public.countries(id) ON DELETE RESTRICT;


--
-- Name: title_follows title_follows_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_follows
    ADD CONSTRAINT title_follows_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: title_follows title_follows_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_follows
    ADD CONSTRAINT title_follows_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: title_genres title_genres_title_id_titles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_genres
    ADD CONSTRAINT title_genres_title_id_titles_id_fk FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: title_genres title_genres_value_id_genres_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_genres
    ADD CONSTRAINT title_genres_value_id_genres_id_fk FOREIGN KEY (value_id) REFERENCES public.genres(id) ON DELETE RESTRICT;


--
-- Name: title_planets title_planets_planet_id_planets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_planets
    ADD CONSTRAINT title_planets_planet_id_planets_id_fk FOREIGN KEY (planet_id) REFERENCES public.planets(id) ON DELETE RESTRICT;


--
-- Name: title_planets title_planets_title_id_titles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_planets
    ADD CONSTRAINT title_planets_title_id_titles_id_fk FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: title_relations title_relations_source_title_id_titles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_relations
    ADD CONSTRAINT title_relations_source_title_id_titles_id_fk FOREIGN KEY (source_title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: title_relations title_relations_target_title_id_titles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_relations
    ADD CONSTRAINT title_relations_target_title_id_titles_id_fk FOREIGN KEY (target_title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: title_reviews title_reviews_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_reviews
    ADD CONSTRAINT title_reviews_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: title_reviews title_reviews_moderated_by_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_reviews
    ADD CONSTRAINT title_reviews_moderated_by_account_id_fkey FOREIGN KEY (moderated_by_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: title_reviews title_reviews_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_reviews
    ADD CONSTRAINT title_reviews_title_id_fkey FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: title_tags title_tags_title_id_titles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_tags
    ADD CONSTRAINT title_tags_title_id_titles_id_fk FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: title_tags title_tags_value_id_tags_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_tags
    ADD CONSTRAINT title_tags_value_id_tags_id_fk FOREIGN KEY (value_id) REFERENCES public.tags(id) ON DELETE RESTRICT;


--
-- Name: title_tones title_tones_title_id_titles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_tones
    ADD CONSTRAINT title_tones_title_id_titles_id_fk FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: title_tones title_tones_value_id_tones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_tones
    ADD CONSTRAINT title_tones_value_id_tones_id_fk FOREIGN KEY (value_id) REFERENCES public.tones(id) ON DELETE RESTRICT;


--
-- Name: title_trailers title_trailers_title_id_titles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_trailers
    ADD CONSTRAINT title_trailers_title_id_titles_id_fk FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- Name: title_trivia title_trivia_title_id_titles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.title_trivia
    ADD CONSTRAINT title_trivia_title_id_titles_id_fk FOREIGN KEY (title_id) REFERENCES public.titles(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

--> statement-breakpoint
-- Fresh installations get a new server identity and the controlled credit-role vocabulary.
-- Live adoption never executes these inserts.
INSERT INTO public.server_instance(singleton,name) VALUES(true,'Nahhasio');
INSERT INTO public.roles(id,slug,label_en,label_ar,entity_kind,position)
SELECT id,slug,label_en,label_ar,entity_kind,position
FROM jsonb_populate_recordset(NULL::public.roles,'[{"id":"eb7a30c8-f6a1-41dc-808e-7893fe3b2315","slug":"creator","label_en":"Creator","label_ar":"منشئ","entity_kind":"person","position":0},{"id":"38a52b39-c2e7-4102-8fbe-042971178d3f","slug":"original_author","label_en":"Original author","label_ar":"مؤلف أصلي","entity_kind":"person","position":1},{"id":"723df589-4cd0-40df-a51e-a1cc127bf711","slug":"director","label_en":"Director","label_ar":"مخرج","entity_kind":"person","position":2},{"id":"50a72f6a-f1c3-4477-83e6-da7ec3f63375","slug":"writer","label_en":"Writer","label_ar":"كاتب","entity_kind":"person","position":3},{"id":"0e1c0901-d112-4e92-86e6-fe8791a47333","slug":"producer","label_en":"Producer","label_ar":"منتج","entity_kind":"person","position":4},{"id":"a3a8b58e-8fb5-4f23-8e73-d7b0fdfc0de3","slug":"executive_producer","label_en":"Executive producer","label_ar":"منتج تنفيذي","entity_kind":"person","position":5},{"id":"2088f4d5-54f8-4e85-9daa-973f260da74a","slug":"creative_producer","label_en":"Creative producer","label_ar":"منتج إبداعي","entity_kind":"person","position":6},{"id":"3e6d15fc-ca16-4968-8efa-aaf8c6df3b69","slug":"character_designer","label_en":"Character designer","label_ar":"مصمم شخصيات","entity_kind":"person","position":7},{"id":"d0564180-5578-437b-9ff3-66bc7abc8783","slug":"art_director","label_en":"Art director","label_ar":"مدير فني","entity_kind":"person","position":8},{"id":"41904b30-3994-4fe3-8693-ef233c85bd62","slug":"scene_design","label_en":"Scene design","label_ar":"تصميم المشاهد","entity_kind":"person","position":9},{"id":"1b4d53c2-5a0f-4c0a-b781-4b5ea3e9504e","slug":"composer","label_en":"Composer","label_ar":"ملحن","entity_kind":"person","position":10},{"id":"bb2f1d94-4957-4d5b-8214-4b6211e4d2a6","slug":"animation_studio","label_en":"Animation studio","label_ar":"استوديو رسوم متحركة","entity_kind":"organization","position":11},{"id":"953da2f4-21c9-45a9-bdf2-f59d250b31da","slug":"production_company","label_en":"Production company","label_ar":"شركة إنتاج","entity_kind":"organization","position":12},{"id":"c67be19e-e45e-4fb3-b022-d0867d4d6f8d","slug":"distributor","label_en":"Distributor","label_ar":"موزع","entity_kind":"organization","position":13},{"id":"f19a4802-9258-4473-9ea0-d7c7848453fa","slug":"publisher","label_en":"Publisher","label_ar":"ناشر","entity_kind":"organization","position":14},{"id":"a09c4671-71d9-4a7b-bd26-0a2b8941ce14","slug":"dubbing_studio","label_en":"Dubbing studio","label_ar":"استوديو الدبلجة","entity_kind":"organization","position":15}]'::jsonb);
