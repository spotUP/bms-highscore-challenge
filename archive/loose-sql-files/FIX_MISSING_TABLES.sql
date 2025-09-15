-- ======================================
-- FIX: Create missing tables causing 500 errors
-- Run this in Supabase Dashboard SQL Editor
-- ======================================

-- 1. Create tournaments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Create tournament_members table
CREATE TABLE IF NOT EXISTS public.tournament_members (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, tournament_id)
);

-- 3. Create achievements table
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    points INTEGER NOT NULL DEFAULT 0,
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Create player_achievements table
CREATE TABLE IF NOT EXISTS public.player_achievements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    player_name TEXT NOT NULL,
    achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(player_name, achievement_id, tournament_id)
);

-- 5. Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Enable RLS on all tables
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 7. Create basic policies (allow read access)
-- Tournaments policies
DROP POLICY IF EXISTS "Tournaments are viewable by everyone" ON public.tournaments;
CREATE POLICY "Tournaments are viewable by everyone"
    ON public.tournaments FOR SELECT
    USING (true);

-- Tournament members policies
DROP POLICY IF EXISTS "Tournament members are viewable by everyone" ON public.tournament_members;
CREATE POLICY "Tournament members are viewable by everyone"
    ON public.tournament_members FOR SELECT
    USING (true);

-- Achievements policies
DROP POLICY IF EXISTS "Achievements are viewable by everyone" ON public.achievements;
CREATE POLICY "Achievements are viewable by everyone"
    ON public.achievements FOR SELECT
    USING (true);

-- Player achievements policies
DROP POLICY IF EXISTS "Player achievements are viewable by everyone" ON public.player_achievements;
CREATE POLICY "Player achievements are viewable by everyone"
    ON public.player_achievements FOR SELECT
    USING (true);

-- Profiles policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

-- 8. Insert a default tournament if none exists
INSERT INTO public.tournaments (name, description, slug, is_default, is_active, is_public)
VALUES ('Default Tournament', 'Default tournament for all players', 'default', true, true, true)
ON CONFLICT (slug) DO NOTHING;

-- 9. Create some sample achievements
INSERT INTO public.achievements (name, description, points, tournament_id)
SELECT
    'High Score Master' as name,
    'Achieve a high score in any game' as description,
    100 as points,
    t.id as tournament_id
FROM public.tournaments t
WHERE t.is_default = true
ON CONFLICT DO NOTHING;

INSERT INTO public.achievements (name, description, points, tournament_id)
SELECT
    'Game Champion' as name,
    'Win 10 games in a row' as description,
    250 as points,
    t.id as tournament_id
FROM public.tournaments t
WHERE t.is_default = true
ON CONFLICT DO NOTHING;

-- 10. Verify all tables exist
SELECT 'tournaments' as table_name, count(*) as row_count FROM public.tournaments
UNION ALL
SELECT 'tournament_members' as table_name, count(*) as row_count FROM public.tournament_members
UNION ALL
SELECT 'achievements' as table_name, count(*) as row_count FROM public.achievements
UNION ALL
SELECT 'player_achievements' as table_name, count(*) as row_count FROM public.player_achievements
UNION ALL
SELECT 'profiles' as table_name, count(*) as row_count FROM public.profiles;