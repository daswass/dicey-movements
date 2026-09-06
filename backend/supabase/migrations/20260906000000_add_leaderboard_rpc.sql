-- Aggregate leaderboard data in Postgres so the client never downloads raw activity history.
CREATE INDEX IF NOT EXISTS idx_activities_timestamp_user_id
  ON public.activities (timestamp, user_id);

-- oura_activities already has UNIQUE (user_id, date); this index supports date-range scans.
CREATE INDEX IF NOT EXISTS idx_oura_activities_date_user_id
  ON public.oura_activities (date, user_id);

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_metric text,
  p_time_range text
)
RETURNS TABLE (
  user_id uuid,
  username text,
  score bigint,
  location text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now timestamptz := statement_timestamp();
  v_start_timestamp timestamptz;
  v_start_date date;
  v_end_date date := (v_now AT TIME ZONE 'UTC')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_metric IS NULL OR p_metric NOT IN ('totalReps', 'totalSets', 'totalSteps') THEN
    RAISE EXCEPTION 'invalid leaderboard metric: %', p_metric USING ERRCODE = '22023';
  END IF;

  IF p_time_range IS NULL OR p_time_range NOT IN ('day', 'week', 'month', 'all') THEN
    RAISE EXCEPTION 'invalid leaderboard time range: %', p_time_range USING ERRCODE = '22023';
  END IF;

  IF p_metric = 'totalSteps' THEN
    v_start_date := CASE p_time_range
      WHEN 'day' THEN v_end_date
      WHEN 'week' THEN (v_now - interval '7 days')::date
      WHEN 'month' THEN (v_now - interval '1 month')::date
      WHEN 'all' THEN NULL
    END;

    RETURN QUERY
    SELECT
      oa.user_id,
      COALESCE(p.username, 'Unknown User')::text AS username,
      SUM(oa.steps)::bigint AS score,
      COALESCE(p.location ->> 'city', 'Unknown')::text AS location
    FROM public.oura_activities AS oa
    LEFT JOIN public.profiles AS p ON p.id = oa.user_id
    WHERE (v_start_date IS NULL OR oa.date >= v_start_date)
      AND oa.date <= v_end_date
    GROUP BY oa.user_id, p.username, p.location ->> 'city'
    HAVING SUM(oa.steps) > 0
    ORDER BY score DESC, oa.user_id;
  ELSE
    v_start_timestamp := CASE p_time_range
      WHEN 'day' THEN v_now - interval '1 day'
      WHEN 'week' THEN v_now - interval '7 days'
      WHEN 'month' THEN v_now - interval '1 month'
      WHEN 'all' THEN NULL
    END;

    RETURN QUERY
    SELECT
      a.user_id,
      COALESCE(p.username, 'Unknown User')::text AS username,
      CASE p_metric
        WHEN 'totalReps' THEN SUM(a.reps)::bigint
        ELSE COUNT(*)::bigint
      END AS score,
      COALESCE(p.location ->> 'city', 'Unknown')::text AS location
    FROM public.activities AS a
    LEFT JOIN public.profiles AS p ON p.id = a.user_id
    WHERE v_start_timestamp IS NULL OR a.timestamp >= v_start_timestamp
    GROUP BY a.user_id, p.username, p.location ->> 'city'
    ORDER BY score DESC, a.user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_leaderboard(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, text) TO service_role;
