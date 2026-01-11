#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRemainingMetadata() {
  try {
    console.log('🔍 Finding games still missing metadata...\n');

    // Get sample of games missing developer (our key indicator)
    const { data: missingGames, error } = await supabase
      .from('games_database')
      .select('id, name, platform_name, launchbox_id, developer, publisher, overview')
      .is('developer', null)
      .limit(20);

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('📋 Sample games still missing metadata:');
    missingGames?.forEach((game, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${game.name} (${game.platform_name}) - ID: ${game.launchbox_id}`);
      if (game.overview) console.log(`    Has overview: ${game.overview.substring(0, 50)}...`);
      if (game.publisher) console.log(`    Has publisher: ${game.publisher}`);
    });

    // Check platform distribution of missing games
    const { data: platformStats, error: platformError } = await supabase
      .from('games_database')
      .select('platform_name')
      .is('developer', null);

    if (!platformError && platformStats) {
      const platformCount = new Map<string, number>();
      platformStats.forEach(game => {
        const count = platformCount.get(game.platform_name) || 0;
        platformCount.set(game.platform_name, count + 1);
      });

      console.log('\n📊 Missing metadata by platform (top 10):');
      const sortedPlatforms = Array.from(platformCount.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

      sortedPlatforms.forEach(([platform, count]) => {
        console.log(`  ${platform}: ${count} games`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkRemainingMetadata().catch(console.error);