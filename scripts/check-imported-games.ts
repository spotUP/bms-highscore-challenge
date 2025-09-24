#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkImportedGames() {
  console.log('🔍 Checking imported games...');

  // Get a sample of imported games with their IDs
  const { data: sampleGames, error: sampleError } = await supabase
    .from('games_database')
    .select('id, name, platform_name, database_id, video_url')
    .order('id')
    .limit(10);

  if (sampleError) {
    console.error('❌ Error getting sample games:', sampleError);
    return;
  }

  console.log('\n📋 First 10 imported games:');
  sampleGames?.forEach(game => {
    console.log(`  ID: ${game.id}, LaunchBox ID: ${game.database_id}, Name: "${game.name}", Platform: ${game.platform_name}`);
    if (game.video_url) {
      console.log(`    Video: ${game.video_url}`);
    }
  });

  // Check for Super Mario Bros specifically
  const { data: marioData, error: marioError } = await supabase
    .from('games_database')
    .select('*')
    .ilike('name', '%super mario bros%')
    .limit(5);

  if (!marioError && marioData && marioData.length > 0) {
    console.log('\n🍄 Found Super Mario games:');
    marioData.forEach(game => {
      console.log(`  ID: ${game.id}, LaunchBox ID: ${game.database_id}, Name: "${game.name}", Platform: ${game.platform_name}`);
      if (game.video_url) {
        console.log(`    Video: ${game.video_url}`);
      }
    });
  } else {
    console.log('\n❌ No Super Mario games found in imported data');
  }

  // Get ID range
  const { data: minMax, error: minMaxError } = await supabase
    .from('games_database')
    .select('id')
    .order('id', { ascending: true })
    .limit(1);

  const { data: maxData, error: maxError } = await supabase
    .from('games_database')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);

  if (!minMaxError && !maxError && minMax && maxData) {
    console.log(`\n📊 ID Range: ${minMax[0].id} to ${maxData[0].id}`);
    console.log(`   Expected Super Mario Bros ID: -49860`);
    console.log(`   Is Super Mario Bros in range? ${minMax[0].id <= -49860 && -49860 <= maxData[0].id ? 'YES' : 'NO'}`);
  }

  // Check count
  const { count, error: countError } = await supabase
    .from('games_database')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`\n📈 Total games imported: ${count}`);
  }
}

checkImportedGames().then(() => process.exit(0));