#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const R2_DOMAIN = process.env.VITE_CLOUDFLARE_R2_DOMAIN!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Logo downloader's approved platforms filter
const APPROVED_PLATFORMS = [
  'Arcade', 'Atari Jaguar', 'Atari Jaguar CD', 'Atari Lynx', 'Bandai WonderSwan',
  'Bandai WonderSwan Color', 'Commodore 64', 'Commodore Amiga', 'Commodore Amiga CD32',
  'DOS', 'Microsoft Xbox', 'Microsoft Xbox 360', 'Microsoft Xbox One', 'NEC PC Engine',
  'NEC PC Engine CD', 'NEC PC-FX', 'NEC TurboGrafx-16', 'NEC TurboGrafx-CD', 'Nintendo 3DS',
  'Nintendo 64', 'Nintendo DS', 'Nintendo Entertainment System', 'Nintendo Famicom Disk System',
  'Nintendo Game Boy', 'Nintendo Game Boy Advance', 'Nintendo Game Boy Color', 'Nintendo GameCube',
  'Nintendo Switch', 'Nintendo Wii', 'Nintendo Wii U', 'Panasonic 3DO', 'Philips CD-i', 'ScummVM',
  'Sega 32X', 'Sega CD', 'Sega Dreamcast', 'Sega Game Gear', 'Sega Genesis', 'Sega Master System',
  'Sega Model 2', 'Sega Saturn', 'SNK Neo Geo', 'SNK Neo Geo CD', 'SNK Neo Geo Pocket',
  'SNK Neo Geo Pocket Color', 'Sony PlayStation', 'Sony PlayStation 2', 'Sony PlayStation 3',
  'Sony PlayStation 4', 'Sony PlayStation 5', 'Sony PlayStation Portable', 'Sony PlayStation Vita',
  'Super Nintendo Entertainment System', 'Amstrad CPC', 'Atari 2600', 'Atari 5200', 'Atari 7800',
  'Atari 8-bit', 'Atari ST', 'Magnavox Odyssey 2', 'Mattel Intellivision', 'MSX', 'MSX2',
  'Sinclair ZX Spectrum'
];

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

async function migrateLogoAvailableGames() {
  try {
    console.log('🚀 Starting migration of games with available clear logos...\n');

    // Open SQLite database
    const db = new Database('public/games.db', { readonly: true });

    // Get filtered games from SQLite
    const placeholders = APPROVED_PLATFORMS.map(() => '?').join(',');
    const query = `
      SELECT id, name, platform_name, logo_base64, launchbox_id
      FROM games
      WHERE platform_name IN (${placeholders})
      ORDER BY platform_name, name
    `;

    const allGames = db.prepare(query).all(...APPROVED_PLATFORMS);
    console.log(`📊 Found ${allGames.length} games from approved platforms`);

    // Test logo availability in batches
    const BATCH_SIZE = 50;
    const gamesWithLogos: any[] = [];
    let tested = 0;

    console.log('🎯 Testing logo availability...\n');

    for (let i = 0; i < allGames.length; i += BATCH_SIZE) {
      const batch = allGames.slice(i, i + BATCH_SIZE);

      // Test this batch
      const promises = batch.map(async (game) => {
        const hasLogo = await testLogoAvailability(game.name);
        if (hasLogo) {
          const safeFileName = createSafeFileName(game.name);
          const logoUrl = `https://${R2_DOMAIN}/clear-logos/${safeFileName}.webp`;
          return {
            ...game,
            safeFileName
          };
        }
        return null;
      });

      const results = await Promise.all(promises);
      const foundLogos = results.filter(result => result !== null);
      gamesWithLogos.push(...foundLogos);

      tested += batch.length;
      const progress = ((tested / allGames.length) * 100).toFixed(1);
      console.log(`📈 Progress: ${tested}/${allGames.length} games tested (${progress}%) - Found: ${gamesWithLogos.length} logos`);

      // Small delay to be nice to the server
      if (i + BATCH_SIZE < allGames.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    db.close();

    console.log(`\n✅ Logo testing completed!`);
    console.log(`📊 Games with available logos: ${gamesWithLogos.length}`);

    if (gamesWithLogos.length === 0) {
      console.log('❌ No games with logos found - cannot proceed with migration');
      return;
    }

    // Show platform breakdown
    const platformCounts: Record<string, number> = {};
    gamesWithLogos.forEach(game => {
      platformCounts[game.platform_name] = (platformCounts[game.platform_name] || 0) + 1;
    });

    console.log('\n📋 Games with logos by platform:');
    Object.entries(platformCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([platform, count]) => {
        console.log(`   ${platform}: ${count} games`);
      });

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

    // Batch insert games to Supabase (process in chunks of 500)
    const INSERT_BATCH_SIZE = 500;
    let processed = 0;

    for (let i = 0; i < gamesWithLogos.length; i += INSERT_BATCH_SIZE) {
      const batch = gamesWithLogos.slice(i, i + INSERT_BATCH_SIZE);

      // Transform SQLite data to Supabase format
      const formattedBatch = batch.map(game => ({
        id: game.id,
        name: game.name,
        platform_name: game.platform_name,
        logo_base64: game.logo_base64,
        launchbox_id: game.launchbox_id
      }));

      const { error: insertError } = await supabase
        .from('games_database')
        .insert(formattedBatch);

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

    console.log(`\n🎉 Migration completed successfully!`);
    console.log(`📊 Total games in Supabase games_database: ${count}`);
    console.log(`📊 Expected: ${gamesWithLogos.length}`);
    console.log(`🎯 Match: ${count === gamesWithLogos.length ? '✅' : '❌'}`);
    console.log(`📈 Logo coverage: 100% (all games have clear logos)`);

    // Show sample games
    console.log('\n🎮 Sample migrated games:');
    gamesWithLogos.slice(0, 10).forEach((game, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${game.name} (${game.platform_name})`);
    });

  } catch (error) {
    console.error('Migration error:', error);
  }
}

migrateLogoAvailableGames().catch(console.error);