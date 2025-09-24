#!/usr/bin/env tsx

// Compare LaunchBox XML data imported into Supabase vs actual LaunchBox website

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

console.log('🔍 Investigating XML vs LaunchBox website discrepancy...');

// What we know works from the website
const KNOWN_CORRECT_MAPPINGS = {
  1: 'Halo: Combat Evolved',
  2: 'Crysis',
  6: 'Halo 2',
  9: 'Assassin\'s Creed',
  10: 'BioShock',
  11: 'Dead Space (2008)',
  29: 'Jade Empire: Special Edition',
  32: 'Killzone'  // This should be Killzone, but XML might have it wrong
};

console.log('\n📊 Checking what your Supabase database says vs LaunchBox website:');

for (const [correctId, correctName] of Object.entries(KNOWN_CORRECT_MAPPINGS)) {
  console.log(`\n🎮 LaunchBox ID ${correctId} should be: "${correctName}"`);

  // Check what Supabase claims for this LaunchBox ID
  const { data: gamesWithThisId } = await supabase
    .from('games_database')
    .select('id, name, platform_name, launchbox_id')
    .eq('launchbox_id', parseInt(correctId))
    .limit(3);

  if (gamesWithThisId && gamesWithThisId.length > 0) {
    console.log(`📋 Supabase games with LaunchBox ID ${correctId}:`);
    gamesWithThisId.forEach(game => {
      const match = game.name.toLowerCase().includes(correctName.toLowerCase().split(':')[0]);
      const status = match ? '✅ MATCH' : '🚨 WRONG';
      console.log(`   ${status}: "${game.name}" (${game.platform_name})`);
    });
  } else {
    console.log(`❌ No games in Supabase claim LaunchBox ID ${correctId}`);
  }

  // Also check what game Supabase thinks has this correct name
  const { data: gamesWithCorrectName } = await supabase
    .from('games_database')
    .select('id, name, platform_name, launchbox_id')
    .ilike('name', `%${correctName.split(':')[0]}%`)
    .eq('platform_name', 'Windows')
    .limit(1);

  if (gamesWithCorrectName && gamesWithCorrectName.length > 0) {
    const game = gamesWithCorrectName[0];
    if (game.launchbox_id !== parseInt(correctId)) {
      console.log(`🚨 DISCREPANCY: "${correctName}" in Supabase claims LaunchBox ID ${game.launchbox_id}, but website shows it's ID ${correctId}`);
    } else {
      console.log(`✅ CONSISTENT: "${correctName}" has correct LaunchBox ID ${correctId} in both`);
    }
  }
}

console.log('\n💡 Analysis:');
console.log('If we see many discrepancies, it means the LaunchBox XML export you imported');
console.log('has different ID numbering than the current LaunchBox website database.');
console.log('This could be due to:');
console.log('1. XML export being from an older version');
console.log('2. XML export using internal IDs vs website IDs');
console.log('3. Data migration/renumbering in LaunchBox over time');

// Check when the data was imported or if there's version info
console.log('\n🔍 Checking for any version/import metadata...');
const { data: sampleGames } = await supabase
  .from('games_database')
  .select('*')
  .limit(1);

if (sampleGames && sampleGames.length > 0) {
  console.log('📋 Sample game record structure:');
  console.log(JSON.stringify(sampleGames[0], null, 2));
}