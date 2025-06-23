-- Trigger to automatically update streak when a new activity is inserted

-- Create trigger function
CREATE OR REPLACE FUNCTION trigger_update_streak()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the streak update function for the user who completed the activity
    PERFORM update_user_streak(NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_activity_insert ON activities;
CREATE TRIGGER on_activity_insert
    AFTER INSERT ON activities
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_streak(); 