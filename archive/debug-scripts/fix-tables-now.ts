import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tnsgrwntmnzpaifmutqh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing required environment variables');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public'
  }
});

async function createTablesViaAPI() {
  console.log('Creating tables via Supabase API...\n');

  try {
    // First, let's try to create a simple test record to see what tables exist
    console.log('1. Testing current database state...');

    // Check if games table exists by trying to query it
    const { data: existingGames, error: gamesCheckError } = await supabase
      .from('games')
      .select('id')
      .limit(1);

    if (gamesCheckError && gamesCheckError.message.includes('relation "public.games" does not exist')) {
      console.log('❌ Games table does not exist - need to create it');

      // Since we can't execute raw SQL directly, we need to use the Dashboard
      console.log('\n' + '='.repeat(60));
      console.log('MANUAL STEP REQUIRED');
      console.log('='.repeat(60));
      console.log('\nThe games and scores tables need to be created manually.');
      console.log('\nPlease follow these steps:');
      console.log('\n1. Go to: https://supabase.com/dashboard/project/tnsgrwntmnzpaifmutqh/sql/new');
      console.log('2. Copy and paste the SQL from FIX_TABLES.sql');
      console.log('3. Click "Run" to execute the SQL');
      console.log('\nAlternatively, you can use the Supabase Dashboard Table Editor:');
      console.log('1. Go to: https://supabase.com/dashboard/project/tnsgrwntmnzpaifmutqh/editor');
      console.log('2. Click "New Table" and create the games table');
      console.log('3. Click "New Table" and create the scores table');

      console.log('\n' + '='.repeat(60));
      console.log('SQL TO RUN IN DASHBOARD:');
      console.log('='.repeat(60));

      const sql = `
-- Create games table
CREATE TABLE IF NOT EXISTS public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  include_in_challenge BOOLEAN NOT NULL DEFAULT true,
  tournament_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scores table
CREATE TABLE IF NOT EXISTS public.scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL CHECK (LENGTH(player_name) <= 3),
  score INTEGER NOT NULL CHECK (score >= 0),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  tournament_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Create policies for games
CREATE POLICY "Games are viewable by everyone"
  ON public.games FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage games"
  ON public.games FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    )
  );

-- Create policies for scores
CREATE POLICY "Scores are viewable by everyone"
  ON public.scores FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage scores"
  ON public.scores FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    )
  );

-- Insert sample games
INSERT INTO public.games (name, description, logo_url, is_active, include_in_challenge)
VALUES
  ('Pac-Man', 'Classic arcade game', '/images/pacman-logo.png', true, true),
  ('Donkey Kong', 'Jump and climb to save the princess', '/images/donkey-kong-logo.png', true, true),
  ('Space Invaders', 'Defend Earth from alien invaders', '/images/space-invaders-logo.png', true, true),
  ('Galaga', 'Space shooter game', NULL, true, true),
  ('Street Fighter II', 'Fighting game', NULL, true, true)
ON CONFLICT DO NOTHING;`;

      console.log(sql);
      console.log('\n' + '='.repeat(60));

    } else if (existingGames) {
      console.log('✅ Games table already exists!');

      // Check for scores table
      const { error: scoresCheckError } = await supabase
        .from('scores')
        .select('id')
        .limit(1);

      if (scoresCheckError && scoresCheckError.message.includes('relation "public.scores" does not exist')) {
        console.log('❌ Scores table does not exist');
      } else {
        console.log('✅ Scores table already exists!');
      }

      // Check if we have any games
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('*');

      if (!gamesError) {
        console.log(`\nFound ${games?.length || 0} games in the database`);

        if (!games || games.length === 0) {
          console.log('\nInserting sample games...');

          const { data: insertedGames, error: insertError } = await supabase
            .from('games')
            .insert([
              { name: 'Pac-Man', description: 'Classic arcade game', logo_url: '/images/pacman-logo.png', is_active: true, include_in_challenge: true },
              { name: 'Donkey Kong', description: 'Jump and climb to save the princess', logo_url: '/images/donkey-kong-logo.png', is_active: true, include_in_challenge: true },
              { name: 'Space Invaders', description: 'Defend Earth from alien invaders', logo_url: '/images/space-invaders-logo.png', is_active: true, include_in_challenge: true },
              { name: 'Galaga', description: 'Space shooter game', is_active: true, include_in_challenge: true },
              { name: 'Street Fighter II', description: 'Fighting game', is_active: true, include_in_challenge: true }
            ])
            .select();

          if (insertError) {
            console.error('Error inserting games:', insertError.message);
          } else {
            console.log(`✅ Inserted ${insertedGames?.length || 0} sample games`);
          }
        } else {
          console.log('Games already exist:', games.map(g => g.name).join(', '));
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

createTablesViaAPI();