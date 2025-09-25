#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const R2_DOMAIN = process.env.VITE_CLOUDFLARE_R2_DOMAIN!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function createSafeFileName(gameName: string): string {
  return gameName
    .replace(/[^a-zA-Z0-9\-_\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

async function testLogoAvailability(gameName: string): Promise<boolean> {
  const safeFileName = createSafeFileName(gameName);
  const logoUrl = `https://${R2_DOMAIN}/clear-logos/${safeFileName}.webp`;

  try {
    const response = await fetch(logoUrl, { method: 'HEAD' });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function filterGamesByLogos() {
  try {
    console.log('🚀 Filtering existing games_database to only include games with clear logos...\n');

    // Get all games from the current games_database
    console.log('📊 Fetching current games from database...');
    const { data: currentGames, error: fetchError } = await supabase
      .from('games_database')
      .select('*')
      .order('id');

    if (fetchError) {
      console.error('Error fetching games:', fetchError);
      return;
    }

    if (!currentGames || currentGames.length === 0) {
      console.log('❌ No games found in games_database');
      return;
    }

    console.log(`📊 Found ${currentGames.length} games in database`);

    // Test logo availability for all games
    const BATCH_SIZE = 50;
    const gamesWithLogos: any[] = [];
    let tested = 0;

    console.log('🎯 Testing logo availability for all games...\n');

    for (let i = 0; i < currentGames.length; i += BATCH_SIZE) {
      const batch = currentGames.slice(i, i + BATCH_SIZE);

      // Test this batch
      const promises = batch.map(async (game) => {
        const hasLogo = await testLogoAvailability(game.name);
        if (hasLogo) {
          const safeFileName = createSafeFileName(game.name);
          const logoUrl = `https://${R2_DOMAIN}/clear-logos/${safeFileName}.webp`;
          return {
            ...game
          };
        }
        return null;
      });

      const results = await Promise.all(promises);
      const foundLogos = results.filter(result => result !== null);
      gamesWithLogos.push(...foundLogos);

      tested += batch.length;
      const progress = ((tested / currentGames.length) * 100).toFixed(1);
      console.log(`📈 Progress: ${tested}/${currentGames.length} games tested (${progress}%) - Found: ${gamesWithLogos.length} logos`);

      // Small delay to be nice to the server
      if (i + BATCH_SIZE < currentGames.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`\n✅ Logo testing completed!`);
    console.log(`📊 Games with available logos: ${gamesWithLogos.length} out of ${currentGames.length}`);
    console.log(`📈 Logo coverage: ${((gamesWithLogos.length / currentGames.length) * 100).toFixed(1)}%`);

    if (gamesWithLogos.length === 0) {
      console.log('❌ No games with logos found - keeping original database');
      return;
    }

    // Show platform breakdown
    const platformCounts: Record<string, number> = {};
    gamesWithLogos.forEach(game => {
      const platform = game.platform_name || 'Unknown';
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });

    console.log('\n📋 Games with logos by platform:');
    Object.entries(platformCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([platform, count]) => {
        console.log(`   ${platform}: ${count} games`);
      });

    // Clear games_database and insert only games with logos
    console.log('\n🗑️  Clearing games_database and inserting only games with logos...');

    const { error: deleteError } = await supabase
      .from('games_database')
      .delete()
      .neq('id', 0); // Delete all rows

    if (deleteError) {
      console.error('Error clearing games_database:', deleteError);
      return;
    }

    console.log('✅ Existing games cleared successfully');

    // Insert filtered games in batches
    const INSERT_BATCH_SIZE = 500;
    let processed = 0;

    for (let i = 0; i < gamesWithLogos.length; i += INSERT_BATCH_SIZE) {
      const batch = gamesWithLogos.slice(i, i + INSERT_BATCH_SIZE);

      const { error: insertError } = await supabase
        .from('games_database')
        .insert(batch);

      if (insertError) {
        console.error(`Error inserting batch ${i / INSERT_BATCH_SIZE + 1}:`, insertError);
        return;
      }

      processed += batch.length;
      console.log(`📈 Migration progress: ${processed}/${gamesWithLogos.length} games migrated (${((processed / gamesWithLogos.length) * 100).toFixed(1)}%)`);
    }

    // Verify migration
    const { count, error: countError } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error verifying migration:', countError);
      return;
    }

    console.log(`\n🎉 Filtering completed successfully!`);
    console.log(`📊 Total games in Supabase games_database: ${count}`);
    console.log(`📊 Expected: ${gamesWithLogos.length}`);
    console.log(`🎯 Match: ${count === gamesWithLogos.length ? '✅' : '❌'}`);
    console.log(`📈 Logo coverage: 100% (all games have clear logos)`);

    // Show sample games
    console.log('\n🎮 Sample games with logos:');
    gamesWithLogos.slice(0, 10).forEach((game, index) => {
      const genres = game.genres?.slice(0, 2).join(', ') || 'No genres';
      const rating = game.community_rating ? `${game.community_rating}/10` : 'No rating';
      console.log(`${(index + 1).toString().padStart(2)}. ${game.name} (${game.platform_name || 'Unknown'}) - ${genres} - ${rating}`);
    });

  } catch (error) {
    console.error('Filtering error:', error);
  }
}

filterGamesByLogos().catch(console.error);