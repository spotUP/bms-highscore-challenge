-- Add selected tournament preference to user profiles
-- This allows users to have their selected tournament saved per user in Supabase

-- Check if column doesn't exist before adding it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'selected_tournament_id'
    ) THEN
        ALTER TABLE public.profiles
        ADD COLUMN selected_tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL;

        -- Add comment for documentation
        COMMENT ON COLUMN public.profiles.selected_tournament_id IS 'User preference for selected tournament';
    END IF;
END $$;