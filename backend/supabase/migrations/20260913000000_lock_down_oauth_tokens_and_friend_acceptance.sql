-- Security hardening: OAuth credentials stay server-owned and friend-request acceptance
-- derives authority from the authenticated session rather than caller-controlled parameters.

-- Oura access/refresh tokens are only used by the service-role backend.
DROP POLICY IF EXISTS "Users can view their own Oura tokens" ON public.oura_tokens;
DROP POLICY IF EXISTS "Users can insert their own Oura tokens" ON public.oura_tokens;
DROP POLICY IF EXISTS "Users can update their own Oura tokens" ON public.oura_tokens;
DROP POLICY IF EXISTS "Users can delete their own Oura tokens" ON public.oura_tokens;

REVOKE ALL ON TABLE public.oura_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.oura_tokens TO service_role;

-- Replace the unsafe legacy RPC. It used caller-supplied user IDs under SECURITY DEFINER.
DROP FUNCTION IF EXISTS public.accept_friend_request_transaction(uuid, uuid, uuid);

CREATE FUNCTION public.accept_friend_request_transaction(p_friendship_record_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  request_row public.friends%ROWTYPE;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO request_row
  FROM public.friends
  WHERE id = p_friendship_record_id
  FOR UPDATE;

  IF NOT FOUND
    OR request_row.friend_id <> actor_id
    OR request_row.status <> 'pending' THEN
    RAISE EXCEPTION 'friend request not found or no longer pending' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.friends
  SET status = 'accepted'
  WHERE id = request_row.id;

  INSERT INTO public.friends (user_id, friend_id, status)
  SELECT actor_id, request_row.user_id, 'accepted'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.friends
    WHERE user_id = actor_id
      AND friend_id = request_row.user_id
      AND status = 'accepted'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_friend_request_transaction(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_friend_request_transaction(uuid) TO authenticated;
