#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMetadata() {
  try {
    console.log('🔍 Checking metadata in games_database...\n');

    // Get a few sample games to check what fields we have
    const { data, error } = await supabase
      .from('games_database')
      .select('*')
      .limit(3);

    if (error) {
      console.error('Error fetching games:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('📋 Available fields in games_database:');
      Object.keys(data[0]).forEach(field => {
        console.log(`   - ${field}`);
      });

      console.log('\n🎮 Sample games with metadata:');
      data.forEach((game, index) => {
        console.log(`\n${index + 1}. ${game.name} (${game.platform_name})`);
        console.log(`   Overview: ${game.overview || 'None'}`);
        console.log(`   Genres: ${game.genres ? JSON.stringify(game.genres) : 'None'}`);
        console.log(`   Developer: ${game.developer || 'None'}`);
        console.log(`   Publisher: ${game.publisher || 'None'}`);
        console.log(`   Release Year: ${game.release_year || 'None'}`);
        console.log(`   ESRB Rating: ${game.esrb_rating || 'None'}`);
        console.log(`   Community Rating: ${game.community_rating || 'None'}`);
        console.log(`   Community Rating Count: ${game.community_rating_count || 'None'}`);
        console.log(`   Max Players: ${game.max_players || 'None'}`);
      });
    } else {
      console.log('No games found in database');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkMetadata().catch(console.error);