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

async function checkDatabase() {
  console.log('Checking database connection and tables...\n');

  // Try to query games table
  console.log('1. Checking games table...');
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .limit(5);

  if (gamesError) {
    console.error('❌ Error with games table:', gamesError.message);
  } else {
    console.log(`✅ Games table accessible. Found ${games?.length || 0} games`);
    if (games && games.length > 0) {
      console.log('   Sample game:', games[0].name);
    }
  }

  // Try to query scores table
  console.log('\n2. Checking scores table...');
  const { data: scores, error: scoresError } = await supabase
    .from('scores')
    .select('*')
    .limit(5);

  if (scoresError) {
    console.error('❌ Error with scores table:', scoresError.message);
  } else {
    console.log(`✅ Scores table accessible. Found ${scores?.length || 0} scores`);
  }

  // Try to query tournaments table
  console.log('\n3. Checking tournaments table...');
  const { data: tournaments, error: tournamentsError } = await supabase
    .from('tournaments')
    .select('*')
    .limit(5);

  if (tournamentsError) {
    console.error('❌ Error with tournaments table:', tournamentsError.message);
  } else {
    console.log(`✅ Tournaments table accessible. Found ${tournaments?.length || 0} tournaments`);
    if (tournaments && tournaments.length > 0) {
      console.log('   Default tournament:', tournaments.find(t => t.is_default)?.name || 'None');
    }
  }

  // Try to query user_roles table
  console.log('\n4. Checking user_roles table...');
  const { data: userRoles, error: userRolesError } = await supabase
    .from('user_roles')
    .select('*')
    .limit(5);

  if (userRolesError) {
    console.error('❌ Error with user_roles table:', userRolesError.message);
  } else {
    console.log(`✅ User roles table accessible. Found ${userRoles?.length || 0} user roles`);
  }

  // Try to query profiles table
  console.log('\n5. Checking profiles table...');
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .limit(5);

  if (profilesError) {
    console.error('❌ Error with profiles table:', profilesError.message);
  } else {
    console.log(`✅ Profiles table accessible. Found ${profiles?.length || 0} profiles`);
  }

  console.log('\n=== Database check complete ===');
}

checkDatabase();