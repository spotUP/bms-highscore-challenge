-- Create missing tables that the application expects

-- User roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'user', 'moderator')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policies for user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Tournaments table
CREATE TABLE IF NOT EXISTS public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  scores_locked boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- Policies for tournaments
DROP POLICY IF EXISTS "Public tournaments are viewable by everyone" ON public.tournaments;
CREATE POLICY "Public tournaments are viewable by everyone" ON public.tournaments
  FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Users can view tournaments they created" ON public.tournaments;
CREATE POLICY "Users can view tournaments they created" ON public.tournaments
  FOR SELECT USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can create tournaments" ON public.tournaments;
CREATE POLICY "Users can create tournaments" ON public.tournaments
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update their own tournaments" ON public.tournaments;
CREATE POLICY "Users can update their own tournaments" ON public.tournaments
  FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

-- Tournament members table
CREATE TABLE IF NOT EXISTS public.tournament_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'moderator')),
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

-- Enable RLS
ALTER TABLE public.tournament_members ENABLE ROW LEVEL SECURITY;

-- Policies for tournament_members
DROP POLICY IF EXISTS "Members can view tournament memberships" ON public.tournament_members;
CREATE POLICY "Members can view tournament memberships" ON public.tournament_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t 
      WHERE t.id = tournament_id AND (t.is_public = true OR t.created_by = auth.uid())
    )
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Tournament admins can manage members" ON public.tournament_members;
CREATE POLICY "Tournament admins can manage members" ON public.tournament_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t 
      WHERE t.id = tournament_id AND t.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.tournament_members tm 
      WHERE tm.tournament_id = tournament_members.tournament_id 
      AND tm.user_id = auth.uid() AND tm.role = 'admin'
    )
  );

-- Fix bracket table name (app expects bracket_tournaments, not bracket_competitions)
ALTER TABLE IF EXISTS public.bracket_competitions RENAME TO bracket_tournaments;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_tournaments_slug ON public.tournaments(slug);
CREATE INDEX IF NOT EXISTS idx_tournaments_is_public ON public.tournaments(is_public);
CREATE INDEX IF NOT EXISTS idx_tournament_members_tournament_id ON public.tournament_members(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_members_user_id ON public.tournament_members(user_id);

-- Insert default data
INSERT INTO public.tournaments (name, slug, description, is_public, created_by) 
VALUES (
  'Default Arcade Tournament', 
  'default-arcade', 
  'Default public tournament for arcade games', 
  true, 
  (SELECT id FROM auth.users LIMIT 1)
) ON CONFLICT (slug) DO NOTHING;

-- Add current user as admin if they exist
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users 
WHERE email = 'spotup@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
