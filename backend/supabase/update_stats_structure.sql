-- Update stats structure to remove totalReps and totalSets, add longestStreak
-- This migration updates the default stats JSONB structure in the profiles table

-- First, update existing profiles to have the new stats structure
UPDATE profiles 
SET stats = jsonb_build_object(
    'streak', COALESCE(stats->>'streak', '0')::int,
    'longestStreak', COALESCE(stats->>'longestStreak', '0')::int,
    'achievements', COALESCE(stats->'achievements', '[]'::jsonb)
)
WHERE stats IS NOT NULL;

-- Update the default value for new profiles
ALTER TABLE profiles 
ALTER COLUMN stats SET DEFAULT '{"streak": 0, "longestStreak": 0, "achievements": []}'::jsonb; 