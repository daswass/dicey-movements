-- Oura Ring Integration Tables

-- Table to store Oura OAuth tokens
CREATE TABLE oura_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id)
);

-- Table to store Oura daily activity data
CREATE TABLE oura_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    date DATE NOT NULL,
    steps INTEGER NOT NULL DEFAULT 0,
    calories_active INTEGER NOT NULL DEFAULT 0,
    calories_total INTEGER NOT NULL DEFAULT 0,
    distance REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, date)
);

-- Enable RLS on new tables
ALTER TABLE oura_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oura_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for oura_tokens
CREATE POLICY "Users can view their own Oura tokens"
    ON oura_tokens FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Oura tokens"
    ON oura_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Oura tokens"
    ON oura_tokens FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Oura tokens"
    ON oura_tokens FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for oura_activities
CREATE POLICY "Users can view their own Oura activities"
    ON oura_activities FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Oura activities"
    ON oura_activities FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Oura activities"
    ON oura_activities FOR UPDATE
    USING (auth.uid() = user_id);

-- Function to update updated_at timestamp for oura tables
CREATE OR REPLACE FUNCTION update_oura_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_oura_tokens_updated_at
    BEFORE UPDATE ON oura_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_oura_updated_at_column();

CREATE TRIGGER update_oura_activities_updated_at
    BEFORE UPDATE ON oura_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_oura_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON oura_tokens TO postgres, service_role;
GRANT ALL ON oura_activities TO postgres, service_role;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role; 