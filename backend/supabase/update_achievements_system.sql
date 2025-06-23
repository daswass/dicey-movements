-- Update achievements system migration
-- This ensures the achievements system works properly with existing data

-- First, ensure all profiles have the achievements array in their stats
UPDATE profiles 
SET stats = jsonb_build_object(
    'streak', COALESCE(stats->>'streak', '0')::int,
    'longestStreak', COALESCE(stats->>'longestStreak', '0')::int,
    'achievements', COALESCE(stats->'achievements', '[]'::jsonb)
)
WHERE stats IS NULL OR stats->'achievements' IS NULL;

-- Update the default value for new profiles to include achievements
ALTER TABLE profiles 
ALTER COLUMN stats SET DEFAULT '{"streak": 0, "longestStreak": 0, "achievements": []}'::jsonb;

-- Ensure activities table has the dice_roll column for perfect roll tracking
-- This is already created in the activities table, but let's make sure it's properly typed
ALTER TABLE activities 
ALTER COLUMN dice_roll TYPE jsonb USING dice_roll::jsonb;

-- Add index for better performance on achievement checking
CREATE INDEX IF NOT EXISTS idx_activities_user_id_timestamp 
ON activities(user_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_activities_exercise_id 
ON activities(exercise_id);

-- Add index for friend count queries
CREATE INDEX IF NOT EXISTS idx_friends_user_id_status 
ON friends(user_id, status);

-- Add index for Oura activities queries
CREATE INDEX IF NOT EXISTS idx_oura_activities_user_id_date 
ON oura_activities(user_id, date);

-- Grant necessary permissions
GRANT SELECT, UPDATE ON profiles TO authenticated, service_role;
GRANT SELECT ON activities TO authenticated, service_role;
GRANT SELECT ON friends TO authenticated, service_role;
GRANT SELECT ON oura_activities TO authenticated, service_role; 