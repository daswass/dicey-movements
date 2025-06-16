-- Update friend_activities table to reference profiles
ALTER TABLE friend_activities
DROP CONSTRAINT IF EXISTS friend_activities_user_id_fkey;

ALTER TABLE friend_activities
ADD CONSTRAINT friend_activities_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id);

-- Update RLS policies for friend_activities
DROP POLICY IF EXISTS "Users can view their own activities" ON friend_activities;
DROP POLICY IF EXISTS "Users can add their own activities" ON friend_activities;

CREATE POLICY "Users can view their own activities"
    ON friend_activities FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own activities"
    ON friend_activities FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON friend_activities TO postgres, service_role; 