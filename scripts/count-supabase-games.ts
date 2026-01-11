#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function countGames() {
  console.log('🔍 Counting games in Supabase database...');

  try {
    // Check games_database table
    const { count, error } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('❌ Error counting games_database:', error);
      return;
    }

    console.log(`📊 Total games in games_database: ${count}`);

    // Also check for 'games' table
    const { count: gamesCount, error: gamesError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });

    if (!gamesError) {
      console.log(`📊 Total games in games table: ${gamesCount}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

countGames().catch(console.error);