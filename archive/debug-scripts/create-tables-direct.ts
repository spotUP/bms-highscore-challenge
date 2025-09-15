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

async function createTables() {
  console.log('Creating games and scores tables...\n');
  console.log('SUPABASE_URL:', SUPABASE_URL);

  // Use fetch to directly call the Supabase REST API
  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY!,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  // Create the SQL statements
  const sqlStatements = [
    // Create games table
    `CREATE TABLE IF NOT EXISTS public.games (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      logo_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      include_in_challenge BOOLEAN NOT NULL DEFAULT true,
      tournament_id UUID,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    );`,

    // Create scores table
    `CREATE TABLE IF NOT EXISTS public.scores (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      player_name TEXT NOT NULL CHECK (LENGTH(player_name) <= 3),
      score INTEGER NOT NULL CHECK (score >= 0),
      game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
      tournament_id UUID,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    );`,

    // Create update trigger function
    `CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ language 'plpgsql';`,

    // Create triggers
    `DROP TRIGGER IF EXISTS update_games_updated_at ON public.games;
    CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();`,

    `DROP TRIGGER IF EXISTS update_scores_updated_at ON public.scores;
    CREATE TRIGGER update_scores_updated_at
    BEFORE UPDATE ON public.scores
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();`,

    // Enable RLS
    `ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;`,

    // Create policies for games table
    `DROP POLICY IF EXISTS "Games are viewable by everyone" ON public.games;
    CREATE POLICY "Games are viewable by everyone"
      ON public.games
      FOR SELECT
      USING (true);`,

    `DROP POLICY IF EXISTS "Admins can create games" ON public.games;
    CREATE POLICY "Admins can create games"
      ON public.games
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'admin'::app_role
        )
      );`,

    `DROP POLICY IF EXISTS "Admins can update games" ON public.games;
    CREATE POLICY "Admins can update games"
      ON public.games
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'admin'::app_role
        )
      );`,

    `DROP POLICY IF EXISTS "Admins can delete games" ON public.games;
    CREATE POLICY "Admins can delete games"
      ON public.games
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'admin'::app_role
        )
      );`,

    // Create policies for scores table
    `DROP POLICY IF EXISTS "Scores are viewable by everyone" ON public.scores;
    CREATE POLICY "Scores are viewable by everyone"
      ON public.scores
      FOR SELECT
      USING (true);`,

    `DROP POLICY IF EXISTS "Admins can create scores" ON public.scores;
    CREATE POLICY "Admins can create scores"
      ON public.scores
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid()
          AND role = 'admin'::app_role
        )
      );`,

    `DROP POLICY IF EXISTS "Admins can update scores" ON public.scores;
    CREATE POLICY "Admins can update scores"
      ON public.scores
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid()
          AND role = 'admin'::app_role
        )
      );`,

    `DROP POLICY IF EXISTS "Admins can delete scores" ON public.scores;
    CREATE POLICY "Admins can delete scores"
      ON public.scores
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid()
          AND role = 'admin'::app_role
        )
      );`
  ];

  // Try using execute_sql RPC first (if it exists)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Check if execute_sql function exists
  console.log('Checking for execute_sql function...');
  const { data: functions, error: functionsError } = await supabase
    .rpc('execute_sql', { query: 'SELECT 1' })
    .single();

  if (!functionsError) {
    console.log('Using execute_sql function to create tables...\n');

    for (const sql of sqlStatements) {
      const description = sql.includes('CREATE TABLE') ? 'Creating table...' :
                         sql.includes('CREATE POLICY') ? 'Creating policy...' :
                         sql.includes('CREATE TRIGGER') ? 'Creating trigger...' :
                         sql.includes('ALTER TABLE') ? 'Enabling RLS...' :
                         'Executing SQL...';

      console.log(description);
      const { error } = await supabase.rpc('execute_sql', { query: sql });
      if (error) {
        console.error('Error:', error.message);
      }
    }
  } else {
    console.log('execute_sql function not found. Please run the migrations manually in Supabase Dashboard.\n');
    console.log('Go to your Supabase Dashboard -> SQL Editor and run the following SQL:\n');
    console.log('================== SQL TO RUN ==================\n');
    console.log(sqlStatements.join('\n\n'));
    console.log('\n================== END SQL ==================\n');
    return;
  }

  // Verify tables were created
  console.log('\n=== Verifying tables ===');
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('count')
    .single();

  if (!gamesError) {
    console.log('✅ Games table created successfully');
  } else {
    console.error('❌ Games table not accessible:', gamesError.message);
  }

  const { data: scores, error: scoresError } = await supabase
    .from('scores')
    .select('count')
    .single();

  if (!scoresError) {
    console.log('✅ Scores table created successfully');
  } else {
    console.error('❌ Scores table not accessible:', scoresError.message);
  }

  console.log('\n=== Setup complete ===');
}

createTables();