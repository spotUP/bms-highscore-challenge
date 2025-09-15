import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline';

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

async function runQuery(query: string) {
  try {
    console.log('\nExecuting query:');
    console.log('---');
    console.log(query);
    console.log('---\n');

    const { data, error } = await supabase.rpc('exec_sql', { query });
    
    if (error) {
      console.error('Error executing query:', error);
      return;
    }
    
    console.log('Result:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    const query = await new Promise<string>((resolve) => {
      rl.question('\nEnter SQL query (or type "exit" to quit):\n', (input) => {
        resolve(input);
      });
    });

    if (query.toLowerCase() === 'exit') {
      break;
    }

    await runQuery(query);
  }

  rl.close();
}

// Run some initial queries to check the schema
async function checkSchema() {
  const queries = [
    `SELECT EXISTS (
      SELECT 1 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'games'
    ) AS games_table_exists;`,
    
    `SELECT EXISTS (
      SELECT 1 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'scores'
    ) AS scores_table_exists;`,
    
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = 'public'
     ORDER BY table_name;`,
     
    `SELECT EXISTS (
      SELECT 1 
      FROM pg_type 
      WHERE typname = 'app_role'
    ) AS app_role_enum_exists;`,
    
    `CREATE TABLE IF NOT EXISTS public.games (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      logo_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      include_in_challenge BOOLEAN NOT NULL DEFAULT true,
      tournament_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    
    `CREATE TABLE IF NOT EXISTS public.scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_name TEXT NOT NULL CHECK (LENGTH(player_name) <= 3),
      score INTEGER NOT NULL CHECK (score >= 0),
      game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
      tournament_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`
  ];

  for (const query of queries) {
    await runQuery(query);
  }
}

// Start with schema check, then enter interactive mode
checkSchema().then(() => main());
