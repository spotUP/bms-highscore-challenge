#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugMarioUpdate() {
  console.log('🔧 Debug: Updating Super Mario Bros video with detailed error checking...\n');

  const gameId = -49860; // The main Super Mario Bros. on NES

  try {
    // First, let's see what's currently in the database
    console.log('1. Checking current state...');
    const { data: currentGame, error: fetchError } = await supabase
      .from('games_database')
      .select('id, name, platform_name, logo_base64')
      .eq('id', gameId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching game:', fetchError);
      return;
    }

    console.log(`✅ Found game: ${currentGame.name}`);
    console.log(`   ID: ${currentGame.id}`);
    console.log(`   Platform: ${currentGame.platform_name}`);
    console.log(`   Has logo_base64: ${currentGame.logo_base64 ? 'YES' : 'NO'}`);

    // Prepare metadata
    const metadata = {
      video_url: 'https://www.youtube.com/watch?v=rWp6KsHhjl0',
      release_year: 1985,
      developer: 'Nintendo',
      publisher: 'Nintendo',
      overview: 'A legendary side-scrolling platform game where Mario must rescue Princess Peach from Bowser in the Mushroom Kingdom.',
      genres: ['Platform', 'Action'],
      max_players: 2,
      esrb_rating: 'E',
      community_rating: 4.5
    };

    const encodedMetadata = Buffer.from(JSON.stringify(metadata)).toString('base64');
    console.log(`\n2. Encoded metadata length: ${encodedMetadata.length} characters`);

    // Attempt update with detailed error logging
    console.log('3. Attempting update...');
    const { data: updateData, error: updateError } = await supabase
      .from('games_database')
      .update({ logo_base64: encodedMetadata })
      .eq('id', gameId)
      .select();

    if (updateError) {
      console.error('❌ Update failed with error:', updateError);
      console.error('   Message:', updateError.message);
      console.error('   Details:', updateError.details);
      console.error('   Hint:', updateError.hint);
      console.error('   Code:', updateError.code);
      return;
    }

    console.log('✅ Update completed!');
    console.log('   Affected rows:', updateData?.length || 0);

    // Verify the update
    console.log('\n4. Verifying update...');
    const { data: verifyGame, error: verifyError } = await supabase
      .from('games_database')
      .select('logo_base64')
      .eq('id', gameId)
      .single();

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
      return;
    }

    if (verifyGame.logo_base64) {
      try {
        const decoded = Buffer.from(verifyGame.logo_base64, 'base64').toString('utf-8');
        const parsedData = JSON.parse(decoded);
        console.log('✅ Update verified successfully!');
        console.log(`🎬 Video URL: ${parsedData.video_url}`);
      } catch (e) {
        console.log('❌ Data exists but cannot be parsed as JSON');
      }
    } else {
      console.log('❌ No logo_base64 data found after update');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

debugMarioUpdate().then(() => process.exit(0));