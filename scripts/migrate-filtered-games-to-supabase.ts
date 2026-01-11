#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!; // Need service key for bulk operations

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

async function migrateFilteredGamesToSupabase() {
  try {
    console.log('🚀 Starting migration of filtered games to Supabase...\n');

    // Open SQLite database
    const db = new Database('public/games.db', { readonly: true });

    // Get filtered games from SQLite with deduplication (prioritize games with logos)
    const placeholders = APPROVED_PLATFORMS.map(() => '?').join(',');
    const query = `
      SELECT id, name, platform_name, release_date, genres, overview,
             esrb_rating, developer, publisher, clear_logo_url, logo_base64
      FROM games
      WHERE platform_name IN (${placeholders})
      ORDER BY
        CASE
          WHEN logo_base64 IS NOT NULL AND logo_base64 != '' THEN 1
          WHEN clear_logo_url IS NOT NULL AND clear_logo_url != '' THEN 2
          ELSE 3
        END,
        name, platform_name
    `;

    const allGames = db.prepare(query).all(...APPROVED_PLATFORMS);

    // Deduplicate by name+platform, keeping the first (best logo priority)
    const gameMap = new Map<string, any>();
    const duplicateCount = { total: 0, withLogos: 0 };

    allGames.forEach(game => {
      const key = `${game.name}_${game.platform_name}`;
      if (gameMap.has(key)) {
        duplicateCount.total++;
        if (game.logo_base64 || game.clear_logo_url) {
          duplicateCount.withLogos++;
        }
      } else {
        gameMap.set(key, game);
      }
    });

    const games = Array.from(gameMap.values());
    console.log(`📊 Found ${allGames.length} total games, ${games.length} unique games after deduplication`);
    if (duplicateCount.total > 0) {
      console.log(`🔄 Removed ${duplicateCount.total} duplicates (${duplicateCount.withLogos} had logos)`);
    }

    // Clear existing games_database in Supabase
    console.log('🗑️  Clearing existing games_database in Supabase...');
    const { error: deleteError } = await supabase
      .from('games_database')
      .delete()
      .neq('id', 0); // Delete all rows

    if (deleteError) {
      console.error('Error clearing games_database:', deleteError);
      return;
    }

    console.log('✅ Existing games cleared successfully');

    // Batch insert games to Supabase (process in chunks of 1000)
    const BATCH_SIZE = 1000;
    let processed = 0;

    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);

      // Transform SQLite data to Supabase format
      const formattedBatch = batch.map(game => ({
        sqlite_id: game.id,
        name: game.name,
        platform_name: game.platform_name,
        release_date: game.release_date,
        genres: game.genres ? JSON.parse(game.genres) : null,
        overview: game.overview,
        esrb_rating: game.esrb_rating,
        developer: game.developer,
        publisher: game.publisher,
        clear_logo_url: game.clear_logo_url,
        logo_base64: game.logo_base64
      }));

      const { error: insertError } = await supabase
        .from('games_database')
        .insert(formattedBatch);

      if (insertError) {
        console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, insertError);
        return;
      }

      processed += batch.length;
      console.log(`📈 Progress: ${processed}/${games.length} games migrated (${((processed / games.length) * 100).toFixed(1)}%)`);
    }

    db.close();

    // Verify migration
    const { count, error: countError } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error verifying migration:', countError);
      return;
    }

    console.log(`\n✅ Migration completed successfully!`);
    console.log(`📊 Total games in Supabase games_database: ${count}`);
    console.log(`📊 Expected: ${games.length}`);
    console.log(`🎯 Match: ${count === games.length ? '✅' : '❌'}`);

  } catch (error) {
    console.error('Migration error:', error);
  }
}

migrateFilteredGamesToSupabase().catch(console.error);