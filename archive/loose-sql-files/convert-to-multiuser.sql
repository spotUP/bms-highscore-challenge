-- Complete migration script to convert existing single tournament to multiuser format
-- This script combines all the migrations and data conversion in the correct order

-- Step 1: Create tournament-related types and tables
CREATE TYPE tournament_role AS ENUM ('owner', 'admin', 'member');

-- Create tournaments table
CREATE TABLE tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tournament_members table
CREATE TABLE tournament_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role tournament_role NOT NULL DEFAULT 'member',
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- Create tournament_invitations table
CREATE TABLE tournament_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role tournament_role NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on tournament tables
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_invitations ENABLE ROW LEVEL SECURITY;

-- Step 2: Create RLS policies for tournament tables
-- Tournaments policies
CREATE POLICY "Users can view tournaments they are members of"
  ON tournaments FOR SELECT
  USING (
    id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR is_public = true
  );

CREATE POLICY "Users can create tournaments"
  ON tournaments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Tournament owners and admins can update tournaments"
  ON tournaments FOR UPDATE
  USING (
    id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

CREATE POLICY "Tournament owners can delete tournaments"
  ON tournaments FOR DELETE
  USING (
    id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true
    )
  );

-- Tournament members policies
CREATE POLICY "Users can view tournament members for their tournaments"
  ON tournament_members FOR SELECT
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members tm
      WHERE tm.user_id = auth.uid() AND tm.is_active = true
    )
  );

CREATE POLICY "Tournament owners and admins can manage members"
  ON tournament_members FOR ALL
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Tournament invitations policies
CREATE POLICY "Users can view invitations for their tournaments"
  ON tournament_invitations FOR SELECT
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Tournament owners and admins can manage invitations"
  ON tournament_invitations FOR ALL
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Step 3: Add tournament_id columns to existing tables
-- Add tournament_id to games table
ALTER TABLE games ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;

-- Add tournament_id to scores table  
ALTER TABLE scores ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;

-- Add tournament_id to achievements table
ALTER TABLE achievements ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;

-- Add tournament_id to player_achievements table
ALTER TABLE player_achievements ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;

-- Add tournament_id to player_stats table
ALTER TABLE player_stats ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;

-- Add tournament_id to competition tables
ALTER TABLE competition_history ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE competition_games ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE competition_scores ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE competition_players ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;

-- Step 4: Create the default tournament and migrate data
DO $$
DECLARE
  default_tournament_id UUID;
  current_user_id UUID;
BEGIN
  -- Get the current authenticated user (you'll need to run this as your user)
  SELECT auth.uid() INTO current_user_id;
  
  -- If no authenticated user, try to get the first admin user
  IF current_user_id IS NULL THEN
    SELECT user_id INTO current_user_id 
    FROM user_roles 
    WHERE role = 'admin' 
    LIMIT 1;
  END IF;
  
  -- Create the default tournament
  INSERT INTO tournaments (name, slug, description, is_public, created_by)
  VALUES (
    'Default Arcade Tournament',
    'default-arcade',
    'Your original arcade high score tournament',
    false,
    current_user_id
  )
  RETURNING id INTO default_tournament_id;
  
  -- Add the current user as the owner of the default tournament
  IF current_user_id IS NOT NULL THEN
    INSERT INTO tournament_members (tournament_id, user_id, role)
    VALUES (default_tournament_id, current_user_id, 'owner');
  END IF;
  
  -- Migrate all existing data to the default tournament
  UPDATE games SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
  UPDATE scores SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
  UPDATE achievements SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
  UPDATE player_achievements SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
  UPDATE player_stats SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
  UPDATE competition_history SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
  UPDATE competition_games SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
  UPDATE competition_scores SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
  UPDATE competition_players SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
  
  RAISE NOTICE 'Created default tournament with ID: %', default_tournament_id;
END $$;

-- Step 5: Make tournament_id NOT NULL after migration
ALTER TABLE games ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE scores ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE achievements ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE player_achievements ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE player_stats ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE competition_history ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE competition_games ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE competition_scores ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE competition_players ALTER COLUMN tournament_id SET NOT NULL;

-- Step 6: Update RLS policies for existing tables to include tournament isolation
-- Drop existing policies and create new ones with tournament isolation

-- Games policies
DROP POLICY IF EXISTS "Games are viewable by everyone" ON games;
DROP POLICY IF EXISTS "Admins can create games" ON games;
DROP POLICY IF EXISTS "Admins can update games" ON games;
DROP POLICY IF EXISTS "Admins can delete games" ON games;

CREATE POLICY "Users can view games in their tournaments"
  ON games FOR SELECT
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Tournament admins can manage games"
  ON games FOR ALL
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Scores policies
DROP POLICY IF EXISTS "Scores are viewable by everyone" ON scores;
DROP POLICY IF EXISTS "Admins can create scores" ON scores;
DROP POLICY IF EXISTS "Admins can update scores" ON scores;
DROP POLICY IF EXISTS "Admins can delete scores" ON scores;

CREATE POLICY "Users can view scores in their tournaments"
  ON scores FOR SELECT
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Tournament admins can manage scores"
  ON scores FOR ALL
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Achievements policies
DROP POLICY IF EXISTS "Achievements are viewable by everyone" ON achievements;
DROP POLICY IF EXISTS "Admins can create achievements" ON achievements;
DROP POLICY IF EXISTS "Admins can update achievements" ON achievements;
DROP POLICY IF EXISTS "Admins can delete achievements" ON achievements;

CREATE POLICY "Users can view achievements in their tournaments"
  ON achievements FOR SELECT
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Tournament admins can manage achievements"
  ON achievements FOR ALL
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Player achievements policies
DROP POLICY IF EXISTS "Player achievements are viewable by everyone" ON player_achievements;
DROP POLICY IF EXISTS "Admins can create player achievements" ON player_achievements;
DROP POLICY IF EXISTS "Admins can update player achievements" ON player_achievements;
DROP POLICY IF EXISTS "Admins can delete player achievements" ON player_achievements;

CREATE POLICY "Users can view player achievements in their tournaments"
  ON player_achievements FOR SELECT
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Tournament admins can manage player achievements"
  ON player_achievements FOR ALL
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Player stats policies
DROP POLICY IF EXISTS "Player stats are viewable by everyone" ON player_stats;
DROP POLICY IF EXISTS "Admins can create player stats" ON player_stats;
DROP POLICY IF EXISTS "Admins can update player stats" ON player_stats;
DROP POLICY IF EXISTS "Admins can delete player stats" ON player_stats;

CREATE POLICY "Users can view player stats in their tournaments"
  ON player_stats FOR SELECT
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Tournament admins can manage player stats"
  ON player_stats FOR ALL
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Competition history policies
DROP POLICY IF EXISTS "Competition history is viewable by everyone" ON competition_history;
DROP POLICY IF EXISTS "Admins can create competition history" ON competition_history;
DROP POLICY IF EXISTS "Admins can update competition history" ON competition_history;
DROP POLICY IF EXISTS "Admins can delete competition history" ON competition_history;

CREATE POLICY "Users can view competition history in their tournaments"
  ON competition_history FOR SELECT
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Tournament admins can manage competition history"
  ON competition_history FOR ALL
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Competition games policies
DROP POLICY IF EXISTS "Competition games are viewable by everyone" ON competition_games;
DROP POLICY IF EXISTS "Admins can create competition games" ON competition_games;
DROP POLICY IF EXISTS "Admins can update competition games" ON competition_games;
DROP POLICY IF EXISTS "Admins can delete competition games" ON competition_games;

CREATE POLICY "Users can view competition games in their tournaments"
  ON competition_games FOR SELECT
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Tournament admins can manage competition games"
  ON competition_games FOR ALL
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Competition scores policies
DROP POLICY IF EXISTS "Competition scores are viewable by everyone" ON competition_scores;
DROP POLICY IF EXISTS "Admins can create competition scores" ON competition_scores;
DROP POLICY IF EXISTS "Admins can update competition scores" ON competition_scores;
DROP POLICY IF EXISTS "Admins can delete competition scores" ON competition_scores;

CREATE POLICY "Users can view competition scores in their tournaments"
  ON competition_scores FOR SELECT
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Tournament admins can manage competition scores"
  ON competition_scores FOR ALL
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Competition players policies
DROP POLICY IF EXISTS "Competition players are viewable by everyone" ON competition_players;
DROP POLICY IF EXISTS "Admins can create competition players" ON competition_players;
DROP POLICY IF EXISTS "Admins can update competition players" ON competition_players;
DROP POLICY IF EXISTS "Admins can delete competition players" ON competition_players;

CREATE POLICY "Users can view competition players in their tournaments"
  ON competition_players FOR SELECT
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Tournament admins can manage competition players"
  ON competition_players FOR ALL
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Step 7: Create helper functions
-- Function to get user's role in a tournament
CREATE OR REPLACE FUNCTION get_user_tournament_role(tournament_id UUID, user_id UUID)
RETURNS tournament_role
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role tournament_role;
BEGIN
  SELECT role INTO user_role
  FROM tournament_members tm
  WHERE tm.tournament_id = get_user_tournament_role.tournament_id 
    AND tm.user_id = get_user_tournament_role.user_id 
    AND tm.is_active = true;
  
  RETURN user_role;
END;
$$;

-- Function to create default tournament for new users
CREATE OR REPLACE FUNCTION create_default_tournament_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_tournament_id UUID;
BEGIN
  -- Create a default tournament for the new user
  INSERT INTO tournaments (name, slug, description, is_public, created_by)
  VALUES (
    'My Arcade Tournament',
    'my-arcade-' || EXTRACT(EPOCH FROM NOW())::INTEGER,
    'Your personal arcade tournament',
    false,
    NEW.id
  )
  RETURNING id INTO new_tournament_id;
  
  -- Add the user as the owner
  INSERT INTO tournament_members (tournament_id, user_id, role)
  VALUES (new_tournament_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user tournament creation
CREATE TRIGGER create_default_tournament_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_tournament_for_new_user();

-- Step 8: Create indexes for better performance
CREATE INDEX idx_tournament_members_user_tournament ON tournament_members(user_id, tournament_id);
CREATE INDEX idx_tournament_members_tournament ON tournament_members(tournament_id);
CREATE INDEX idx_games_tournament ON games(tournament_id);
CREATE INDEX idx_scores_tournament ON scores(tournament_id);
CREATE INDEX idx_achievements_tournament ON achievements(tournament_id);
CREATE INDEX idx_player_achievements_tournament ON player_achievements(tournament_id);
CREATE INDEX idx_player_stats_tournament ON player_stats(tournament_id);
CREATE INDEX idx_competition_history_tournament ON competition_history(tournament_id);
CREATE INDEX idx_competition_games_tournament ON competition_games(tournament_id);
CREATE INDEX idx_competition_scores_tournament ON competition_scores(tournament_id);
CREATE INDEX idx_competition_players_tournament ON competition_players(tournament_id);

-- Step 9: Add the Demolition Man game auto-creation function
CREATE OR REPLACE FUNCTION ensure_demolition_man_game()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  game_id UUID;
  tournament_count INTEGER;
BEGIN
  -- Check if we have any tournaments (needed for tournament_id)
  SELECT COUNT(*) INTO tournament_count FROM tournaments;
  
  IF tournament_count = 0 THEN
    RAISE EXCEPTION 'No tournaments found. Please create a tournament first.';
  END IF;
  
  -- Try to find existing Demolition Man game in any tournament
  SELECT id INTO game_id
  FROM games
  WHERE name = 'Demolition Man'
  LIMIT 1;
  
  -- If not found, create it in the first available tournament
  IF game_id IS NULL THEN
    INSERT INTO games (
      name,
      description,
      logo_url,
      is_active,
      include_in_challenge,
      tournament_id
    )
    SELECT
      'Demolition Man',
      'Eternal leaderboard for Demolition Man high scores',
      'https://images.launchbox-app.com/c84bf29b-1b54-4310-9290-9b52f587f442.png',
      true,
      false,
      t.id
    FROM tournaments t
    ORDER BY t.created_at ASC
    LIMIT 1
    RETURNING id INTO game_id;
    
    RAISE NOTICE 'Created Demolition Man game with ID: %', game_id;
  ELSE
    RAISE NOTICE 'Demolition Man game already exists with ID: %', game_id;
  END IF;
  
  RETURN game_id;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION ensure_demolition_man_game() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_tournament_role(UUID, UUID) TO authenticated;

-- Step 10: Final notification
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Your existing tournament data has been converted to the new multiuser format.';
  RAISE NOTICE 'A "Default Arcade Tournament" has been created with all your existing games and scores.';
  RAISE NOTICE 'You have been set as the owner of this tournament.';
  RAISE NOTICE 'The app will now automatically switch to the new multiuser mode.';
END $$;
