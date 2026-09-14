-- Durable post-completion zone attachment.
-- The backend is the only caller. This function performs authorization and a row-level
-- compare-and-set so a delayed location fix can be retried without replacing a prior zone.

CREATE OR REPLACE FUNCTION public.attach_activity_zone(
  p_activity_id uuid,
  p_user_id uuid,
  p_zone_id text
)
RETURNS TABLE (activity jsonb, attached boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_activity public.activities%ROWTYPE;
BEGIN
  IF p_zone_id IS NULL
    OR char_length(p_zone_id) > 32
    OR p_zone_id !~ '^-?[0-9]+_-?[0-9]+$' THEN
    RAISE EXCEPTION 'zoneId must be a valid zone identifier' USING ERRCODE = '22023';
  END IF;
  IF split_part(p_zone_id, '_', 1)::numeric NOT BETWEEN -4500 AND 4500
    OR split_part(p_zone_id, '_', 2)::numeric NOT BETWEEN -9000 AND 9000 THEN
    RAISE EXCEPTION 'zoneId must be a valid zone identifier' USING ERRCODE = '22023';
  END IF;

  -- The lock serializes same-activity retries: one request may attach, a same-zone retry is a
  -- no-op, and a concurrent different-zone request observes the durable conflict.
  SELECT * INTO v_activity
  FROM public.activities
  WHERE id = p_activity_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity not found or not owned by user' USING ERRCODE = '42501';
  END IF;

  IF v_activity.zone_id IS NOT NULL THEN
    IF v_activity.zone_id = p_zone_id THEN
      RETURN QUERY SELECT to_jsonb(v_activity), false;
      RETURN;
    END IF;
    RAISE EXCEPTION 'activity zone is already attached' USING ERRCODE = '23505';
  END IF;

  UPDATE public.activities
  SET zone_id = p_zone_id
  WHERE id = p_activity_id
  RETURNING * INTO v_activity;

  -- activities_refresh_zone_claim_on_zone_attach invokes the same fail-open recalculation
  -- function used for inserts. It executes in this transaction, after the zone is visible.
  RETURN QUERY SELECT to_jsonb(v_activity), true;
END;
$$;

-- Attaching a previously null zone is semantically the same claim input as inserting an
-- activity with that zone. Deliberately trigger only on null -> non-null; idempotent retries
-- return above without UPDATE, and the RPC forbids changing an existing value.
DROP TRIGGER IF EXISTS activities_refresh_zone_claim_on_zone_attach ON public.activities;
CREATE TRIGGER activities_refresh_zone_claim_on_zone_attach
AFTER UPDATE OF zone_id ON public.activities
FOR EACH ROW
WHEN (OLD.zone_id IS NULL AND NEW.zone_id IS NOT NULL)
EXECUTE FUNCTION public.refresh_zone_claim_after_activity();

REVOKE ALL ON FUNCTION public.attach_activity_zone(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_activity_zone(uuid, uuid, text) TO service_role;
