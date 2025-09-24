#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function syncLogosToSupabase() {
  console.log('🔄 Syncing Clear Logos from SQLite to Supabase...');

  // Open the Clear Logo database
  const clearLogosDb = new Database('public/clear-logos.db');

  try {
    // Get all Clear Logos from the dedicated database
    const clearLogos = clearLogosDb.prepare(`
      SELECT launchbox_database_id, game_name, platform_name, logo_base64, region
      FROM clear_logos
      ORDER BY
        CASE WHEN region IS NULL THEN 0 ELSE 1 END,
        game_name
    `).all();

    console.log(`📊 Found ${clearLogos.length} Clear Logos in SQLite database`);

    let updated = 0;
    let notFound = 0;
    let errors = 0;
    let skipped = 0;

    // Group by game name to handle duplicates (prefer Global region)
    const logosByGame = new Map();
    for (const logo of clearLogos) {
      const key = `${logo.game_name}|||${logo.platform_name}`;
      if (!logosByGame.has(key) || !logo.region) {
        logosByGame.set(key, logo);
      }
    }

    console.log(`📊 After deduplication: ${logosByGame.size} unique games`);

    for (const [key, logo] of logosByGame) {
      try {
        console.log(`\n🔍 Processing: ${logo.game_name} (${logo.platform_name}) [${logo.region || 'Global'}]`);

        // Match by name and platform instead of ID (more reliable)
        const { data, error } = await supabase
          .from('games_database')
          .update({
            logo_base64: logo.logo_base64,
            logo_source: 'LaunchBox Clear Logo',
            logo_updated_at: new Date().toISOString()
          })
          .eq('name', logo.game_name)
          .eq('platform_name', logo.platform_name)
          .select('id, name, platform_name');

        if (error) {
          console.error(`❌ Error updating ${logo.game_name}:`, error.message);
          errors++;
        } else if (data && data.length > 0) {
          console.log(`✅ Updated logo for: ${data[0].name} (${data[0].platform_name})`);
          updated++;
        } else {
          console.log(`❓ Game not found in Supabase: ${logo.game_name} (${logo.platform_name})`);
          notFound++;
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`💥 Exception processing ${logo.game_name}:`, error);
        errors++;
      }
    }

    console.log(`\n📈 Clear Logo Sync Summary:`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ❓ Not found: ${notFound}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📊 Total processed: ${logosByGame.size}`);
    console.log(`   🎯 Success rate: ${((updated / logosByGame.size) * 100).toFixed(1)}%`);

  } finally {
    clearLogosDb.close();
  }
}

// Run the sync
syncLogosToSupabase().catch(console.error);