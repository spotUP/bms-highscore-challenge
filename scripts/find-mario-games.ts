#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findMarioGames() {
  console.log('🔍 Looking for Super Mario Bros games...\n');

  try {
    // Search for Super Mario Bros games
    const { data: games, error } = await supabase
      .from('games_database')
      .select('id, name, platform_name, logo_base64')
      .ilike('name', '%super mario bros%')
      .order('name');

    if (error) {
      console.error('❌ Error searching games:', error);
      return;
    }

    if (!games || games.length === 0) {
      console.log('❌ No Super Mario Bros games found');

      // Try broader search
      const { data: broadGames, error: broadError } = await supabase
        .from('games_database')
        .select('id, name, platform_name, logo_base64')
        .ilike('name', '%mario%')
        .order('name')
        .limit(10);

      if (broadError) {
        console.error('❌ Error in broad search:', broadError);
        return;
      }

      console.log('\n🔍 Found Mario games (broader search):');
      broadGames?.forEach(game => {
        console.log(`  ${game.id}: ${game.name} (${game.platform_name})`);
      });
      return;
    }

    console.log(`✅ Found ${games.length} Super Mario Bros games:\n`);

    for (const game of games) {
      console.log(`📍 ID: ${game.id}`);
      console.log(`   Name: ${game.name}`);
      console.log(`   Platform: ${game.platform_name}`);

      // Check if it has video data
      if (game.logo_base64) {
        try {
          const decoded = Buffer.from(game.logo_base64, 'base64').toString('utf-8');
          const data = JSON.parse(decoded);
          if (data.video_url) {
            console.log(`   🎬 Current video: ${data.video_url}`);
          } else {
            console.log(`   📝 Has metadata but no video_url`);
          }
        } catch (e) {
          console.log(`   📝 Has logo_base64 but not JSON metadata`);
        }
      } else {
        console.log(`   📝 No metadata`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Search failed:', error);
  }
}

findMarioGames().then(() => process.exit(0));