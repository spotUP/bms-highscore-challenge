#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

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

interface LaunchBoxGame {
  DatabaseID: string;
  Name: string;
  Platform: string;
  Overview?: string;
  Genres?: string;
  ESRB?: string;
  CommunityRating?: string;
  CommunityRatingCount?: string;
  ReleaseYear?: string;
  Developer?: string;
  Publisher?: string;
  MaxPlayers?: string;
}

function createSafeFileName(gameName: string): string {
  return gameName
    .replace(/[^a-zA-Z0-9\-_\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function parseGenres(genresString?: string): string[] | null {
  if (!genresString) return null;
  return genresString.split(';').map(g => g.trim()).filter(g => g.length > 0);
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

async function migrateXMLGamesWithLogos() {
  try {
    console.log('🚀 Starting migration of LaunchBox XML games with available clear logos...\n');

    // Read and parse LaunchBox XML
    console.log('📖 Reading LaunchBox XML file...');
    const xmlData = fs.readFileSync('Metadata.xml', 'utf8');

    console.log('🔍 Parsing XML data...');
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: false,
      parseTrueNumberOnly: false,
    });

    const parsedData = parser.parse(xmlData);
    const games: LaunchBoxGame[] = parsedData.LaunchBox?.Game || [];

    console.log(`📊 Found ${games.length} total games in LaunchBox XML`);

    // Filter by approved platforms first
    const approvedGames = games.filter(game =>
      APPROVED_PLATFORMS.includes(game.Platform)
    );

    console.log(`📊 Found ${approvedGames.length} games from approved platforms`);

    // Test logo availability in batches
    const BATCH_SIZE = 50;
    const gamesWithLogos: (LaunchBoxGame & { logoUrl: string })[] = [];
    let tested = 0;

    console.log('🎯 Testing logo availability...\n');

    for (let i = 0; i < approvedGames.length; i += BATCH_SIZE) {
      const batch = approvedGames.slice(i, i + BATCH_SIZE);

      // Test this batch
      const promises = batch.map(async (game) => {
        const hasLogo = await testLogoAvailability(game.Name);
        if (hasLogo) {
          const safeFileName = createSafeFileName(game.Name);
          const logoUrl = `https://${R2_DOMAIN}/clear-logos/${safeFileName}.webp`;
          return { ...game, logoUrl };
        }
        return null;
      });

      const results = await Promise.all(promises);
      const foundLogos = results.filter(result => result !== null);
      gamesWithLogos.push(...foundLogos);

      tested += batch.length;
      const progress = ((tested / approvedGames.length) * 100).toFixed(1);
      console.log(`📈 Progress: ${tested}/${approvedGames.length} games tested (${progress}%) - Found: ${gamesWithLogos.length} logos`);

      // Small delay to be nice to the server
      if (i + BATCH_SIZE < approvedGames.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`\n✅ Logo testing completed!`);
    console.log(`📊 Games with available logos: ${gamesWithLogos.length}`);

    if (gamesWithLogos.length === 0) {
      console.log('❌ No games with logos found - cannot proceed with migration');
      return;
    }

    // Show platform breakdown
    const platformCounts: Record<string, number> = {};
    gamesWithLogos.forEach(game => {
      platformCounts[game.Platform] = (platformCounts[game.Platform] || 0) + 1;
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

    // Transform and batch insert games to Supabase
    const INSERT_BATCH_SIZE = 500;
    let processed = 0;

    for (let i = 0; i < gamesWithLogos.length; i += INSERT_BATCH_SIZE) {
      const batch = gamesWithLogos.slice(i, i + INSERT_BATCH_SIZE);

      // Transform LaunchBox data to Supabase format
      const formattedBatch = batch.map(game => ({
        // Use LaunchBox DatabaseID offset by 50000 as the ID (matching existing logic)
        id: parseInt(game.DatabaseID) - 50000,
        name: game.Name,
        platform_name: game.Platform,
        overview: game.Overview || null,
        genres: parseGenres(game.Genres),
        esrb_rating: game.ESRB || null,
        community_rating: game.CommunityRating ? parseFloat(game.CommunityRating) : null,
        community_rating_count: game.CommunityRatingCount ? parseInt(game.CommunityRatingCount) : null,
        release_year: game.ReleaseYear ? parseInt(game.ReleaseYear) : null,
        developer: game.Developer || null,
        publisher: game.Publisher || null,
        max_players: game.MaxPlayers ? parseInt(game.MaxPlayers) : null,
        launchbox_id: parseInt(game.DatabaseID),
        clear_logo_url: game.logoUrl,
        logo_base64: null // Will be populated by logo scrapers later
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
    console.log(`🎮 Rich metadata: ✅ (genres, ratings, overviews, developer, publisher, etc.)`);

    // Show sample games
    console.log('\n🎮 Sample migrated games:');
    gamesWithLogos.slice(0, 10).forEach((game, index) => {
      const genres = parseGenres(game.Genres)?.slice(0, 2).join(', ') || 'No genres';
      const rating = game.CommunityRating ? `${parseFloat(game.CommunityRating).toFixed(1)}/10` : 'No rating';
      console.log(`${(index + 1).toString().padStart(2)}. ${game.Name} (${game.Platform}) - ${genres} - ${rating}`);
    });

  } catch (error) {
    console.error('Migration error:', error);
  }
}

migrateXMLGamesWithLogos().catch(console.error);