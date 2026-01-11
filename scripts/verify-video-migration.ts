#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyVideoMigration() {
  console.log('🔍 Verifying video migration results...\n');

  try {
    // Check if the video_url column exists and get games with videos
    const { data: gamesWithVideos, error } = await supabase
      .from('games_database')
      .select('id, name, platform_name, video_url, developer, release_year, overview')
      .not('video_url', 'is', null)
      .order('name');

    if (error) {
      console.error('❌ Error querying games with videos:', error);
      return;
    }

    if (!gamesWithVideos || gamesWithVideos.length === 0) {
      console.log('❌ No games with videos found after migration');
      return;
    }

    console.log(`✅ Found ${gamesWithVideos.length} games with videos:\n`);

    gamesWithVideos.forEach((game, index) => {
      console.log(`${index + 1}. 📺 ${game.name}`);
      console.log(`   Platform: ${game.platform_name}`);
      console.log(`   Developer: ${game.developer || 'N/A'}`);
      console.log(`   Year: ${game.release_year || 'N/A'}`);
      console.log(`   Video: ${game.video_url}`);
      console.log(`   Overview: ${game.overview ? game.overview.substring(0, 80) + '...' : 'N/A'}`);
      console.log('');
    });

    // Test specific games that should have videos
    console.log('🎯 Testing specific expected games:\n');

    const expectedGames = [
      { name: 'Super Mario Bros.', platform: 'Nintendo Entertainment System' },
      { name: 'The Legend of Zelda', platform: 'Nintendo Entertainment System' },
      { name: '3D Atlas', platform: '3DO Interactive Multiplayer' }
    ];

    for (const expected of expectedGames) {
      const { data: game, error: gameError } = await supabase
        .from('games_database')
        .select('id, name, platform_name, video_url')
        .ilike('name', expected.name)
        .ilike('platform_name', `%${expected.platform}%`)
        .single();

      if (gameError || !game) {
        console.log(`❌ ${expected.name} not found`);
        continue;
      }

      if (game.video_url) {
        console.log(`✅ ${game.name} (${game.platform_name})`);
        console.log(`   ID: ${game.id}`);
        console.log(`   Video: ${game.video_url}`);
      } else {
        console.log(`⚠️ ${game.name} found but no video URL`);
      }
      console.log('');
    }

    console.log('🎉 Video migration verification complete!');
    console.log('💡 You can now test these games in the GameDetailsModal to see videos.');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyVideoMigration().then(() => process.exit(0));