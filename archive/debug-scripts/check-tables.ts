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

async function checkTables() {
  try {
    console.log('Checking database tables...');
    
    // Check if games table exists
    const { data: gamesTable, error: gamesError } = await supabase
      .from('pg_tables')
      .select('*')
      .eq('schemaname', 'public')
      .eq('tablename', 'games');

    console.log('Games table exists:', gamesTable && gamesTable.length > 0);
    
    // Check if scores table exists
    const { data: scoresTable, error: scoresError } = await supabase
      .from('pg_tables')
      .select('*')
      .eq('schemaname', 'public')
      .eq('tablename', 'scores');

    console.log('Scores table exists:', scoresTable && scoresTable.length > 0);
    
    // Check if user_roles table exists
    const { data: userRolesTable, error: userRolesError } = await supabase
      .from('pg_tables')
      .select('*')
      .eq('schemaname', 'public')
      .eq('tablename', 'user_roles');

    console.log('User roles table exists:', userRolesTable && userRolesTable.length > 0);
    
    // Check if we can query the games table
    const { data: games, error: gamesQueryError } = await supabase
      .from('games')
      .select('*')
      .limit(1);
      
    if (gamesQueryError) {
      console.error('Error querying games table:', gamesQueryError);
    } else {
      console.log('Successfully queried games table. Row count:', games?.length || 0);
    }
    
    // Check if we can query the scores table
    const { data: scores, error: scoresQueryError } = await supabase
      .from('scores')
      .select('*')
      .limit(1);
      
    if (scoresQueryError) {
      console.error('Error querying scores table:', scoresQueryError);
    } else {
      console.log('Successfully queried scores table. Row count:', scores?.length || 0);
    }
    
  } catch (error) {
    console.error('Error checking tables:', error);
  }
}

checkTables();
