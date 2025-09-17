-- Add fullscreen preference to user profiles
-- This allows users to have their fullscreen setting saved per user

ALTER TABLE public.profiles
ADD COLUMN fullscreen_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.fullscreen_enabled IS 'User preference for fullscreen mode';