#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tnsgrwntmnzpaifmutqh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuc2dyd250bW56cGFpZm11dHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjYwNzc1MzQsImV4cCI6MjA0MTY1MzUzNH0.hSOVymBCUjXCqTzqPcaJJqn2ps-E2cjdoYI0f9QE9mo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExistingLogos() {
  console.log('Checking existing logo URLs...');

  const { data: games, error } = await supabase
    .from('games_database')
    .select('id, name, logo_url')
    .not('logo_url', 'is', null)
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${games?.length || 0} games with logos:`);

  if (games) {
    for (const game of games) {
      console.log(`${game.name}: ${game.logo_url}`);
    }
  }

  // Also check total counts
  const { count: totalGames } = await supabase
    .from('games_database')
    .select('*', { count: 'exact', head: true });

  const { count: gamesWithLogos } = await supabase
    .from('games_database')
    .select('*', { count: 'exact', head: true })
    .not('logo_url', 'is', null);

  console.log(`\nStatistics:`);
  console.log(`Total games: ${totalGames}`);
  console.log(`Games with logos: ${gamesWithLogos}`);
  console.log(`Games without logos: ${(totalGames || 0) - (gamesWithLogos || 0)}`);
}

checkExistingLogos();