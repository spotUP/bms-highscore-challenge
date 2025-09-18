#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tnsgrwntmnzpaifmutqh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuc2dyd250bW56cGFpZm11dHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjYwNzc1MzQsImV4cCI6MjA0MTY1MzUzNH0.hSOVymBCUjXCqTzqPcaJJqn2ps-E2cjdoYI0f9QE9mo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPopularGameLogos() {
  console.log('Testing clear logos for popular games...');

  // Get some popular games with database_id but no logo_url
  const { data: games, error } = await supabase
    .from('games_database')
    .select('id, name, database_id, logo_url, platform_name')
    .not('database_id', 'is', null)
    .is('logo_url', null)
    .in('name', [
      'Street Fighter II',
      'Pac-Man',
      'Donkey Kong',
      'Super Mario Bros.',
      'Tetris',
      'Mortal Kombat',
      'Street Fighter Alpha',
      'Final Fight',
      'The King of Fighters',
      'Metal Slug'
    ])
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!games || games.length === 0) {
    console.log('No test games found');
    return;
  }

  console.log(`Testing ${games.length} games:`);

  for (const game of games) {
    const directUrl = `https://images.launchbox-app.com/clearlogo/${game.database_id}-01.png`;

    try {
      const response = await fetch(directUrl, { method: 'HEAD' });
      console.log(`${game.name} (${game.database_id}): ${response.ok ? '✅ Has clear logo' : '❌ No clear logo'}`);
      if (response.ok) {
        console.log(`  URL: ${directUrl}`);
      }
    } catch (error) {
      console.log(`${game.name}: ❌ Error checking`);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

testPopularGameLogos();