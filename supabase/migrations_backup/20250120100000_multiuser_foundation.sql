-- Multiuser Tournament System Foundation
-- This migration creates the core tournament infrastructure

-- Create tournament roles enum
CREATE TYPE tournament_role AS ENUM ('owner', 'admin', 'moderator', 'player');

-- Create tournaments table
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

-- Create tournament members table
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

-- Create tournament invitations table
CREATE TABLE public.tournament_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role tournament_role NOT NULL DEFAULT 'player',
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, email)
);

-- Add indexes for performance
CREATE INDEX idx_tournaments_owner ON public.tournaments(owner_id);
CREATE INDEX idx_tournaments_slug ON public.tournaments(slug);
CREATE INDEX idx_tournaments_public_active ON public.tournaments(is_public, is_active);
CREATE INDEX idx_tournament_members_tournament ON public.tournament_members(tournament_id);
CREATE INDEX idx_tournament_members_user ON public.tournament_members(user_id);
CREATE INDEX idx_tournament_members_role ON public.tournament_members(tournament_id, role);
CREATE INDEX idx_tournament_invitations_tournament ON public.tournament_invitations(tournament_id);
CREATE INDEX idx_tournament_invitations_email ON public.tournament_invitations(email);

-- Enable RLS
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tournaments
CREATE POLICY "Public tournaments are viewable by everyone" ON public.tournaments
  FOR SELECT USING (is_public = true AND is_active = true);

CREATE POLICY "Tournament members can view their tournaments" ON public.tournaments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tournament_members 
      WHERE tournament_id = tournaments.id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

CREATE POLICY "Users can create tournaments" ON public.tournaments
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Tournament owners can update their tournaments" ON public.tournaments
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Tournament owners can delete their tournaments" ON public.tournaments
  FOR DELETE USING (auth.uid() = owner_id);

-- RLS Policies for tournament members
CREATE POLICY "Tournament members can view other members" ON public.tournament_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tournament_members tm 
      WHERE tm.tournament_id = tournament_members.tournament_id 
      AND tm.user_id = auth.uid() 
      AND tm.is_active = true
    )
  );

CREATE POLICY "Tournament admins can manage members" ON public.tournament_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tournament_members tm 
      WHERE tm.tournament_id = tournament_members.tournament_id 
      AND tm.user_id = auth.uid() 
      AND tm.role IN ('owner', 'admin')
      AND tm.is_active = true
    )
  );

CREATE POLICY "Users can join tournaments through invitations" ON public.tournament_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for tournament invitations
CREATE POLICY "Tournament admins can manage invitations" ON public.tournament_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tournament_members tm 
      WHERE tm.tournament_id = tournament_invitations.tournament_id 
      AND tm.user_id = auth.uid() 
      AND tm.role IN ('owner', 'admin')
      AND tm.is_active = true
    )
  );

-- Function to get user's role in a tournament
CREATE OR REPLACE FUNCTION public.get_tournament_role(tournament_id UUID, user_id UUID)
RETURNS tournament_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role 
  FROM public.tournament_members 
  WHERE tournament_id = $1 
  AND user_id = $2 
  AND is_active = true
  LIMIT 1;
$$;

-- Function to check if user has permission in tournament
CREATE OR REPLACE FUNCTION public.has_tournament_permission(tournament_id UUID, user_id UUID, required_role tournament_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_role tournament_role;
  role_hierarchy INTEGER;
BEGIN
  SELECT get_tournament_role(tournament_id, user_id) INTO user_role;
  
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Role hierarchy: player=1, moderator=2, admin=3, owner=4
  role_hierarchy := CASE user_role
    WHEN 'player' THEN 1
    WHEN 'moderator' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'owner' THEN 4
  END;
  
  RETURN role_hierarchy >= CASE required_role
    WHEN 'player' THEN 1
    WHEN 'moderator' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'owner' THEN 4
  END;
END;
$$;

-- Function to create a default tournament for new users
CREATE OR REPLACE FUNCTION public.create_default_tournament_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tournament_id UUID;
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Create a base slug from the user's email
  base_slug := LOWER(REGEXP_REPLACE(
    SPLIT_PART(NEW.email, '@', 1), 
    '[^a-z0-9]', '-', 'g'
  ));
  
  -- Ensure slug is unique
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.tournaments WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  -- Create the tournament
  INSERT INTO public.tournaments (
    name,
    description,
    slug,
    owner_id,
    is_public,
    is_active
  ) VALUES (
    SPLIT_PART(NEW.email, '@', 1) || '''s Tournament',
    'My personal arcade tournament',
    final_slug,
    NEW.id,
    false,
    true
  ) RETURNING id INTO tournament_id;
  
  -- Add the user as the owner
  INSERT INTO public.tournament_members (
    tournament_id,
    user_id,
    role,
    is_active
  ) VALUES (
    tournament_id,
    NEW.id,
    'owner',
    true
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create default tournament for new users
CREATE TRIGGER create_default_tournament_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_tournament_for_user();

-- Create trigger for automatic timestamp updates on tournaments
CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT USAGE ON TYPE tournament_role TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_invitations TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tournament_role(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tournament_permission(UUID, UUID, tournament_role) TO authenticated;
