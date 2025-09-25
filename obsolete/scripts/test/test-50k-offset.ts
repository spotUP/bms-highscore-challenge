#!/usr/bin/env tsx

// Test the 50,000 offset theory for logo mismatch

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

console.log('🔍 Testing 50,000 offset theory...');

// Key insight: If games have a 50,000 offset in their IDs, then:
// - GTA V Windows: Supabase ID -29048, LaunchBox ID 20952
// - Cool World games: Various IDs

console.log('\n📊 Analyzing the specific case:');
console.log('GTA V Windows: Supabase ID -29048, LaunchBox ID 20952');

// Let's see if there's a Cool World with LaunchBox ID that would cause confusion
const coolWorldLaunchBoxIds = [189781, 139221, 9585, 135612, 1681, 21588, 2860];

console.log('\nCool World LaunchBox IDs:', coolWorldLaunchBoxIds);

// Check if any Cool World LaunchBox ID - 50000 = GTA V LaunchBox ID (20952)
// OR if any Cool World LaunchBox ID + 50000 = GTA V LaunchBox ID (20952)
// OR if GTA V LaunchBox ID corresponds to a Cool World when offset is applied

for (const coolId of coolWorldLaunchBoxIds) {
  if (coolId - 50000 === 20952) {
    console.log(`🚨 MATCH: Cool World LaunchBox ID ${coolId} - 50000 = ${coolId - 50000} = GTA V LaunchBox ID!`);
  }
  if (coolId + 50000 === 20952) {
    console.log(`🚨 MATCH: Cool World LaunchBox ID ${coolId} + 50000 = ${coolId + 50000} = GTA V LaunchBox ID!`);
  }
  if (coolId === 20952) {
    console.log(`🚨 DIRECT MATCH: Cool World LaunchBox ID ${coolId} = GTA V LaunchBox ID!`);
  }
}

// Check what game has LaunchBox ID 20952 + 50000 = 70952
console.log('\n🔍 Looking for games with LaunchBox ID around 70952...');
const { data: gamesAround70952 } = await supabase
  .from('games_database')
  .select('id, name, platform_name, launchbox_id')
  .gte('launchbox_id', 70900)
  .lte('launchbox_id', 71000);

gamesAround70952?.forEach(game => {
  console.log(`   LaunchBox ID: ${game.launchbox_id}, Supabase ID: ${game.id}, Name: "${game.name}", Platform: ${game.platform_name}`);
  if (game.launchbox_id === 70952) {
    console.log(`   🎯 FOUND: This is LaunchBox ID 70952!`);
  }
});

// Alternative theory: Maybe the scraper is using the wrong ID when fetching vs storing
console.log('\n💡 Alternative theory:');
console.log('The scraper uses launchbox_id for fetching but game.id for storing.');
console.log('If it fetched Cool World logo using one LaunchBox ID but stored under GTA V Supabase ID...');

console.log('\n🔍 Let\'s check what happens if we reverse-engineer:');
console.log('If GTA V Supabase ID -29048 should correspond to LaunchBox ID 20952');
console.log('But somehow got Cool World\'s logo instead...');

// Find if there's a Cool World game that could be confused with LaunchBox ID 20952
const { data: coolWorldGames } = await supabase
  .from('games_database')
  .select('id, name, platform_name, launchbox_id')
  .ilike('name', '%Cool World%');

console.log('\nAll Cool World games and their LaunchBox IDs:');
coolWorldGames?.forEach(game => {
  const offsetDown = game.launchbox_id - 50000;
  const offsetUp = game.launchbox_id + 50000;
  console.log(`   ${game.name} (${game.platform_name}): LaunchBox ID ${game.launchbox_id}`);
  console.log(`     - 50000 = ${offsetDown}, + 50000 = ${offsetUp}`);

  if (offsetDown === 20952 || offsetUp === 20952 || game.launchbox_id === 20952) {
    console.log(`     🚨 POTENTIAL MATCH with GTA V LaunchBox ID 20952!`);
  }
});