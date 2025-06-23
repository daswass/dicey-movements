-- Run all streak-related migrations
-- This script should be run in order to set up the streak functionality

-- 1. Update stats structure
\i update_stats_structure.sql

-- 2. Create streak update function
\i update_streak_function.sql

-- 3. Create activity trigger
\i activity_streak_trigger.sql

-- 4. Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_user_streak(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trigger_update_streak() TO authenticated, service_role; 