-- Recover effects abandoned by a backend restart without allowing a stale worker to finish a newer lease.

ALTER TABLE public.workout_completion_effects
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

-- The original functions returned a one-shot boolean and cannot change their return/argument
-- signatures in place. Recreate them with a caller-supplied lease token instead.
DROP FUNCTION IF EXISTS public.claim_workout_completion_effects(uuid);
DROP FUNCTION IF EXISTS public.finish_workout_completion_effects(uuid);

CREATE FUNCTION public.claim_workout_completion_effects(
  p_activity_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer DEFAULT 300
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'lease duration must be between 1 and 3600 seconds';
  END IF;

  UPDATE public.workout_completion_effects
  SET status = 'processing',
      lease_token = p_lease_token,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  WHERE activity_id = p_activity_id
    AND (
      status = 'pending'
      OR (status = 'processing' AND lease_expires_at <= now())
    );
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.finish_workout_completion_effects(
  p_activity_id uuid,
  p_lease_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.workout_completion_effects
  SET status = 'completed',
      completed_at = now(),
      lease_token = NULL,
      lease_expires_at = NULL
  WHERE activity_id = p_activity_id
    AND status = 'processing'
    AND lease_token = p_lease_token;
END;
$$;

CREATE FUNCTION public.list_recoverable_workout_completion_effects(p_limit integer DEFAULT 100)
RETURNS TABLE (activity jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT to_jsonb(a)
  FROM public.workout_completion_effects AS e
  JOIN public.activities AS a ON a.id = e.activity_id
  WHERE e.status = 'pending'
     OR (e.status = 'processing' AND e.lease_expires_at <= now())
  ORDER BY e.created_at
  LIMIT LEAST(GREATEST(p_limit, 1), 1000);
$$;

REVOKE ALL ON FUNCTION public.claim_workout_completion_effects(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_workout_completion_effects(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_recoverable_workout_completion_effects(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_workout_completion_effects(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_workout_completion_effects(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_recoverable_workout_completion_effects(integer) TO service_role;
