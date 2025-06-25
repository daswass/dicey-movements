-- Add timezone to location field in profiles table
-- This migration adds a timezone field to the location JSONB object

-- Update existing profiles to include timezone (default to UTC)
UPDATE profiles 
SET location = jsonb_build_object(
    'city', COALESCE(location->>'city', 'Unknown'),
    'country', COALESCE(location->>'country', 'Unknown'),
    'coordinates', COALESCE(location->'coordinates', '{"latitude": 0, "longitude": 0}'::jsonb),
    'timezone', COALESCE(location->>'timezone', 'UTC')
)
WHERE location IS NOT NULL;

-- Update the default value for new profiles to include timezone
ALTER TABLE profiles 
ALTER COLUMN location SET DEFAULT '{"city": "Unknown", "country": "Unknown", "coordinates": {"latitude": 0, "longitude": 0}, "timezone": "UTC"}'::jsonb;

-- Update the handle_new_user function to include timezone
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
            'coordinates', jsonb_build_object('latitude', 0, 'longitude', 0),
            'timezone', COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
        ),
        300,
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public; 