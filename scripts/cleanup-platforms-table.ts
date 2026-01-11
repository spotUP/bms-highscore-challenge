#!/usr/bin/env tsx

// Remove unwanted platforms from Supabase platforms table
// This will clean up the platform dropdown in the games browser

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

// Platforms to remove from the dropdown
const PLATFORMS_TO_REMOVE = [
  'Windows',
  'Nintendo DS',
  'Nintendo Wii',
  'Microsoft Xbox',
  'Microsoft Xbox 360',
  'Microsoft Xbox One',
  'Sony Playstation 3',
  'Sony Playstation 4',
  // Additional niche platforms from your original list
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
  'ZiNc'
];

async function cleanupPlatformsTable() {
  console.log('🧹 Starting platforms table cleanup...');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration:');
    console.error('   VITE_SUPABASE_URL');
    console.error('   SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get current platform count
  const { data: allPlatforms, error: countError } = await supabase
    .from('platforms')
    .select('id, name')
    .order('name');

  if (countError) {
    console.error('❌ Error getting platform count:', countError);
    return;
  }

  console.log(`📊 Total platforms before cleanup: ${allPlatforms?.length || 0}`);

  // Show platforms that will be removed
  console.log('');
  console.log('🗂️ Platforms to be removed:');
  let toRemoveCount = 0;

  for (const platformName of PLATFORMS_TO_REMOVE) {
    const platform = allPlatforms?.find(p => p.name === platformName);
    if (platform) {
      console.log(`   ${platformName} (${platform.id})`);
      toRemoveCount++;
    }
  }

  console.log(`📊 Total platforms to remove: ${toRemoveCount}`);

  if (toRemoveCount === 0) {
    console.log('✅ No matching platforms found - table already clean!');
    return;
  }

  // Remove platforms
  let totalRemoved = 0;

  for (const platformName of PLATFORMS_TO_REMOVE) {
    const platform = allPlatforms?.find(p => p.name === platformName);
    if (!platform) continue;

    console.log(`🗑️ Removing ${platformName}...`);

    const { error: deleteError, count } = await supabase
      .from('platforms')
      .delete()
      .eq('id', platform.id);

    if (deleteError) {
      console.error(`❌ Error removing ${platformName}:`, deleteError);
    } else {
      totalRemoved += count || 0;
      console.log(`✅ Removed ${platformName}`);
    }
  }

  // Get final count
  const { data: finalPlatforms, error: finalError } = await supabase
    .from('platforms')
    .select('id, name')
    .order('name');

  if (finalError) {
    console.error('❌ Error getting final count:', finalError);
    return;
  }

  console.log('');
  console.log('🎉 Platforms table cleanup completed!');
  console.log(`📊 Platforms before cleanup: ${allPlatforms?.length || 0}`);
  console.log(`📊 Platforms after cleanup: ${finalPlatforms?.length || 0}`);
  console.log(`🗑️ Platforms removed: ${totalRemoved}`);

  // Show remaining mainstream platforms
  console.log('');
  console.log('🎯 Top 20 remaining platforms:');
  finalPlatforms?.slice(0, 20).forEach(platform => {
    console.log(`   ${platform.name}`);
  });

  console.log('');
  console.log('💡 Benefits:');
  console.log('   ✅ Platform dropdown now shows only mainstream platforms');
  console.log('   ✅ Better user experience in games browser');
  console.log('   ✅ Consistent with Clear Logo dataset');
}

cleanupPlatformsTable().catch(console.error);