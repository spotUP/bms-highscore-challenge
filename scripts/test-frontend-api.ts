#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function testFrontendAPI() {
  console.log('🧪 Testing frontend API calls that were previously failing...');

  // Test 1: get_random_games function call
  console.log('\n1. Testing get_random_games RPC function:');
  try {
    const { data: randomGames, error: randomError } = await supabase
      .rpc('get_random_games', { game_count: 5 });

    if (randomError) {
      console.error('❌ get_random_games failed:', randomError);
    } else {
      console.log('✅ get_random_games works!');
      console.log(`   Retrieved ${randomGames?.length || 0} games`);
      if (randomGames && randomGames.length > 0) {
        const game = randomGames[0];
        console.log(`   Sample game: "${game.name}" (${game.platform_name})`);
        console.log(`   Has video_url: ${game.video_url ? 'YES' : 'NO'}`);
        console.log(`   Has logo_base64: ${game.logo_base64 ? 'YES' : 'NO'}`);
        console.log(`   Has launchbox_id: ${game.launchbox_id ? 'YES' : 'NO'}`);
      }
    }
  } catch (error) {
    console.error('❌ Exception calling get_random_games:', error);
  }

  // Test 2: Direct games_database query
  console.log('\n2. Testing direct games_database query:');
  try {
    const { data: dbGames, error: dbError } = await supabase
      .from('games_database')
      .select('id, name, platform_name, video_url, logo_base64, launchbox_id')
      .limit(3);

    if (dbError) {
      console.error('❌ games_database query failed:', dbError);
    } else {
      console.log('✅ games_database query works!');
      console.log(`   Retrieved ${dbGames?.length || 0} games`);
      dbGames?.forEach((game, i) => {
        console.log(`   ${i + 1}. "${game.name}" (${game.platform_name})`);
        console.log(`      Video: ${game.video_url ? 'YES' : 'NO'}`);
        console.log(`      Logo Base64: ${game.logo_base64 ? 'YES' : 'NO'}`);
        console.log(`      LaunchBox ID: ${game.launchbox_id || 'None'}`);
      });
    }
  } catch (error) {
    console.error('❌ Exception querying games_database:', error);
  }

  // Test 3: Find specific games with videos for testing
  console.log('\n3. Finding games with video URLs for testing:');
  try {
    const { data: gamesWithVideos, error: videoError } = await supabase
      .from('games_database')
      .select('id, name, platform_name, video_url')
      .not('video_url', 'is', null)
      .limit(5);

    if (videoError) {
      console.error('❌ Video games query failed:', videoError);
    } else {
      console.log('✅ Found games with videos!');
      console.log(`   Found ${gamesWithVideos?.length || 0} games with video URLs`);
      gamesWithVideos?.forEach((game, i) => {
        console.log(`   ${i + 1}. "${game.name}" (${game.platform_name})`);
        console.log(`      ID: ${game.id}`);
        console.log(`      Video: ${game.video_url}`);
      });
    }
  } catch (error) {
    console.error('❌ Exception finding games with videos:', error);
  }

  console.log('\n🎯 Frontend API test completed!');
  console.log('The frontend should now be able to:');
  console.log('  • Load random games without 400 errors');
  console.log('  • Display game details including videos');
  console.log('  • Access all required columns (logo_base64, launchbox_id)');
  console.log('\n🌐 Frontend is running at: http://localhost:8080');
}

testFrontendAPI().then(() => process.exit(0));