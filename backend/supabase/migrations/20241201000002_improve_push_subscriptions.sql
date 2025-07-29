-- Improve push_subscriptions table for multi-device support
-- Add device identification and management fields

-- Add new columns to push_subscriptions table
ALTER TABLE push_subscriptions 
ADD COLUMN IF NOT EXISTS device_id TEXT,
ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS browser TEXT,
ADD COLUMN IF NOT EXISTS platform TEXT,
ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index for device_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device_id ON push_subscriptions(device_id);

-- Create index for last_active for cleanup queries
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_last_active ON push_subscriptions(last_active);

-- Create index for is_active for filtering
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_is_active ON push_subscriptions(is_active);

-- Update the unique constraint to include device_id
-- First drop the old constraint
ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_endpoint_key;

-- Add new unique constraint
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_user_device_unique 
UNIQUE(user_id, device_id);

-- Create a function to clean up old inactive subscriptions
CREATE OR REPLACE FUNCTION cleanup_inactive_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM push_subscriptions 
  WHERE last_active < NOW() - INTERVAL '30 days' 
    AND is_active = false;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to mark subscriptions as inactive
CREATE OR REPLACE FUNCTION mark_subscription_inactive(user_id UUID, device_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE push_subscriptions 
  SET is_active = false, last_active = NOW()
  WHERE push_subscriptions.user_id = mark_subscription_inactive.user_id 
    AND push_subscriptions.device_id = mark_subscription_inactive.device_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update subscription activity
CREATE OR REPLACE FUNCTION update_subscription_activity(user_id UUID, device_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE push_subscriptions 
  SET last_active = NOW(), is_active = true
  WHERE push_subscriptions.user_id = update_subscription_activity.user_id 
    AND push_subscriptions.device_id = update_subscription_activity.device_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql; 