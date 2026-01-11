#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import * as readline from 'readline';

config();

// Load platform and genre filters
const INCLUDED_PLATFORMS = new Set(
  fs.readFileSync('included-platforms-clean.txt', 'utf8')
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0)
);

const EXCLUDED_GENRES = new Set(
  fs.readFileSync('excluded-genres.txt', 'utf8')
    .split('\n')
    .map(g => g.trim())
    .filter(g => g.length > 0)
);

// Load games with clear logos
const gamesWithLogosData = JSON.parse(fs.readFileSync('games-with-logos.json', 'utf8'));
const GAMES_WITH_LOGOS = new Set(
  gamesWithLogosData.map((game: any) => game.launchbox_id || game.id)
);

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface LaunchBoxGame {
  DatabaseID?: string;
  Name?: string;
  Platform?: string;
  Overview?: string;
  Genres?: string;
  ESRB?: string;
  CommunityRating?: string;
  CommunityRatingCount?: string;
  ReleaseYear?: string;
  Developer?: string;
  Publisher?: string;
  MaxPlayers?: string;
  VideoURL?: string;
}

function parseGenres(genresString?: string): string[] | null {
  if (!genresString) return null;
  return genresString.split(';').map(g => g.trim()).filter(g => g.length > 0);
}

function extractXMLValue(line: string, tag: string): string | undefined {
  const match = line.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
  return match ? match[1] : undefined;
}

function shouldIncludeGame(game: LaunchBoxGame): boolean {
  // Check if game has a clear logo available
  if (!game.DatabaseID || !GAMES_WITH_LOGOS.has(parseInt(game.DatabaseID))) {
    return false;
  }

  // Check platform filter
  if (!game.Platform || !INCLUDED_PLATFORMS.has(game.Platform)) {
    return false;
  }

  // Check genre filter
  if (game.Genres) {
    const gameGenres = game.Genres.split(';').map(g => g.trim());
    const hasExcludedGenre = gameGenres.some(genre => EXCLUDED_GENRES.has(genre));
    if (hasExcludedGenre) {
      return false;
    }
  }

  return true;
}

async function importFullXML() {
  try {
    console.log('🚀 Starting filtered LaunchBox XML import to Supabase...\n');

    // Log filter configuration
    console.log(`🎯 Clear logo filter: ${GAMES_WITH_LOGOS.size} games with available logos`);
    console.log(`📋 Platform filter: ${INCLUDED_PLATFORMS.size} included platforms`);
    console.log(`🚫 Genre filter: ${EXCLUDED_GENRES.size} excluded genres`);
    console.log('');

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

    // Process XML file line by line
    console.log('\n📖 Processing XML line by line...');

    const fileStream = createReadStream('Metadata.xml');
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentGame: LaunchBoxGame = {};
    let games: LaunchBoxGame[] = [];
    let lineCount = 0;
    let gamesWithVideos = 0;

    for await (const line of rl) {
      lineCount++;

      if (lineCount % 500000 === 0) {
        console.log(`📈 Processed ${lineCount} lines...`);
      }

      // Check if we're starting a new game
      if (line.includes('<Game>')) {
        currentGame = {};
      }

      // Extract all game fields
      const databaseId = extractXMLValue(line, 'DatabaseID');
      if (databaseId) currentGame.DatabaseID = databaseId;

      const name = extractXMLValue(line, 'Name');
      if (name) currentGame.Name = name;

      const platform = extractXMLValue(line, 'Platform');
      if (platform) currentGame.Platform = platform;

      const overview = extractXMLValue(line, 'Overview');
      if (overview) currentGame.Overview = overview;

      const genres = extractXMLValue(line, 'Genres');
      if (genres) currentGame.Genres = genres;

      const esrb = extractXMLValue(line, 'ESRB');
      if (esrb) currentGame.ESRB = esrb;

      const communityRating = extractXMLValue(line, 'CommunityRating');
      if (communityRating) currentGame.CommunityRating = communityRating;

      const communityRatingCount = extractXMLValue(line, 'CommunityRatingCount');
      if (communityRatingCount) currentGame.CommunityRatingCount = communityRatingCount;

      const releaseYear = extractXMLValue(line, 'ReleaseYear');
      if (releaseYear) currentGame.ReleaseYear = releaseYear;

      const developer = extractXMLValue(line, 'Developer');
      if (developer) currentGame.Developer = developer;

      const publisher = extractXMLValue(line, 'Publisher');
      if (publisher) currentGame.Publisher = publisher;

      const maxPlayers = extractXMLValue(line, 'MaxPlayers');
      if (maxPlayers) currentGame.MaxPlayers = maxPlayers;

      const videoUrl = extractXMLValue(line, 'VideoURL');
      if (videoUrl) {
        currentGame.VideoURL = videoUrl;
        gamesWithVideos++;
      }

      // Check if we're ending a game
      if (line.includes('</Game>')) {
        if (currentGame.DatabaseID && currentGame.Name && currentGame.Platform) {
          // Apply filters before adding to batch
          if (shouldIncludeGame(currentGame)) {
            games.push({ ...currentGame });
          }
        }
        currentGame = {};

        // Process in batches to avoid memory buildup
        if (games.length >= 1000) {
          await processBatch(games);
          games = [];
        }
      }
    }

    // Process remaining games
    if (games.length > 0) {
      await processBatch(games);
    }

    console.log(`\n✅ XML processing completed!`);
    console.log(`📊 Total games processed: ${lineCount / 1000} (estimated)`);
    console.log(`🎬 Games with video URLs: ${gamesWithVideos}`);

    // Verify import
    const { count, error: countError } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error verifying import:', countError);
      return;
    }

    console.log(`\n🎉 Full XML import completed successfully!`);
    console.log(`📊 Total games in Supabase games_database: ${count}`);
    console.log(`🎮 Rich metadata: ✅ (genres, ratings, overviews, developer, publisher, etc.)`);

  } catch (error) {
    console.error('Import error:', error);
  }
}

async function processBatch(games: LaunchBoxGame[]) {
  try {
    // Transform LaunchBox data to Supabase format
    const formattedBatch = games
      .filter(game => game.DatabaseID && game.Name && game.Platform)
      .map(game => ({
        // Use LaunchBox DatabaseID as the ID
        id: parseInt(game.DatabaseID!),
        name: game.Name!,
        platform_name: game.Platform!,
        overview: game.Overview || null,
        genres: parseGenres(game.Genres),
        esrb_rating: game.ESRB || null,
        community_rating: game.CommunityRating ? parseFloat(game.CommunityRating) : null,
        community_rating_count: game.CommunityRatingCount ? parseInt(game.CommunityRatingCount) : null,
        release_year: game.ReleaseYear ? parseInt(game.ReleaseYear) : null,
        developer: game.Developer || null,
        publisher: game.Publisher || null,
        max_players: game.MaxPlayers ? parseInt(game.MaxPlayers) : null,
        launchbox_id: parseInt(game.DatabaseID!),
        logo_base64: null, // Will be populated later if needed
        video_url: game.VideoURL || null // Add video URL from LaunchBox
      }));

    if (formattedBatch.length === 0) return;

    const { error: insertError } = await supabase
      .from('games_database')
      .insert(formattedBatch);

    if (insertError) {
      console.error('Error inserting batch:', insertError);
      // Continue processing other batches
    } else {
      console.log(`📥 Imported batch of ${formattedBatch.length} games`);
    }
  } catch (error) {
    console.error('Batch processing error:', error);
  }
}

importFullXML().catch(console.error);
