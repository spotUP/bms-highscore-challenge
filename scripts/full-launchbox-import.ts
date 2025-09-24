#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as readline from 'readline';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ID offset discovered: XML DatabaseID - 50000 = Supabase ID
const ID_OFFSET = 50000;

interface LaunchBoxGame {
  name: string;
  platform_name: string;
  database_id: number;

  // Basic metadata
  release_date?: string;
  release_year?: number;
  overview?: string;
  max_players?: number;
  cooperative?: boolean;

  // Ratings
  community_rating?: number;
  community_rating_count?: number;
  esrb_rating?: string;

  // Media URLs
  video_url?: string;
  screenshot_url?: string;
  cover_url?: string;
  logo_url?: string;

  // Extended metadata
  developer?: string;
  publisher?: string;
  genres?: string[];
  series?: string;
  region?: string;
  release_type?: string;

  // Additional fields
  wikipedia_url?: string;
  alternative_names?: string[];
  play_modes?: string[];
  themes?: string[];

  // Technical fields
  dos?: boolean;
}

function extractTextContent(xmlLine: string, tagName: string): string | null {
  const openTag = `<${tagName}>`;
  const closeTag = `</${tagName}>`;

  const startIndex = xmlLine.indexOf(openTag);
  const endIndex = xmlLine.indexOf(closeTag);

  if (startIndex !== -1 && endIndex !== -1) {
    const content = xmlLine.substring(startIndex + openTag.length, endIndex).trim();
    return content || null;
  }

  return null;
}

function extractBooleanContent(xmlLine: string, tagName: string): boolean | null {
  const value = extractTextContent(xmlLine, tagName);
  if (value === null) return null;
  return value.toLowerCase() === 'true';
}

function extractNumberContent(xmlLine: string, tagName: string): number | null {
  const value = extractTextContent(xmlLine, tagName);
  if (value === null || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function extractDateContent(xmlLine: string, tagName: string): string | null {
  const value = extractTextContent(xmlLine, tagName);
  if (!value) return null;

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  } catch {
    return null;
  }
}

function parseGenresArray(genresText: string): string[] {
  if (!genresText) return [];

  return genresText.split(';')
    .map(g => g.trim())
    .filter(g => g.length > 0);
}

async function parseAllGames(): Promise<LaunchBoxGame[]> {
  console.log(`📖 Parsing ALL games from Metadata.xml...`);

  const fileStream = fs.createReadStream('Metadata.xml');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const games: LaunchBoxGame[] = [];
  let currentGame: Partial<LaunchBoxGame> = {};
  let insideGame = false;
  let gameCount = 0;

  for await (const line of rl) {
    const trimmedLine = line.trim();

    if (trimmedLine === '<Game>') {
      insideGame = true;
      currentGame = {};
      continue;
    }

    if (trimmedLine === '</Game>') {
      insideGame = false;

      // Process the completed game
      if (currentGame.name && currentGame.platform_name && currentGame.database_id !== undefined) {
        const game: LaunchBoxGame = {
          name: currentGame.name,
          platform_name: currentGame.platform_name,
          database_id: currentGame.database_id - ID_OFFSET, // Apply the offset

          // Copy all other fields
          release_date: currentGame.release_date,
          release_year: currentGame.release_year,
          overview: currentGame.overview,
          max_players: currentGame.max_players,
          cooperative: currentGame.cooperative,

          community_rating: currentGame.community_rating,
          community_rating_count: currentGame.community_rating_count,
          esrb_rating: currentGame.esrb_rating,

          video_url: currentGame.video_url,
          screenshot_url: currentGame.screenshot_url,
          cover_url: currentGame.cover_url,
          logo_url: currentGame.logo_url,

          developer: currentGame.developer,
          publisher: currentGame.publisher,
          genres: currentGame.genres,
          series: currentGame.series,
          region: currentGame.region,
          release_type: currentGame.release_type,

          wikipedia_url: currentGame.wikipedia_url,
          alternative_names: currentGame.alternative_names,
          play_modes: currentGame.play_modes,
          themes: currentGame.themes,

          dos: currentGame.dos
        };

        games.push(game);
        gameCount++;

        if (gameCount % 1000 === 0) {
          console.log(`  Parsed ${gameCount} games...`);
        }
      }

      currentGame = {};
      continue;
    }

    if (!insideGame) continue;

    // Parse individual fields
    if (trimmedLine.includes('<Name>')) {
      currentGame.name = extractTextContent(trimmedLine, 'Name');
    } else if (trimmedLine.includes('<Platform>')) {
      currentGame.platform_name = extractTextContent(trimmedLine, 'Platform');
    } else if (trimmedLine.includes('<DatabaseID>')) {
      currentGame.database_id = extractNumberContent(trimmedLine, 'DatabaseID');
    } else if (trimmedLine.includes('<ReleaseDate>')) {
      currentGame.release_date = extractDateContent(trimmedLine, 'ReleaseDate');
    } else if (trimmedLine.includes('<ReleaseYear>')) {
      currentGame.release_year = extractNumberContent(trimmedLine, 'ReleaseYear');
    } else if (trimmedLine.includes('<Overview>')) {
      currentGame.overview = extractTextContent(trimmedLine, 'Overview');
    } else if (trimmedLine.includes('<MaxPlayers>')) {
      currentGame.max_players = extractNumberContent(trimmedLine, 'MaxPlayers');
    } else if (trimmedLine.includes('<Cooperative>')) {
      currentGame.cooperative = extractBooleanContent(trimmedLine, 'Cooperative');
    } else if (trimmedLine.includes('<CommunityRating>')) {
      currentGame.community_rating = extractNumberContent(trimmedLine, 'CommunityRating');
    } else if (trimmedLine.includes('<CommunityRatingCount>')) {
      currentGame.community_rating_count = extractNumberContent(trimmedLine, 'CommunityRatingCount');
    } else if (trimmedLine.includes('<ESRB>')) {
      currentGame.esrb_rating = extractTextContent(trimmedLine, 'ESRB');
    } else if (trimmedLine.includes('<VideoURL>')) {
      currentGame.video_url = extractTextContent(trimmedLine, 'VideoURL');
    } else if (trimmedLine.includes('<ScreenshotURL>')) {
      currentGame.screenshot_url = extractTextContent(trimmedLine, 'ScreenshotURL');
    } else if (trimmedLine.includes('<CoverURL>')) {
      currentGame.cover_url = extractTextContent(trimmedLine, 'CoverURL');
    } else if (trimmedLine.includes('<LogoURL>')) {
      currentGame.logo_url = extractTextContent(trimmedLine, 'LogoURL');
    } else if (trimmedLine.includes('<Developer>')) {
      currentGame.developer = extractTextContent(trimmedLine, 'Developer');
    } else if (trimmedLine.includes('<Publisher>')) {
      currentGame.publisher = extractTextContent(trimmedLine, 'Publisher');
    } else if (trimmedLine.includes('<Genres>')) {
      const genresText = extractTextContent(trimmedLine, 'Genres');
      currentGame.genres = genresText ? parseGenresArray(genresText) : [];
    } else if (trimmedLine.includes('<Series>')) {
      currentGame.series = extractTextContent(trimmedLine, 'Series');
    } else if (trimmedLine.includes('<Region>')) {
      currentGame.region = extractTextContent(trimmedLine, 'Region');
    } else if (trimmedLine.includes('<ReleaseType>')) {
      currentGame.release_type = extractTextContent(trimmedLine, 'ReleaseType');
    } else if (trimmedLine.includes('<WikipediaURL>')) {
      currentGame.wikipedia_url = extractTextContent(trimmedLine, 'WikipediaURL');
    } else if (trimmedLine.includes('<AlternativeNames>')) {
      const altNamesText = extractTextContent(trimmedLine, 'AlternativeNames');
      currentGame.alternative_names = altNamesText ? altNamesText.split(';').map(n => n.trim()).filter(n => n.length > 0) : [];
    } else if (trimmedLine.includes('<PlayModes>')) {
      const playModesText = extractTextContent(trimmedLine, 'PlayModes');
      currentGame.play_modes = playModesText ? playModesText.split(';').map(m => m.trim()).filter(m => m.length > 0) : [];
    } else if (trimmedLine.includes('<Themes>')) {
      const themesText = extractTextContent(trimmedLine, 'Themes');
      currentGame.themes = themesText ? themesText.split(';').map(t => t.trim()).filter(t => t.length > 0) : [];
    } else if (trimmedLine.includes('<DOS>')) {
      currentGame.dos = extractBooleanContent(trimmedLine, 'DOS');
    }
  }

  rl.close();
  fileStream.close();

  console.log(`✅ Parsed ${games.length} total games from XML`);
  return games;
}

async function clearExistingData() {
  console.log('🗑️ Clearing existing games_database data...');

  // Use TRUNCATE for faster deletion of all rows
  const { error } = await supabase.rpc('execute_sql', {
    sql: 'TRUNCATE TABLE games_database RESTART IDENTITY;'
  });

  if (error) {
    console.error('❌ Error clearing data:', error);
    // Fallback to DELETE if TRUNCATE fails
    console.log('Trying DELETE as fallback...');
    const { error: deleteError } = await supabase
      .from('games_database')
      .delete()
      .gte('id', -99999999); // This will match all rows

    if (deleteError) {
      console.error('❌ DELETE also failed:', deleteError);
      throw deleteError;
    }
  }

  console.log('✅ Existing data cleared');
}

async function insertGamesInChunks(games: LaunchBoxGame[]) {
  console.log(`📥 Inserting ${games.length} games into database in chunks...`);

  const batchSize = 50; // Smaller batches for reliability with large dataset
  let inserted = 0;
  let errors = 0;
  let skipped = 0;

  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);

    try {
      const { error } = await supabase
        .from('games_database')
        .upsert(batch.map(game => ({
          id: game.database_id,
          name: game.name,
          platform_name: game.platform_name,
          database_id: game.database_id + ID_OFFSET, // Store original LaunchBox ID
          launchbox_id: game.database_id + ID_OFFSET, // Also populate launchbox_id

          release_date: game.release_date,
          release_year: game.release_year,
          overview: game.overview,
          max_players: game.max_players,
          cooperative: game.cooperative,

          community_rating: game.community_rating,
          community_rating_count: game.community_rating_count,
          esrb_rating: game.esrb_rating,

          video_url: game.video_url,
          screenshot_url: game.screenshot_url,
          cover_url: game.cover_url,
          logo_url: game.logo_url,

          developer: game.developer,
          publisher: game.publisher,
          genres: game.genres,
          series: game.series,
          region: game.region,
          release_type: game.release_type,

          wikipedia_url: game.wikipedia_url,
          alternative_names: game.alternative_names,
          play_modes: game.play_modes,
          themes: game.themes,

          dos: game.dos
        })), {
          onConflict: 'id'
        });

      if (error) {
        console.error(`❌ Error inserting batch ${i}-${i + batch.length}:`, error);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }

      // Progress update every 1000 games
      if ((i + batchSize) % 1000 === 0 || i + batchSize >= games.length) {
        console.log(`  Progress: ${inserted}/${games.length} inserted (${errors} errors, ${skipped} skipped)`);
      }

    } catch (error) {
      console.error(`❌ Batch error:`, error);
      errors += batch.length;
    }
  }

  console.log(`✅ Full import complete: ${inserted} inserted, ${errors} errors, ${skipped} skipped`);
  return { inserted, errors, skipped };
}

async function verifyFullImport() {
  console.log('🔍 Verifying full import...');

  // Get total count
  const { count, error: countError } = await supabase
    .from('games_database')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error getting count:', countError);
    return;
  }

  console.log(`📊 Total games in database: ${count}`);

  // Check for Super Mario Bros. NES
  const { data: nesData, error: nesError } = await supabase
    .from('games_database')
    .select('*')
    .eq('name', 'Super Mario Bros.')
    .eq('platform_name', 'Nintendo Entertainment System')
    .single();

  if (!nesError && nesData) {
    console.log(`🍄 Found Super Mario Bros. for NES:`)
    console.log(`   ID: ${nesData.id}`);
    console.log(`   LaunchBox ID: ${nesData.database_id}`);
    console.log(`   Video: ${nesData.video_url || 'None'}`);
  } else {
    console.log('❌ Super Mario Bros. for NES still not found');
  }

  // Count games with videos
  const { count: videoCount, error: videoError } = await supabase
    .from('games_database')
    .select('*', { count: 'exact', head: true })
    .not('video_url', 'is', null);

  if (!videoError) {
    console.log(`🎬 Games with videos: ${videoCount}`);
    console.log(`   Video coverage: ${((videoCount / count) * 100).toFixed(1)}%`);
  }
}

async function fullLaunchBoxImport() {
  try {
    console.log('🚀 Starting FULL LaunchBox import...');
    console.log(`📋 ID Mapping: XML DatabaseID - ${ID_OFFSET} = Supabase ID`);
    console.log('⚠️ This will take significant time - importing ALL games from metadata.xml');
    console.log('');

    // Parse all games from XML
    const games = await parseAllGames();

    if (games.length === 0) {
      console.error('❌ No games parsed from XML file');
      process.exit(1);
    }

    // Clear existing data and insert all games
    await clearExistingData();
    const results = await insertGamesInChunks(games);
    await verifyFullImport();

    console.log('');
    console.log('🎉 FULL LaunchBox import completed!');
    console.log(`📈 Final stats: ${results.inserted} games imported`);
    console.log('🎮 Database now contains the complete LaunchBox game collection');

  } catch (error) {
    console.error('❌ Full import failed:', error);
    process.exit(1);
  }
}

fullLaunchBoxImport().then(() => process.exit(0));