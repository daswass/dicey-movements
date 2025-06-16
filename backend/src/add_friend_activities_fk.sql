-- First, update any existing friend_activities records to use the correct user_id
UPDATE friend_activities fa
SET user_id = p.id
FROM profiles p
WHERE fa.user_id = p.id;

-- Add foreign key constraint
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