-- Zone Competition: territorial rep battles on a geographic grid
-- Zones are ~2km grid cells derived from lat/lng at activity completion time.
-- Zone Captain = user with the most reps in a zone over the rolling last 7 days.

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS zone_id TEXT;

CREATE INDEX IF NOT EXISTS idx_activities_zone_id_timestamp
  ON activities(zone_id, timestamp DESC)
  WHERE zone_id IS NOT NULL;

-- Returns the current Zone Captain for every active zone (last 7 days).
CREATE OR REPLACE FUNCTION get_zone_captains()
RETURNS TABLE (
  zone_id TEXT,
  captain_user_id UUID,
  captain_username TEXT,
  total_reps BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH weekly_scores AS (
    SELECT
      a.zone_id,
      a.user_id,
      SUM(a.reps)::BIGINT AS total_reps
    FROM activities a
    WHERE a.zone_id IS NOT NULL
      AND a.timestamp >= NOW() - INTERVAL '7 days'
    GROUP BY a.zone_id, a.user_id
  ),
  ranked AS (
    SELECT
      ws.zone_id,
      ws.user_id,
      ws.total_reps,
      ROW_NUMBER() OVER (PARTITION BY ws.zone_id ORDER BY ws.total_reps DESC) AS rank
    FROM weekly_scores ws
  )
  SELECT
    r.zone_id,
    r.user_id AS captain_user_id,
    p.username AS captain_username,
    r.total_reps
  FROM ranked r
  JOIN profiles p ON p.id = r.user_id
  WHERE r.rank = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_zone_captains() TO authenticated, service_role;
