#!/usr/bin/env tsx

// Clean up Supabase database by removing niche/obscure platforms
// This removes games from platforms we don't want to support

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

// Platforms to remove (same as Clear Logo cleanup)
const PLATFORMS_TO_REMOVE = [
  '3DO Interactive Multiplayer',
  'APF Imagination Machine',
  'Aamber Pegasus',
  'Acorn Archimedes',
  'Acorn Atom',
  'Acorn Electron',
  'Amstrad CPC',
  'Amstrad GX4000',
  'Android',
  'Apogee BK-01',
  'Apple II',
  'Apple IIGS',
  'Apple Mac OS',
  'Apple iOS',
  'Atari 2600',
  'Atari 5200',
  'Atari 7800',
  'Atari 800',
  'Atari XEGS',
  'BBC Microcomputer System',
  'Camputers Lynx',
  'Casio Loopy',
  'Casio PV-1000',
  'Coleco ADAM',
  'ColecoVision',
  'Commodore 128',
  'Commodore MAX Machine',
  'Commodore PET',
  'Commodore Plus 4',
  'Commodore VIC-20',
  'Dragon 32/64',
  'EACA EG2000 Colour Genie',
  'Elektronika BK',
  'Emerson Arcadia 2001',
  'Enterprise',
  'Entex Adventure Vision',
  'Epoch Game Pocket Computer',
  'Epoch Super Cassette Vision',
  'Exelvision EXL 100',
  'Fairchild Channel F',
  'Funtech Super Acan',
  'GCE Vectrex',
  'GamePark GP32',
  'Hartung Game Master',
  'Hector HRX',
  'Interton VC 4000',
  'Jupiter Ace',
  'Linux',
  'MS-DOS',
  'Magnavox Odyssey',
  'Magnavox Odyssey 2',
  'Matra and Hachette Alice',
  'Mattel Aquarius',
  'Mattel HyperScan',
  'Mattel Intellivision',
  'Mega Duck',
  'Memotech MTX512',
  'Microsoft MSX',
  'Microsoft MSX2',
  'Microsoft MSX2+',
  'Microsoft Xbox',
  'Microsoft Xbox 360',
  'Microsoft Xbox One',
  'NEC PC-8801',
  'NEC PC-9801',
  'Nokia N-Gage',
  'Nuon',
  'Oric Atmos',
  'Ouya',
  'Philips CD-i',
  'Philips Videopac+',
  'RCA Studio II',
  'ScummVM',
  'Sega Pico',
  'Sharp X1',
  'Sinclair ZX-81',
  'Sony PSP Minis',
  'Sord M5',
  'TRS-80 Color Computer',
  'Tandy TRS-80',
  'Texas Instruments TI 99/4A',
  'Tiger Game.com',
  'Tomy Tutor',
  'VTech CreatiVision',
  'VTech Socrates',
  'Watara Supervision',
  'Web Browser',
  'Windows 3.X',
  'ZiNc',
  // Additional platforms to remove for size constraints
  'Windows',
  'Microsoft Xbox',
  'Microsoft Xbox 360',
  'Microsoft Xbox One',
  'Sony Playstation 3',
  'Sony Playstation 4'
];

async function cleanupSupabasePlatforms() {
  console.log('🧹 Starting Supabase platform cleanup...');

  // Initialize Supabase client
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration:');
    console.error('   VITE_SUPABASE_URL');
    console.error('   SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get current counts
  console.log('📊 Getting current game counts by platform...');

  const { data: platformCounts, error: countError } = await supabase
    .from('games_database')
    .select('platform_name, id')
    .not('platform_name', 'is', null);

  if (countError) {
    console.error('❌ Error getting platform counts:', countError);
    return;
  }

  // Count games by platform
  const platformMap = new Map<string, number>();
  platformCounts?.forEach(game => {
    const platform = game.platform_name || 'Unknown';
    platformMap.set(platform, (platformMap.get(platform) || 0) + 1);
  });

  const totalBefore = platformCounts?.length || 0;
  console.log(`📊 Total games before cleanup: ${totalBefore.toLocaleString()}`);

  // Show platforms that will be removed
  console.log('');
  console.log('🗂️ Platforms to be removed from Supabase:');
  let toRemoveCount = 0;

  for (const platform of PLATFORMS_TO_REMOVE) {
    const count = platformMap.get(platform) || 0;
    if (count > 0) {
      console.log(`   ${platform}: ${count.toLocaleString()} games`);
      toRemoveCount += count;
    }
  }

  console.log(`📊 Total games to remove: ${toRemoveCount.toLocaleString()}`);

  if (toRemoveCount === 0) {
    console.log('✅ No games found with niche platforms - database already clean!');
    return;
  }

  // Confirm before deletion
  console.log('');
  console.log('⚠️ This will permanently delete games from these platforms.');
  console.log('📋 Proceeding with cleanup in batches...');

  let totalRemoved = 0;
  const BATCH_SIZE = 1000;

  // Remove games for each platform
  for (const platform of PLATFORMS_TO_REMOVE) {
    const platformCount = platformMap.get(platform) || 0;
    if (platformCount === 0) continue;

    console.log(`🗑️ Removing ${platformCount.toLocaleString()} games from ${platform}...`);

    let removed = 0;
    while (true) {
      // Delete in batches to avoid timeouts
      const { data: batch, error: selectError } = await supabase
        .from('games_database')
        .select('id')
        .eq('platform_name', platform)
        .limit(BATCH_SIZE);

      if (selectError) {
        console.error(`❌ Error selecting games for ${platform}:`, selectError);
        break;
      }

      if (!batch || batch.length === 0) {
        break; // No more games for this platform
      }

      const gameIds = batch.map(game => game.id);
      const { error: deleteError, count } = await supabase
        .from('games_database')
        .delete()
        .in('id', gameIds);

      if (deleteError) {
        console.error(`❌ Error deleting games for ${platform}:`, deleteError);
        break;
      }

      removed += count || 0;
      totalRemoved += count || 0;

      if (batch.length < BATCH_SIZE) {
        break; // Last batch
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Removed ${removed.toLocaleString()} games from ${platform}`);
  }

  // Get final counts
  const { data: finalCounts, error: finalError } = await supabase
    .from('games_database')
    .select('id')
    .not('platform_name', 'is', null);

  if (finalError) {
    console.error('❌ Error getting final counts:', finalError);
    return;
  }

  const totalAfter = finalCounts?.length || 0;

  console.log('');
  console.log('🎉 Supabase platform cleanup completed!');
  console.log(`📊 Games before cleanup: ${totalBefore.toLocaleString()}`);
  console.log(`📊 Games after cleanup: ${totalAfter.toLocaleString()}`);
  console.log(`🗑️ Games removed: ${totalRemoved.toLocaleString()}`);
  console.log(`📈 Reduction: ${((totalRemoved / totalBefore) * 100).toFixed(1)}%`);

  // Show remaining top platforms
  console.log('');
  console.log('🎯 Getting remaining platform counts...');

  const { data: remainingPlatforms, error: remainingError } = await supabase
    .from('games_database')
    .select('platform_name, id')
    .not('platform_name', 'is', null);

  if (!remainingError && remainingPlatforms) {
    const remainingMap = new Map<string, number>();
    remainingPlatforms.forEach(game => {
      const platform = game.platform_name || 'Unknown';
      remainingMap.set(platform, (remainingMap.get(platform) || 0) + 1);
    });

    const sortedPlatforms = Array.from(remainingMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    console.log('Top 15 remaining platforms:');
    sortedPlatforms.forEach(([platform, count]) => {
      console.log(`   ${platform}: ${count.toLocaleString()} games`);
    });
  }

  console.log('');
  console.log('💡 Benefits:');
  console.log('   ✅ Focused on mainstream gaming platforms');
  console.log('   ✅ Improved database performance');
  console.log('   ✅ Better user experience with relevant content');
  console.log('   ✅ Consistent with Clear Logo dataset');
}

// Run the cleanup
cleanupSupabasePlatforms().catch(console.error);