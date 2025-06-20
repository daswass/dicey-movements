-- Drop existing policy
DROP POLICY IF EXISTS "Users can view their own Oura activities" ON oura_activities;

-- Create new policies for oura_activities
CREATE POLICY "Users can view all Oura activities"
    ON oura_activities FOR SELECT
    USING (true);

CREATE POLICY "Users can modify their own Oura activities"
    ON oura_activities FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id); 