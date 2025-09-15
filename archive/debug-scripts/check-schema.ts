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

async function checkSchema() {
  try {
    console.log('Checking database schema...');
    
    // List all tables in the public schema
    const { data: tables, error: tablesError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');
    
    if (tablesError) throw tablesError;
    
    console.log('\n=== Tables in public schema ===');
    console.log(tables.map(t => t.tablename).join('\n'));
    
    // Check if the user_roles table exists
    const hasUserRoles = tables.some(t => t.tablename === 'user_roles');
    
    if (hasUserRoles) {
      console.log('\n=== User roles ===');
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .limit(5);
      
      if (rolesError) {
        console.error('Error querying user_roles:', rolesError);
      } else {
        console.log('First 5 user roles:', roles);
      }
    }
    
    // Check if the tournaments table exists
    const hasTournaments = tables.some(t => t.tablename === 'tournaments');
    
    if (hasTournaments) {
      console.log('\n=== Tournaments ===');
      const { data: tournaments, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('*')
        .limit(5);
      
      if (tournamentsError) {
        console.error('Error querying tournaments:', tournamentsError);
      } else {
        console.log('First 5 tournaments:', tournaments);
      }
    }
    
    // Check if the games table exists
    const hasGames = tables.some(t => t.tablename === 'games');
    
    if (hasGames) {
      console.log('\n=== Games ===');
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .limit(5);
      
      if (gamesError) {
        console.error('Error querying games:', gamesError);
      } else {
        console.log('First 5 games:', games);
      }
    }
    
    // Check if the scores table exists
    const hasScores = tables.some(t => t.tablename === 'scores');
    
    if (hasScores) {
      console.log('\n=== Scores ===');
      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('*')
        .limit(5);
      
      if (scoresError) {
        console.error('Error querying scores:', scoresError);
      } else {
        console.log('First 5 scores:', scores);
      }
    }
    
    // Check if the app_role type exists
    console.log('\n=== Checking for app_role type ===');
    const { data: enumTypes, error: enumError } = await supabase
      .rpc('pg_enum_list')
      .contains('enum_name', 'app_role');
    
    if (enumError) {
      console.error('Error checking enum types:', enumError);
    } else {
      console.log('App role enum values:', enumTypes);
    }
    
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkSchema();
