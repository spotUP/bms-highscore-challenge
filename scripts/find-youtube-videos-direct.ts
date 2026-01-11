#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findGamesWithYouTube() {
  try {
    // Check if there's a table with more metadata
    const { data: gameData, error: gameError } = await supabase
      .from('games_database')
      .select('*, video_url')
      .not('video_url', 'is', null)
      .ilike('video_url', '%youtube%')
      .limit(5);

    if (gameError) {
      console.log('No video_url column in games_database or error:', gameError.message);
    } else {
      console.log('Games with YouTube videos in games_database:');
      console.log('============================================');
      gameData?.forEach(game => {
        console.log(`📺 ${game.name} (${game.platform_name})`);
        console.log(`   ${game.video_url}`);
        console.log('');
      });
    }

    // Let's also check if there are any other game-related tables
    const { data: tablesData, error: tablesError } = await supabase
      .rpc('get_table_names');

    if (tablesError) {
      console.log('Could not get table names, trying alternative approach...');

      // Try checking for a launchbox_games table
      const { data: launchboxData, error: launchboxError } = await supabase
        .from('launchbox_games')
        .select('*')
        .limit(1);

      if (!launchboxError) {
        console.log('Found launchbox_games table structure:');
        console.log('====================================');
        console.log(JSON.stringify(launchboxData?.[0], null, 2));
      } else {
        console.log('No launchbox_games table found:', launchboxError.message);
      }
    }

  } catch (err) {
    console.error('Failed to query:', err);
  }
}

findGamesWithYouTube().then(() => process.exit(0));