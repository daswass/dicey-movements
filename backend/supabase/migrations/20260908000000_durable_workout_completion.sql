-- Server-owned, idempotent workout completion.
-- The activity UUID is generated once by the client when dice are rolled and is the idempotency key.

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS zone_id text;

CREATE TABLE IF NOT EXISTS public.workout_completion_effects (
  activity_id uuid PRIMARY KEY REFERENCES public.activities(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE OR REPLACE FUNCTION public.record_workout_completion(
  p_activity_id uuid,
  p_user_id uuid,
  p_timestamp timestamptz,
  p_exercise_id integer,
  p_exercise_name text,
  p_reps integer,
  p_multiplier integer,
  p_dice_roll jsonb,
  p_zone_id text
)
RETURNS TABLE (activity jsonb, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  inserted_activity public.activities%ROWTYPE;
BEGIN
  INSERT INTO public.activities (
    id, user_id, timestamp, exercise_id, exercise_name, reps, multiplier, dice_roll, zone_id
  ) VALUES (
    p_activity_id, p_user_id, p_timestamp, p_exercise_id, p_exercise_name, p_reps,
    p_multiplier, p_dice_roll, p_zone_id
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO inserted_activity;

  IF FOUND THEN
    INSERT INTO public.workout_completion_effects (activity_id)
    VALUES (inserted_activity.id)
    ON CONFLICT (activity_id) DO NOTHING;
    RETURN QUERY SELECT to_jsonb(inserted_activity), true;
    RETURN;
  END IF;

  SELECT * INTO inserted_activity
  FROM public.activities
  WHERE id = p_activity_id;

  -- A UUID cannot be used to inspect or replay another user's activity.
  IF NOT FOUND OR inserted_activity.user_id <> p_user_id THEN
    RAISE EXCEPTION 'activity id is already owned by another user' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT to_jsonb(inserted_activity), false;
END;
$$;

-- Claims are intentionally one-shot. A duplicate HTTP retry sees false and never emits effects.
CREATE OR REPLACE FUNCTION public.claim_workout_completion_effects(p_activity_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.workout_completion_effects
  SET status = 'processing'
  WHERE activity_id = p_activity_id AND status = 'pending';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_workout_completion_effects(p_activity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.workout_completion_effects
  SET status = 'completed', completed_at = now()
  WHERE activity_id = p_activity_id AND status = 'processing';
END;
$$;

REVOKE ALL ON FUNCTION public.record_workout_completion(uuid, uuid, timestamptz, integer, text, integer, integer, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_workout_completion_effects(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_workout_completion_effects(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_workout_completion(uuid, uuid, timestamptz, integer, text, integer, integer, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_workout_completion_effects(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_workout_completion_effects(uuid) TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.workout_completion_effects TO service_role;
