-- Custom display names for territory zones (Sheisters may name unnamed zones once).

CREATE TABLE IF NOT EXISTS zone_names (
  zone_id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 40),
  named_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE zone_names ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read zone names" ON zone_names;
CREATE POLICY "Authenticated users can read zone names"
  ON zone_names FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON zone_names TO authenticated;
GRANT ALL ON zone_names TO service_role;

CREATE OR REPLACE FUNCTION name_unnamed_zone(p_zone_id TEXT, p_name TEXT)
RETURNS void AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_trimmed_name TEXT := trim(p_name);
  v_is_sheister BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_trimmed_name IS NULL OR char_length(v_trimmed_name) < 1 OR char_length(v_trimmed_name) > 40 THEN
    RAISE EXCEPTION 'Zone name must be 1-40 characters';
  END IF;

  IF EXISTS (SELECT 1 FROM zone_names WHERE zone_id = p_zone_id) THEN
    RAISE EXCEPTION 'Zone already has a name';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM get_zone_captains() c
    WHERE c.zone_id = p_zone_id
      AND c.captain_user_id = v_user_id
  ) INTO v_is_sheister;

  IF NOT v_is_sheister THEN
    RAISE EXCEPTION 'Only the zone sheister can name this zone';
  END IF;

  INSERT INTO zone_names (zone_id, name, named_by)
  VALUES (p_zone_id, v_trimmed_name, v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION name_unnamed_zone(TEXT, TEXT) TO authenticated;
