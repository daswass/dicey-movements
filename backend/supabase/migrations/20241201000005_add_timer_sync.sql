-- Add timer sync columns to profiles table
ALTER TABLE profiles ADD COLUMN timer_master_device_id TEXT;
ALTER TABLE profiles ADD COLUMN timer_start_time TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN timer_last_updated TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for efficient queries
CREATE INDEX idx_profiles_timer_master ON profiles(timer_master_device_id);
CREATE INDEX idx_profiles_timer_start ON profiles(timer_start_time);
CREATE INDEX idx_profiles_timer_updated ON profiles(timer_last_updated); 