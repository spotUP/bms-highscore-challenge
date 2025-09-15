-- Idempotent creation of tournament foundation objects to resolve missing relation errors

-- 1) Create tournament_role enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'tournament_role'
  ) THEN
    CREATE TYPE tournament_role AS ENUM ('owner', 'admin', 'moderator', 'player');
  END IF;
END $$;

-- 2) Create public.tournaments if missing (minimal schema required for refs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tournaments'
  ) THEN
    CREATE TABLE public.tournaments (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL CHECK (LENGTH(name) >= 2 AND LENGTH(name) <= 100),
      description TEXT,
      slug TEXT UNIQUE NOT NULL CHECK (LENGTH(slug) >= 2 AND LENGTH(slug) <= 50),
      owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      is_public BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      logo_url TEXT,
      theme_color TEXT DEFAULT '#1a1a2e',
      max_members INTEGER DEFAULT 1000,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- 3) Create public.tournament_members if missing (minimal schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tournament_members'
  ) THEN
    CREATE TABLE public.tournament_members (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role tournament_role NOT NULL DEFAULT 'player',
      joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      UNIQUE(tournament_id, user_id)
    );
  END IF;
END $$;

-- Note: Additional tournament-related tables/policies can be added later as needed.
