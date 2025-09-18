-- Fix profiles table RLS policies and ensure fullscreen_enabled column exists

-- Ensure fullscreen_enabled column exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'fullscreen_enabled'
    ) THEN
        ALTER TABLE profiles ADD COLUMN fullscreen_enabled BOOLEAN NOT NULL DEFAULT false;
        COMMENT ON COLUMN profiles.fullscreen_enabled IS 'User preference for fullscreen mode';
    END IF;
END $$;

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY IF NOT EXISTS "profiles_select_own"
ON profiles FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY IF NOT EXISTS "profiles_update_own"
ON profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Allow users to insert their own profile
CREATE POLICY IF NOT EXISTS "profiles_insert_own"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);