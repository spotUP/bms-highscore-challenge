import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tnsgrwntmnzpaifmutqh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing required environment variables');
  console.error('Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setupDatabase() {
  try {
    console.log('Setting up database tables...');
    
    // Check if games table exists
    const { data: gamesTable, error: gamesTableError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .eq('tablename', 'games')
      .single();

    if (gamesTableError || !gamesTable) {
      console.log('Creating games table...');
      const { error: createGamesError } = await supabase.rpc('exec_sql', {
        query: `
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
        `
      });
      
      if (createGamesError) {
        console.error('Error creating games table:', createGamesError);
      } else {
        console.log('Games table created successfully');
      }
    } else {
      console.log('Games table already exists');
    }

    // Check if scores table exists
    const { data: scoresTable, error: scoresTableError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .eq('tablename', 'scores')
      .single();

    if (scoresTableError || !scoresTable) {
      console.log('Creating scores table...');
      const { error: createScoresError } = await supabase.rpc('exec_sql', {
        query: `
          CREATE TABLE IF NOT EXISTS public.scores (
            id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            player_name TEXT NOT NULL CHECK (LENGTH(player_name) <= 3),
            score INTEGER NOT NULL CHECK (score >= 0),
            game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
            tournament_id UUID,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
          );
        `
      });
      
      if (createScoresError) {
        console.error('Error creating scores table:', createScoresError);
      } else {
        console.log('Scores table created successfully');
      }
    } else {
      console.log('Scores table already exists');
    }

    // Enable RLS and set up policies
    console.log('Setting up RLS and policies...');
    await setupPolicies();
    
    console.log('Database setup completed successfully!');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

async function setupPolicies() {
  // Enable RLS on games table
  await supabase.rpc('exec_sql', {
    query: 'ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;'
  });

  // Enable RLS on scores table
  await supabase.rpc('exec_sql', {
    query: 'ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;'
  });

  // Drop existing policies to avoid conflicts
  await supabase.rpc('exec_sql', {
    query: `
      DROP POLICY IF EXISTS "Games are viewable by everyone" ON public.games;
      DROP POLICY IF EXISTS "Admins can create games" ON public.games;
      DROP POLICY IF EXISTS "Admins can update games" ON public.games;
      DROP POLICY IF EXISTS "Admins can delete games" ON public.games;
      DROP POLICY IF EXISTS "Scores are viewable by everyone" ON public.scores;
      DROP POLICY IF EXISTS "Admins can create scores" ON public.scores;
      DROP POLICY IF EXISTS "Admins can update scores" ON public.scores;
      DROP POLICY IF EXISTS "Admins can delete scores" ON public.scores;
    `
  });

  // Create games table policies
  await supabase.rpc('exec_sql', {
    query: `
      -- Allow everyone to view games
      CREATE POLICY "Games are viewable by everyone"
        ON public.games
        FOR SELECT
        USING (true);

      -- Only admins can insert games
      CREATE POLICY "Admins can create games"
        ON public.games
        FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'::app_role
          )
        );

      -- Only admins can update games
      CREATE POLICY "Admins can update games"
        ON public.games
        FOR UPDATE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'::app_role
          )
        );

      -- Only admins can delete games
      CREATE POLICY "Admins can delete games"
        ON public.games
        FOR DELETE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'::app_role
          )
        );
    `
  });

  // Create scores table policies
  await supabase.rpc('exec_sql', {
    query: `
      -- Allow everyone to view scores
      CREATE POLICY "Scores are viewable by everyone" 
        ON public.scores 
        FOR SELECT 
        USING (true);

      -- Only admins can insert scores
      CREATE POLICY "Admins can create scores" 
        ON public.scores 
        FOR INSERT 
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'::app_role
          )
        );

      -- Only admins can update scores
      CREATE POLICY "Admins can update scores" 
        ON public.scores 
        FOR UPDATE 
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'::app_role
          )
        );

      -- Only admins can delete scores
      CREATE POLICY "Admins can delete scores" 
        ON public.scores 
        FOR DELETE 
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'::app_role
          )
        );
    `
  });

  // Create trigger for automatic timestamp updates on games
  await supabase.rpc('exec_sql', {
    query: `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_games_updated_at ON public.games;
      CREATE TRIGGER update_games_updated_at
      BEFORE UPDATE ON public.games
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `
  });

  // Create trigger for automatic timestamp updates on scores
  await supabase.rpc('exec_sql', {
    query: `
      DROP TRIGGER IF EXISTS update_scores_updated_at ON public.scores;
      CREATE TRIGGER update_scores_updated_at
      BEFORE UPDATE ON public.scores
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `
  });
}

// Run the setup
setupDatabase();
