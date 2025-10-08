#!/usr/bin/env tsx

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function syncExistingLogos() {
  console.log('🔄 Syncing existing Clear Logos from SQLite to Supabase...');

  // Open the SQLite database with existing logos
  const logoDb = new Database('./obsolete/databases/production-turbo-logos.db');

  try {
    // Get all games with logos from SQLite
    const gamesWithLogos = logoDb.prepare(`
      SELECT id, name, platform_name, logo_base64
      FROM games
      WHERE logo_base64 IS NOT NULL
      ORDER BY name
    `).all();

    console.log(`📊 Found ${gamesWithLogos.length} games with logos in SQLite database`);

    let updated = 0;
    let notFound = 0;
    let errors = 0;

    // Process each game
    for (const game of gamesWithLogos as any[]) {
      try {
        console.log(`\n🔍 Processing: ${game.name} (${game.platform_name})`);

        // Update the Supabase games_database table
        const { data, error } = await supabase
          .from('games_database')
          .update({
            logo_base64: game.logo_base64
          })
          .eq('name', game.name)
          .eq('platform_name', game.platform_name)
          .select('id, name, platform_name');

        if (error) {
          console.error(`❌ Error updating ${game.name}:`, error.message);
          errors++;
        } else if (data && data.length > 0) {
          console.log(`✅ Updated logo for: ${data[0].name} (${data[0].platform_name})`);
          updated++;
        } else {
          console.log(`❓ Game not found in Supabase: ${game.name} (${game.platform_name})`);
          notFound++;
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`💥 Exception processing ${game.name}:`, error);
        errors++;
      }
    }

    console.log(`\n📈 Logo Sync Summary:`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ❓ Not found: ${notFound}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📊 Total processed: ${gamesWithLogos.length}`);
    console.log(`   🎯 Success rate: ${((updated / gamesWithLogos.length) * 100).toFixed(1)}%`);

  } finally {
    logoDb.close();
  }
}

// Run the sync
syncExistingLogos().catch(console.error);