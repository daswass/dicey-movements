-- Return every durable claim owned by the current Sheister.
-- This is intentionally independent of the viewport so the owned-zone list never disappears
-- when the map is zoomed out or panned away from an owned territory.

CREATE OR REPLACE FUNCTION public.get_my_zone_captains()
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
  WHERE z.sheister_user_id = auth.uid()
  GROUP BY z.zone_id, z.sheister_user_id, p.username
  ORDER BY z.updated_at DESC, z.zone_id;
$$;

REVOKE ALL ON FUNCTION public.get_my_zone_captains() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_zone_captains() TO authenticated, service_role;
