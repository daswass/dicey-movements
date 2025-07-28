-- Add notification settings to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
  "timer_expired": true,
  "achievements": false,
  "friend_activity": false,
  "friend_requests": false
}'::jsonb;

-- Create a function to update notification settings
CREATE OR REPLACE FUNCTION update_notification_settings(
  user_id UUID,
  setting_key TEXT,
  setting_value BOOLEAN
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE profiles 
  SET notification_settings = jsonb_set(
    COALESCE(notification_settings, '{}'::jsonb),
    ARRAY[setting_key],
    to_jsonb(setting_value)
  )
  WHERE id = user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get notification settings
CREATE OR REPLACE FUNCTION get_notification_settings(user_id UUID)
RETURNS JSONB AS $$
BEGIN
  RETURN COALESCE(
    (SELECT notification_settings FROM profiles WHERE id = user_id),
    '{"timer_expired": true, "achievements": false, "friend_activity": false, "friend_requests": false}'::jsonb
  );
END;
$$ LANGUAGE plpgsql; 