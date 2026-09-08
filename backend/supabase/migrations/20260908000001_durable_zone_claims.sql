-- Durable Dicey zone ownership.
-- Ownership persists after rolling-7-day reps decay to zero. New activity recalibrates only
-- that activity's zone; the incumbent retains ties and a challenger needs strictly more reps.

CREATE TABLE IF NOT EXISTS public.zone_claims (
  zone_id text PRIMARY KEY CHECK (zone_id ~ '^-?[0-9]+_-?[0-9]+$'),
  lat_index integer NOT NULL,
  lng_index integer NOT NULL,
  sheister_user_id uuid NOT NULL REFERENCES public.profiles(id),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_zone_claims_viewport
  ON public.zone_claims (lat_index, lng_index);
CREATE INDEX IF NOT EXISTS idx_zone_claims_sheister
  ON public.zone_claims (sheister_user_id);
CREATE INDEX IF NOT EXISTS idx_activities_zone_timestamp_user
  ON public.activities (zone_id, timestamp DESC, user_id)
  WHERE zone_id IS NOT NULL;

-- The owning transaction takes a zone-scoped advisory lock, so simultaneous workouts in one
-- zone are ranked against the same committed activity set before ownership is persisted.
CREATE OR REPLACE FUNCTION public.recalculate_zone_claim(p_zone_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_lat_index integer;
  v_lng_index integer;
  v_incumbent_user_id uuid;
  v_incumbent_score bigint := 0;
  v_challenger_user_id uuid;
  v_challenger_score bigint := 0;
  v_latest_activity_at timestamptz;
BEGIN
  IF p_zone_id IS NULL OR p_zone_id !~ '^-?[0-9]+_-?[0-9]+$' THEN
    RETURN;
  END IF;

  v_lat_index := split_part(p_zone_id, '_', 1)::integer;
  v_lng_index := split_part(p_zone_id, '_', 2)::integer;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_zone_id, 0));

  SELECT sheister_user_id
  INTO v_incumbent_user_id
  FROM public.zone_claims
  WHERE zone_id = p_zone_id
  FOR UPDATE;

  SELECT user_id, total_reps
  INTO v_challenger_user_id, v_challenger_score
  FROM (
    SELECT a.user_id, SUM(a.reps)::bigint AS total_reps
    FROM public.activities AS a
    WHERE a.zone_id = p_zone_id
      AND a.timestamp >= statement_timestamp() - interval '7 days'
    GROUP BY a.user_id
    ORDER BY total_reps DESC, a.user_id
    LIMIT 1
  ) AS leader;

  SELECT COALESCE(SUM(a.reps), 0)::bigint
  INTO v_incumbent_score
  FROM public.activities AS a
  WHERE a.zone_id = p_zone_id
    AND a.user_id = v_incumbent_user_id
    AND a.timestamp >= statement_timestamp() - interval '7 days';

  SELECT MAX(a.timestamp)
  INTO v_latest_activity_at
  FROM public.activities AS a
  WHERE a.zone_id = p_zone_id;

  IF v_incumbent_user_id IS NULL THEN
    -- First durable claim (including the migration seed): deterministic only when no incumbent
    -- exists. Afterward, ties never displace the recorded sheister.
    IF v_challenger_user_id IS NOT NULL THEN
      INSERT INTO public.zone_claims (
        zone_id, lat_index, lng_index, sheister_user_id, last_activity_at
      ) VALUES (
        p_zone_id, v_lat_index, v_lng_index, v_challenger_user_id, v_latest_activity_at
      );
    END IF;
    RETURN;
  END IF;

  UPDATE public.zone_claims
  SET
    sheister_user_id = CASE
      WHEN v_challenger_user_id IS NOT NULL
        AND v_challenger_user_id <> v_incumbent_user_id
        AND v_challenger_score > v_incumbent_score
      THEN v_challenger_user_id
      ELSE sheister_user_id
    END,
    updated_at = now(),
    last_activity_at = GREATEST(last_activity_at, v_latest_activity_at)
  WHERE zone_id = p_zone_id;
END;
$$;

-- Seed only zones with current rolling-7-day activity. Existing durable rows are never replaced.
-- UUID ordering makes first-install ties deterministic; all later ties retain the incumbent.
WITH weekly_scores AS (
  SELECT a.zone_id, a.user_id, SUM(a.reps)::bigint AS total_reps, MAX(a.timestamp) AS last_activity_at
  FROM public.activities AS a
  WHERE a.zone_id ~ '^-?[0-9]+_-?[0-9]+$'
    AND a.timestamp >= statement_timestamp() - interval '7 days'
  GROUP BY a.zone_id, a.user_id
), ranked AS (
  SELECT
    zone_id,
    user_id,
    last_activity_at,
    ROW_NUMBER() OVER (PARTITION BY zone_id ORDER BY total_reps DESC, user_id) AS rank
  FROM weekly_scores
)
INSERT INTO public.zone_claims (
  zone_id, lat_index, lng_index, sheister_user_id, last_activity_at
)
SELECT
  zone_id,
  split_part(zone_id, '_', 1)::integer,
  split_part(zone_id, '_', 2)::integer,
  user_id,
  last_activity_at
FROM ranked
WHERE rank = 1
ON CONFLICT (zone_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.refresh_zone_claim_after_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.zone_id IS NOT NULL THEN
    PERFORM public.recalculate_zone_claim(NEW.zone_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activities_refresh_zone_claim ON public.activities;
CREATE TRIGGER activities_refresh_zone_claim
AFTER INSERT ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.refresh_zone_claim_after_activity();

-- Viewport RPC is deliberately bounded: the client must zoom in rather than loading every claim.
CREATE OR REPLACE FUNCTION public.get_zone_captains_in_viewport(
  p_min_lat_index integer,
  p_max_lat_index integer,
  p_min_lng_index integer,
  p_max_lng_index integer
)
RETURNS TABLE (
  zone_id text,
  captain_user_id uuid,
  captain_username text,
  total_reps bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_min_lat_index > p_max_lat_index OR p_min_lng_index > p_max_lng_index
    OR p_max_lat_index - p_min_lat_index + 1 > 150
    OR p_max_lng_index - p_min_lng_index + 1 > 150
    OR (p_max_lat_index - p_min_lat_index + 1) * (p_max_lng_index - p_min_lng_index + 1) > 10000 THEN
    RAISE EXCEPTION 'viewport is too large; zoom in to load zone claims' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    z.zone_id,
    z.sheister_user_id,
    COALESCE(p.username, 'Unknown')::text,
    COALESCE((
      SELECT SUM(a.reps)::bigint
      FROM public.activities AS a
      WHERE a.zone_id = z.zone_id
        AND a.user_id = z.sheister_user_id
        AND a.timestamp >= statement_timestamp() - interval '7 days'
    ), 0)::bigint
  FROM public.zone_claims AS z
  LEFT JOIN public.profiles AS p ON p.id = z.sheister_user_id
  WHERE z.lat_index BETWEEN p_min_lat_index AND p_max_lat_index
    AND z.lng_index BETWEEN p_min_lng_index AND p_max_lng_index
  ORDER BY z.lat_index, z.lng_index;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_zone_captain(p_zone_id text)
RETURNS TABLE (
  zone_id text,
  captain_user_id uuid,
  captain_username text,
  total_reps bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    z.zone_id,
    z.sheister_user_id,
    COALESCE(p.username, 'Unknown')::text,
    COALESCE(SUM(a.reps) FILTER (
      WHERE a.timestamp >= statement_timestamp() - interval '7 days'
    ), 0)::bigint AS total_reps
  FROM public.zone_claims AS z
  LEFT JOIN public.profiles AS p ON p.id = z.sheister_user_id
  LEFT JOIN public.activities AS a
    ON a.zone_id = z.zone_id
    AND a.user_id = z.sheister_user_id
  WHERE z.zone_id = p_zone_id
  GROUP BY z.zone_id, z.sheister_user_id, p.username;
$$;

-- Zone names remain an ownership privilege even after a captain has no recent activity.
CREATE OR REPLACE FUNCTION public.name_unnamed_zone(p_zone_id text, p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_trimmed_name text := trim(p_name);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_trimmed_name IS NULL OR char_length(v_trimmed_name) < 1 OR char_length(v_trimmed_name) > 40 THEN
    RAISE EXCEPTION 'Zone name must be 1-40 characters' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.zone_names WHERE zone_id = p_zone_id) THEN
    RAISE EXCEPTION 'Zone already has a name';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.zone_claims
    WHERE zone_id = p_zone_id AND sheister_user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Only the zone sheister can name this zone' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.zone_names (zone_id, name, named_by)
  VALUES (p_zone_id, v_trimmed_name, v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_zone_claim(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_zone_captains_in_viewport(integer, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_zone_captain(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_zone_captains_in_viewport(integer, integer, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_zone_captain(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_zone_claim(text) TO service_role;

-- The legacy all-world RPC is not a valid map data source after this migration.
DO $$
BEGIN
  IF to_regprocedure('public.get_zone_captains()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_zone_captains() FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.get_zone_captains() FROM authenticated;
    REVOKE ALL ON FUNCTION public.get_zone_captains() FROM service_role;
  END IF;
END;
$$;
