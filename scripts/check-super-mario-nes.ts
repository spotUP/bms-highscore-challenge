#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkSuperMarioNES() {
  console.log('🔍 Looking specifically for Super Mario Bros. on Nintendo Entertainment System...');

  // Check for exact match
  const { data: nesData, error: nesError } = await supabase
    .from('games_database')
    .select('*')
    .eq('name', 'Super Mario Bros.')
    .eq('platform_name', 'Nintendo Entertainment System')
    .single();

  if (!nesError && nesData) {
    console.log('🍄 Found Super Mario Bros. for NES:');
    console.log(`  ID: ${nesData.id}`);
    console.log(`  LaunchBox ID: ${nesData.database_id}`);
    console.log(`  Name: "${nesData.name}"`);
    console.log(`  Platform: ${nesData.platform_name}`);
    console.log(`  Video: ${nesData.video_url || 'None'}`);
    console.log(`  Developer: ${nesData.developer || 'None'}`);
    console.log(`  Release Year: ${nesData.release_year || 'None'}`);
    console.log('');
  } else {
    console.log('❌ Super Mario Bros. for NES not found. Let me check for similar names...');

    // Check for partial matches
    const { data: partialData, error: partialError } = await supabase
      .from('games_database')
      .select('*')
      .ilike('name', '%super mario bros%')
      .eq('platform_name', 'Nintendo Entertainment System')
      .limit(5);

    if (!partialError && partialData && partialData.length > 0) {
      console.log('🔍 Found similar Super Mario games for NES:');
      partialData.forEach(game => {
        console.log(`  ID: ${game.id}, Name: "${game.name}", Video: ${game.video_url || 'None'}`);
      });
    } else {
      console.log('❌ No Super Mario games found for Nintendo Entertainment System');
    }
  }

  // Check if ID -49860 exists at all
  const { data: idData, error: idError } = await supabase
    .from('games_database')
    .select('*')
    .eq('id', -49860)
    .single();

  if (!idError && idData) {
    console.log(`✅ Game with ID -49860 exists:`)
    console.log(`  Name: "${idData.name}"`);
    console.log(`  Platform: ${idData.platform_name}`);
    console.log(`  LaunchBox ID: ${idData.database_id}`);
    console.log(`  Video: ${idData.video_url || 'None'}`);
  } else {
    console.log('❌ No game found with ID -49860');
  }
}

checkSuperMarioNES().then(() => process.exit(0));