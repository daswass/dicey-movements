-- Function to calculate and update user streak
-- This function should be called after a new activity is inserted

CREATE OR REPLACE FUNCTION update_user_streak(user_id_param UUID)
RETURNS VOID AS $$
DECLARE
    current_streak INTEGER := 0;
    longest_streak INTEGER := 0;
    last_activity_date DATE := NULL;
    activity_date DATE;
    consecutive_days INTEGER := 0;
    current_date DATE := CURRENT_DATE;
    check_date DATE;
    user_timezone TEXT := 'UTC';
    user_current_date DATE;
BEGIN
    -- Get current streak and longest streak from profile
    SELECT 
        COALESCE((stats->>'streak')::INTEGER, 0),
        COALESCE((stats->>'longestStreak')::INTEGER, 0),
        COALESCE(location->>'timezone', 'UTC')
    INTO current_streak, longest_streak, user_timezone
    FROM profiles 
    WHERE id = user_id_param;

    -- Get current date in user's timezone
    user_current_date := (NOW() AT TIME ZONE user_timezone)::DATE;

    -- Get the most recent activity date in user's timezone
    SELECT MAX((timestamp AT TIME ZONE user_timezone)::DATE)
    INTO last_activity_date
    FROM activities 
    WHERE user_id = user_id_param;

    -- If no activities, reset streak to 0
    IF last_activity_date IS NULL THEN
        current_streak := 0;
    ELSE
        -- Check if the last activity was today or yesterday in user's timezone
        IF last_activity_date = user_current_date THEN
            -- Activity was today, check consecutive days backwards
            check_date := user_current_date;
            consecutive_days := 0;
            
            -- Count consecutive days with at least one activity
            WHILE check_date >= user_current_date - INTERVAL '365 days' LOOP
                -- Check if there's at least one activity on this date in user's timezone
                IF EXISTS (
                    SELECT 1 FROM activities 
                    WHERE user_id = user_id_param 
                    AND (timestamp AT TIME ZONE user_timezone)::DATE = check_date
                ) THEN
                    consecutive_days := consecutive_days + 1;
                    check_date := check_date - INTERVAL '1 day';
                ELSE
                    -- Found a gap, break the streak
                    EXIT;
                END IF;
            END LOOP;
            
            current_streak := consecutive_days;
        ELSIF last_activity_date = user_current_date - INTERVAL '1 day' THEN
            -- Last activity was yesterday, continue the streak
            current_streak := current_streak + 1;
        ELSE
            -- Last activity was more than 1 day ago, reset streak to 1 (for today's activity)
            current_streak := 1;
        END IF;
    END IF;

    -- Update longest streak if current streak is longer
    IF current_streak > longest_streak THEN
        longest_streak := current_streak;
    END IF;

    -- Update the profile with new streak values
    UPDATE profiles 
    SET stats = jsonb_build_object(
        'streak', current_streak,
        'longestStreak', longest_streak,
        'achievements', COALESCE(stats->'achievements', '[]'::jsonb)
    )
    WHERE id = user_id_param;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 