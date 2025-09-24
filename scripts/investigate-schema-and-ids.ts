#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function investigateSchemaAndIds() {
  console.log('🔍 Investigating current database schema and ID mappings...\n');

  try {
    // 1. Check current games_database schema
    console.log('📋 Current games_database schema:');
    const { data: sampleData, error: sampleError } = await supabase
      .from('games_database')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('Error fetching sample data:', sampleError);
      return;
    }

    if (sampleData && sampleData.length > 0) {
      console.log('Sample record structure:');
      Object.keys(sampleData[0]).forEach(field => {
        console.log(`  - ${field}: ${typeof sampleData[0][field]}`);
      });
      console.log('\nSample data:');
      console.log(JSON.stringify(sampleData[0], null, 2));
    }

    // 2. Check if video_url column exists
    console.log('\n🎬 Checking for video_url column...');
    const { data: videoData, error: videoError } = await supabase
      .from('games_database')
      .select('video_url')
      .limit(1);

    if (videoError) {
      console.log('❌ video_url column does NOT exist');
      console.log('Error:', videoError.message);
    } else {
      console.log('✅ video_url column exists');
    }

    // 3. Get a few sample games with known data for comparison
    console.log('\n🎮 Sample games for ID mapping analysis:');
    const { data: games, error: gamesError } = await supabase
      .from('games_database')
      .select('id, name, platform_name')
      .in('name', ['Super Mario Bros.', 'The Legend of Zelda', 'Sonic the Hedgehog', 'Pac-Man'])
      .limit(10);

    if (!gamesError && games) {
      games.forEach(game => {
        console.log(`  ID: ${game.id} | Name: ${game.name} | Platform: ${game.platform_name}`);
      });
    }

    // 4. Check ID ranges to understand the current mapping
    console.log('\n📊 ID range analysis:');
    const { data: idStats, error: idStatsError } = await supabase
      .rpc('get_id_stats')
      .single();

    if (idStatsError) {
      // Alternative approach if RPC doesn't exist
      const { data: minMaxData } = await supabase
        .from('games_database')
        .select('id')
        .order('id', { ascending: true })
        .limit(1);

      const { data: maxData } = await supabase
        .from('games_database')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);

      if (minMaxData && maxData && minMaxData.length > 0 && maxData.length > 0) {
        console.log(`  Min ID: ${minMaxData[0].id}`);
        console.log(`  Max ID: ${maxData[0].id}`);
        console.log(`  Estimated offset: ${minMaxData[0].id} (if XML starts from ~50,000)`);
      }
    }

    // 5. Test a few sample LaunchBox URLs to verify ID mapping works
    console.log('\n🌐 Testing LaunchBox URL compatibility:');
    if (games && games.length > 0) {
      games.slice(0, 3).forEach(game => {
        const potentialUrl = `https://gamesdb.launchbox-app.com/games/details/${game.id}`;
        console.log(`  ${game.name} -> ${potentialUrl}`);
      });
    }

    console.log('\n✅ Schema investigation complete!');

  } catch (error) {
    console.error('Investigation failed:', error);
  }
}

investigateSchemaAndIds().then(() => process.exit(0));