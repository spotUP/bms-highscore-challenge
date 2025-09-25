-- Fix profiles table structure for fullscreen preference
-- Run this in your Supabase SQL editor

-- First, let's check the current structure of the profiles table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if user_id column exists
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'profiles'
  AND table_schema = 'public'
  AND column_name = 'user_id'
) AS user_id_exists;

-- Check if fullscreen_enabled column exists
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'profiles'
  AND table_schema = 'public'
  AND column_name = 'fullscreen_enabled'
) AS fullscreen_enabled_exists;

-- If user_id column doesn't exist, add it (this should not be needed if migrations were run correctly)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND table_schema = 'public'
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Update existing records to match their primary key to user_id if this was the issue
    UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;
  END IF;
END $$;

-- If fullscreen_enabled column doesn't exist, add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND table_schema = 'public'
    AND column_name = 'fullscreen_enabled'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN fullscreen_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Verify the final structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND table_schema = 'public'
ORDER BY ordinal_position;