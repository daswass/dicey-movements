-- accept_friend_request_transaction function
-- Accepts an incoming friend request and creates a reciprocal accepted entry.
CREATE OR REPLACE FUNCTION accept_friend_request_transaction(
  friendship_record_id UUID, -- The ID of the existing pending request to update
  current_user_id UUID,     -- The ID of the user accepting (friend_id in the existing record)
  requester_id UUID         -- The ID of the user who sent the request (user_id in the existing record)
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Check if the request exists and is pending, and is indeed for the current_user_id
  IF NOT EXISTS (
    SELECT 1 FROM friends
    WHERE id = friendship_record_id
      AND friend_id = current_user_id
      AND user_id = requester_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Friend request not found, not pending, or not for this user.';
  END IF;

  -- Start transaction
  BEGIN
    -- 1. Update the status of the incoming request to 'accepted'
    UPDATE friends
    SET status = 'accepted'
    WHERE id = friendship_record_id;

    -- 2. Create a reciprocal 'accepted' entry from the current_user_id to the requester_id
    -- This ensures the relationship is represented from both sides.
    INSERT INTO friends (user_id, friend_id, status)
    VALUES (current_user_id, requester_id, 'accepted');

  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Transaction failed: %', SQLERRM;
  END;
END;
$$;

-- Grant execution privileges (replace 'authenticated' with your appropriate role)
GRANT EXECUTE ON FUNCTION accept_friend_request_transaction TO authenticated;