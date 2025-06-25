-- Run timezone-related migrations
-- This script should be run to add timezone support to the streak system

-- 1. Add timezone to location field
\i add_timezone_to_location.sql

-- 2. Update streak function to use timezone
\i update_streak_function.sql

-- 3. Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_user_streak(UUID) TO authenticated, service_role;

-- 4. Update existing user streaks to use their timezone
-- This will recalculate streaks for all users with their timezone
SELECT update_user_streak(id) FROM profiles; 