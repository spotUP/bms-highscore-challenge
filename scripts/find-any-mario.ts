#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findAnyMario() {
  console.log('🔍 Looking for ANY Mario game to update as a test...\n');

  try {
    // Look for any Mario game that exists and is easily updatable
    const { data: games, error } = await supabase
      .from('games_database')
      .select('id, name, platform_name, logo_base64')
      .ilike('name', '%mario%')
      .order('id')
      .limit(10);

    if (error) {
      console.error('❌ Error searching games:', error);
      return;
    }

    if (!games || games.length === 0) {
      console.log('❌ No Mario games found at all');
      return;
    }

    console.log(`✅ Found ${games.length} Mario games:\n`);

    for (const game of games) {
      console.log(`📍 ID: ${game.id}`);
      console.log(`   Name: ${game.name}`);
      console.log(`   Platform: ${game.platform_name}`);
      console.log(`   Has metadata: ${game.logo_base64 ? 'YES' : 'NO'}`);
      console.log('');
    }

    // Let's try to update the first one
    const targetGame = games[0];
    console.log(`🎯 Attempting to update: ${targetGame.name} (ID: ${targetGame.id})\n`);

    const metadata = {
      video_url: 'https://www.youtube.com/watch?v=rWp6KsHhjl0',
      release_year: 1985,
      developer: 'Nintendo',
      overview: 'A classic Mario platformer game.'
    };

    const encodedMetadata = Buffer.from(JSON.stringify(metadata)).toString('base64');

    const { data: updateData, error: updateError } = await supabase
      .from('games_database')
      .update({ logo_base64: encodedMetadata })
      .eq('id', targetGame.id)
      .select();

    if (updateError) {
      console.error('❌ Update failed:', updateError);
      return;
    }

    console.log('✅ Update completed!');
    console.log(`   Affected rows: ${updateData?.length || 0}`);

    if (updateData && updateData.length > 0) {
      console.log('🎉 Successfully updated a Mario game!');
      console.log(`🎬 You can now test video in game: ${targetGame.name}`);
    }

  } catch (error) {
    console.error('❌ Search failed:', error);
  }
}

findAnyMario().then(() => process.exit(0));