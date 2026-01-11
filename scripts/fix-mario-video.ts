#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixMarioVideo() {
  console.log('🔧 Fixing Super Mario Bros video...\n');

  const gameId = -49860; // The main Super Mario Bros. on NES

  try {
    // Get current game data
    const { data: currentGame, error: fetchError } = await supabase
      .from('games_database')
      .select('*')
      .eq('id', gameId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching game:', fetchError);
      return;
    }

    console.log(`📍 Current game: ${currentGame.name} (${currentGame.platform_name})`);

    // Parse existing metadata if any
    let currentData = {};
    if (currentGame.logo_base64) {
      try {
        const decoded = Buffer.from(currentGame.logo_base64, 'base64').toString('utf-8');
        currentData = JSON.parse(decoded);
        console.log('📝 Found existing metadata');
      } catch (e) {
        console.log('📝 No JSON metadata found, will create new');
      }
    }

    // Add proper Super Mario Bros video and metadata
    const newMetadata = {
      ...currentData,
      video_url: 'https://www.youtube.com/watch?v=rWp6KsHhjl0', // Classic NES Super Mario Bros gameplay
      release_year: 1985,
      developer: 'Nintendo',
      publisher: 'Nintendo',
      overview: 'A legendary side-scrolling platform game where Mario must rescue Princess Peach from Bowser in the Mushroom Kingdom.',
      genres: ['Platform', 'Action'],
      max_players: 2,
      esrb_rating: 'E',
      community_rating: 4.5
    };

    const encodedMetadata = Buffer.from(JSON.stringify(newMetadata)).toString('base64');

    // Update the game
    const { error: updateError } = await supabase
      .from('games_database')
      .update({
        logo_base64: encodedMetadata
      })
      .eq('id', gameId);

    if (updateError) {
      console.error('❌ Error updating game:', updateError);
      return;
    }

    console.log('✅ Successfully updated Super Mario Bros with proper video!');
    console.log(`🎬 Video URL: ${newMetadata.video_url}`);
    console.log(`📅 Release Year: ${newMetadata.release_year}`);
    console.log(`🏢 Developer: ${newMetadata.developer}`);
    console.log(`📖 Overview: ${newMetadata.overview}`);

  } catch (error) {
    console.error('❌ Update failed:', error);
  }
}

fixMarioVideo().then(() => process.exit(0));