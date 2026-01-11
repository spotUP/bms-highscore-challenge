#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkExistingGames() {
  console.log('🔍 Checking for existing games...');

  try {
    // Check games_database table
    const { data: gamesDb, error: gamesError } = await supabase
      .from('games_database')
      .select('*')
      .limit(5);

    if (gamesError) {
      console.log('❌ Error checking games_database:', gamesError);
    } else {
      console.log(`\n📊 games_database table:`);
      console.log(`Found ${gamesDb.length} games`);
      if (gamesDb.length > 0) {
        console.log('\nSample game:');
        console.log(JSON.stringify(gamesDb[0], null, 2));
      }
    }

    // Check games table
    const { data: games, error: gamesTableError } = await supabase
      .from('games')
      .select('*')
      .limit(5);

    if (gamesTableError) {
      console.log('❌ Error checking games table:', gamesTableError);
    } else {
      console.log(`\n📊 games table:`);
      console.log(`Found ${games.length} games`);
      if (games.length > 0) {
        console.log('\nSample game:');
        console.log(JSON.stringify(games[0], null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkExistingGames();