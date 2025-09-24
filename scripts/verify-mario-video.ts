#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyMarioVideo() {
  console.log('🔍 Verifying Super Mario Bros video data...\n');

  const gameId = -49860; // The main Super Mario Bros. on NES

  try {
    // Get current game data
    const { data: game, error } = await supabase
      .from('games_database')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error) {
      console.error('❌ Error fetching game:', error);
      return;
    }

    console.log(`📍 Game: ${game.name} (${game.platform_name})`);
    console.log(`📍 ID: ${game.id}`);

    if (game.logo_base64) {
      try {
        const decoded = Buffer.from(game.logo_base64, 'base64').toString('utf-8');
        const metadata = JSON.parse(decoded);

        console.log('\n✅ Metadata found:');
        console.log(`🎬 Video URL: ${metadata.video_url || 'NOT FOUND'}`);
        console.log(`📅 Release Year: ${metadata.release_year || 'NOT FOUND'}`);
        console.log(`🏢 Developer: ${metadata.developer || 'NOT FOUND'}`);
        console.log(`📖 Overview: ${metadata.overview || 'NOT FOUND'}`);

        if (metadata.video_url) {
          console.log('\n🎉 Video URL is properly stored!');
          console.log('🔧 The GameDetailsModal should display this video.');
          console.log('🚀 Make sure to refresh the browser and search for "Super Mario Bros"');
        } else {
          console.log('\n❌ No video_url found in metadata');
        }

      } catch (e) {
        console.log('❌ logo_base64 exists but is not valid JSON metadata');
        console.log('Raw logo_base64 length:', game.logo_base64.length);
      }
    } else {
      console.log('❌ No logo_base64 data found');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyMarioVideo().then(() => process.exit(0));