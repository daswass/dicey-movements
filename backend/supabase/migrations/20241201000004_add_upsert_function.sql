-- Create upsert function for push subscriptions
CREATE OR REPLACE FUNCTION upsert_push_subscription(
  p_user_id UUID,
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_device_id TEXT,
  p_device_type TEXT,
  p_browser TEXT,
  p_platform TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    device_id,
    device_type,
    browser,
    platform,
    last_active,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    p_device_id,
    p_device_type,
    p_browser,
    p_platform,
    NOW(),
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, device_id) DO UPDATE SET
    endpoint = EXCLUDED.endpoint,
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    device_type = EXCLUDED.device_type,
    browser = EXCLUDED.browser,
    platform = EXCLUDED.platform,
    last_active = NOW(),
    is_active = true,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql; 