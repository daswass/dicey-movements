-- Add user_split_id column to profiles table
-- This will store which split the user has selected

-- Add the column with a default value
ALTER TABLE profiles ADD COLUMN user_split_id TEXT DEFAULT 'full-body';

-- Add a comment to document the column
COMMENT ON COLUMN profiles.user_split_id IS 'The ID of the split/workout routine the user has selected';

-- Update existing profiles to have the default split
UPDATE profiles SET user_split_id = 'full-body' WHERE user_split_id IS NULL;

-- Make the column NOT NULL after setting default values
ALTER TABLE profiles ALTER COLUMN user_split_id SET NOT NULL;

-- Add an index for better query performance
CREATE INDEX idx_profiles_user_split_id ON profiles(user_split_id);
