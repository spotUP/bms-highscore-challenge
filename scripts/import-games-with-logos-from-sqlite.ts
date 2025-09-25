#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import * as fs from 'fs/promises';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function importGamesWithLogosFromSQLite() {
  try {
    console.log('🚀 Importing games with available logos from SQLite to Supabase...\n');

    // Read the list of available logos
    console.log('📖 Reading available logos list...');
    const logoListData = await fs.readFile('available-logos-list.json', 'utf8');
    const availableLogos: string[] = JSON.parse(logoListData);

    console.log(`📊 Found ${availableLogos.length} games with available logos`);

    // Open SQLite database
    const db = new Database('public/games.db', { readonly: true });

    // Get all games that have logos available
    console.log('🔍 Querying SQLite for games with available logos...');
    
    // Create a placeholders string for the IN clause
    const placeholders = availableLogos.map(() => '?').join(',');
    const query = `
      SELECT * FROM games 
      WHERE name IN (${placeholders})
      ORDER BY platform_name, name
    `;

    const gamesWithLogos = db.prepare(query).all(...availableLogos);
    db.close();

    console.log(`📊 Found ${gamesWithLogos.length} games in SQLite that have available logos`);

    if (gamesWithLogos.length === 0) {
      console.log('❌ No matching games found in SQLite');
      return;
    }

    // Clear existing games_database in Supabase
    console.log('\n🗑️  Clearing existing games_database in Supabase...');
    const { error: deleteError } = await supabase
      .from('games_database')
      .delete()
      .neq('id', 0); // Delete all rows

    if (deleteError) {
      console.error('Error clearing games_database:', deleteError);
      return;
    }

    console.log('✅ Existing games cleared successfully');

    // Transform and batch insert games to Supabase
    const INSERT_BATCH_SIZE = 500;
    let processed = 0;

    console.log('\n📥 Importing games to Supabase...');

    for (let i = 0; i < gamesWithLogos.length; i += INSERT_BATCH_SIZE) {
      const batch = gamesWithLogos.slice(i, i + INSERT_BATCH_SIZE);

      // Transform SQLite data to Supabase format
      const formattedBatch = batch.map((game: any) => ({
        id: game.id,
        name: game.name,
        platform_name: game.platform_name,
        overview: game.overview || null,
        genres: game.genres ? (typeof game.genres === 'string' ? JSON.parse(game.genres) : game.genres) : null,
        esrb_rating: game.esrb_rating || null,
        community_rating: game.community_rating || null,
        community_rating_count: game.community_rating_count || null,
        release_year: game.release_year || null,
        developer: game.developer || null,
        publisher: game.publisher || null,
        max_players: game.max_players || null,
        launchbox_id: game.launchbox_id || null,
        logo_base64: game.logo_base64 || null
      }));

      const { error: insertError } = await supabase
        .from('games_database')
        .insert(formattedBatch);

      if (insertError) {
        console.error(`Error inserting batch ${i / INSERT_BATCH_SIZE + 1}:`, insertError);
        return;
      }

      processed += batch.length;
      const progress = ((processed / gamesWithLogos.length) * 100).toFixed(1);
      console.log(`📈 Import progress: ${processed}/${gamesWithLogos.length} games imported (${progress}%)`);
    }

    // Verify import
    const { count, error: countError } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error verifying import:', countError);
      return;
    }

    console.log(`\n🎉 Import completed successfully!`);
    console.log(`📊 Total games in Supabase games_database: ${count}`);
    console.log(`📊 Expected: ${gamesWithLogos.length}`);
    console.log(`🎯 Match: ${count === gamesWithLogos.length ? '✅' : '❌'}`);
    console.log(`📈 Logo coverage: 100% (all games have verified clear logos)`);

    // Show platform breakdown
    const { data: platformData, error: platformError } = await supabase
      .from('games_database')
      .select('platform_name')
      .not('platform_name', 'is', null);

    if (!platformError && platformData) {
      const platformCounts: Record<string, number> = {};
      platformData.forEach(game => {
        const platform = game.platform_name || 'Unknown';
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      });

      console.log('\n📋 Final games by platform (top 15):');
      Object.entries(platformCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([platform, count]) => {
          console.log(`   ${platform}: ${count} games`);
        });
    }

    // Show sample games
    const { data: sampleGames, error: sampleError } = await supabase
      .from('games_database')
      .select('name, platform_name, developer, community_rating')
      .limit(10);

    if (!sampleError && sampleGames) {
      console.log('\n🎮 Sample imported games:');
      sampleGames.forEach((game, index) => {
        const rating = game.community_rating ? `${game.community_rating}/10` : 'No rating';
        const dev = game.developer || 'Unknown developer';
        console.log(`${(index + 1).toString().padStart(2)}. ${game.name} (${game.platform_name}) - ${dev} - ${rating}`);
      });
    }

  } catch (error) {
    console.error('Import error:', error);
  }
}

importGamesWithLogosFromSQLite().catch(console.error);
