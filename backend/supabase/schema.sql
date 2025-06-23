-- Drop existing tables if they exist
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS leaderboard CASCADE;
DROP TABLE IF EXISTS friend_activities CASCADE;
DROP TABLE IF EXISTS friends CASCADE;

-- Create profiles table
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    username TEXT,
    location JSONB NOT NULL,
    stats JSONB NOT NULL DEFAULT '{"totalReps": 0, "totalSets": 0, "streak": 0, "achievements": []}',
    timer_duration INTEGER DEFAULT 1000,
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create function to update username
CREATE OR REPLACE FUNCTION update_username()
RETURNS TRIGGER AS $$
BEGIN
    NEW.username = NEW.first_name || ' ' || NEW.last_name;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for username update
CREATE TRIGGER update_username_trigger
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_username();

-- Create leaderboard table
CREATE TABLE leaderboard (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    username TEXT NOT NULL,
    score INTEGER NOT NULL,
    location TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create friends table with proper foreign key references
CREATE TABLE friends (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    friend_id UUID REFERENCES profiles(id) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, friend_id)
);

-- Create friend_activities table
CREATE TABLE friend_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    username TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view other profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can view leaderboard" ON leaderboard;
DROP POLICY IF EXISTS "Users can add their own scores" ON leaderboard;
DROP POLICY IF EXISTS "Users can view their own activities" ON friend_activities;
DROP POLICY IF EXISTS "Users can add their own activities" ON friend_activities;
DROP POLICY IF EXISTS "Users can view their own friends" ON friends;
DROP POLICY IF EXISTS "Users can send friend requests" ON friends;
DROP POLICY IF EXISTS "Users can update their own friend requests" ON friends;

-- Create RLS policies
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can view other profiles"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can create their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Leaderboard policies
CREATE POLICY "Anyone can view leaderboard"
    ON leaderboard FOR SELECT
    USING (true);

CREATE POLICY "Users can add their own scores"
    ON leaderboard FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Friend activities policies
CREATE POLICY "Users can view their own activities"
    ON friend_activities FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own activities"
    ON friend_activities FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Friends policies
CREATE POLICY "Users can view their own friends"
    ON friends FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can send friend requests"
    ON friends FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friend requests"
    ON friends FOR UPDATE
    USING (auth.uid() = friend_id);

-- Create function to handle friend request acceptance
CREATE OR REPLACE FUNCTION handle_friend_request()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        -- Create a friend activity for the acceptance
        INSERT INTO friend_activities (user_id, username, activity_type, details)
        SELECT 
            NEW.user_id,
            (SELECT username FROM profiles WHERE id = NEW.user_id),
            'friend_accepted',
            'Accepted friend request from ' || (SELECT username FROM profiles WHERE id = NEW.friend_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for friend request acceptance
CREATE TRIGGER on_friend_request_accepted
    AFTER UPDATE ON friends
    FOR EACH ROW
    EXECUTE FUNCTION handle_friend_request();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, first_name, last_name, location, timer_duration, notifications_enabled)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.id::text),
        jsonb_build_object(
            'city', COALESCE(NEW.raw_user_meta_data->>'location', 'Unknown'),
            'country', 'Unknown',
            'coordinates', jsonb_build_object('latitude', 0, 'longitude', 0)
        ),
        300,
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;

-- Add foreign key constraint to friend_activities
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