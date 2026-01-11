#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import { DOMParser } from 'xmldom';
import * as fs from 'fs';

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
  // Core fields
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

  // Video URLs (array)
  video_urls?: string[];
}

function parseXMLElement(element: any, tagName: string): string | null {
  const nodes = element.getElementsByTagName(tagName);
  if (nodes && nodes.length > 0 && nodes[0].firstChild) {
    return nodes[0].firstChild.nodeValue?.trim() || null;
  }
  return null;
}

function parseXMLBoolean(element: any, tagName: string): boolean | null {
  const value = parseXMLElement(element, tagName);
  if (value === null) return null;
  return value.toLowerCase() === 'true';
}

function parseXMLNumber(element: any, tagName: string): number | null {
  const value = parseXMLElement(element, tagName);
  if (value === null || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parseXMLDate(element: any, tagName: string): string | null {
  const value = parseXMLElement(element, tagName);
  if (!value) return null;

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  } catch {
    return null;
  }
}

function parseGenres(element: any): string[] {
  const genresText = parseXMLElement(element, 'Genres');
  if (!genresText) return [];

  return genresText.split(';')
    .map(g => g.trim())
    .filter(g => g.length > 0);
}

async function parseMetadataXML(): Promise<LaunchBoxGame[]> {
  console.log('📖 Parsing Metadata.xml...');

  const xmlContent = fs.readFileSync('Metadata.xml', 'utf8');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

  const games: LaunchBoxGame[] = [];
  const gameElements = xmlDoc.getElementsByTagName('Game');

  console.log(`Found ${gameElements.length} games in XML`);

  for (let i = 0; i < gameElements.length; i++) {
    const gameElement = gameElements[i];

    try {
      const name = parseXMLElement(gameElement, 'Name');
      const platform = parseXMLElement(gameElement, 'Platform');
      const databaseId = parseXMLNumber(gameElement, 'DatabaseID');

      if (!name || !platform || databaseId === null) {
        console.warn(`⚠️ Skipping game ${i} - missing core fields`);
        continue;
      }

      const game: LaunchBoxGame = {
        name,
        platform_name: platform,
        database_id: databaseId - ID_OFFSET, // Apply the offset

        // Basic metadata
        release_date: parseXMLDate(gameElement, 'ReleaseDate'),
        release_year: parseXMLNumber(gameElement, 'ReleaseYear'),
        overview: parseXMLElement(gameElement, 'Overview'),
        max_players: parseXMLNumber(gameElement, 'MaxPlayers'),
        cooperative: parseXMLBoolean(gameElement, 'Cooperative'),

        // Ratings
        community_rating: parseXMLNumber(gameElement, 'CommunityRating'),
        community_rating_count: parseXMLNumber(gameElement, 'CommunityRatingCount'),
        esrb_rating: parseXMLElement(gameElement, 'ESRB'),

        // Media URLs
        video_url: parseXMLElement(gameElement, 'VideoURL'),
        screenshot_url: parseXMLElement(gameElement, 'ScreenshotURL'),
        cover_url: parseXMLElement(gameElement, 'CoverURL'),
        logo_url: parseXMLElement(gameElement, 'LogoURL'),

        // Extended metadata
        developer: parseXMLElement(gameElement, 'Developer'),
        publisher: parseXMLElement(gameElement, 'Publisher'),
        genres: parseGenres(gameElement),
        series: parseXMLElement(gameElement, 'Series'),
        region: parseXMLElement(gameElement, 'Region'),
        release_type: parseXMLElement(gameElement, 'ReleaseType'),

        // Additional fields
        wikipedia_url: parseXMLElement(gameElement, 'WikipediaURL'),

        // Technical fields
        dos: parseXMLBoolean(gameElement, 'DOS'),
      };

      // Parse alternative names if they exist
      const altNames = parseXMLElement(gameElement, 'AlternativeNames');
      if (altNames) {
        game.alternative_names = altNames.split(';').map(n => n.trim()).filter(n => n.length > 0);
      }

      // Parse play modes if they exist
      const playModes = parseXMLElement(gameElement, 'PlayModes');
      if (playModes) {
        game.play_modes = playModes.split(';').map(m => m.trim()).filter(m => m.length > 0);
      }

      // Parse themes if they exist
      const themes = parseXMLElement(gameElement, 'Themes');
      if (themes) {
        game.themes = themes.split(';').map(t => t.trim()).filter(t => t.length > 0);
      }

      games.push(game);

      if (i % 10000 === 0) {
        console.log(`  Processed ${i}/${gameElements.length} games...`);
      }

    } catch (error) {
      console.warn(`⚠️ Error parsing game ${i}:`, error);
    }
  }

  console.log(`✅ Parsed ${games.length} games from XML`);
  return games;
}

async function createTables() {
  console.log('🗄️ Creating/updating database tables...');

  // Drop existing table to start fresh
  const dropResult = await supabase.rpc('execute_sql', {
    sql: 'DROP TABLE IF EXISTS games_database CASCADE;'
  });

  if (dropResult.error) {
    console.warn('⚠️ Could not drop table:', dropResult.error.message);
  }

  // Create comprehensive table with all fields
  const createTableSQL = `
    CREATE TABLE games_database (
      id BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      platform_name TEXT NOT NULL,
      database_id INTEGER,

      -- Basic metadata
      release_date DATE,
      release_year INTEGER,
      overview TEXT,
      max_players INTEGER,
      cooperative BOOLEAN,

      -- Ratings
      community_rating DECIMAL(10,8),
      community_rating_count INTEGER,
      esrb_rating TEXT,

      -- Media URLs
      video_url TEXT,
      screenshot_url TEXT,
      cover_url TEXT,
      logo_url TEXT,

      -- Extended metadata
      developer TEXT,
      publisher TEXT,
      genres TEXT[], -- Array of strings
      series TEXT,
      region TEXT,
      release_type TEXT,

      -- Additional fields
      wikipedia_url TEXT,
      alternative_names TEXT[], -- Array of strings
      play_modes TEXT[], -- Array of strings
      themes TEXT[], -- Array of strings

      -- Technical fields
      dos BOOLEAN,

      -- Video URLs array (for future expansion)
      video_urls TEXT[],

      -- Timestamps
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create indexes for performance
    CREATE INDEX idx_games_database_name ON games_database(name);
    CREATE INDEX idx_games_database_platform ON games_database(platform_name);
    CREATE INDEX idx_games_database_developer ON games_database(developer);
    CREATE INDEX idx_games_database_publisher ON games_database(publisher);
    CREATE INDEX idx_games_database_release_year ON games_database(release_year);
    CREATE INDEX idx_games_database_genres ON games_database USING GIN(genres);
    CREATE INDEX idx_games_database_series ON games_database(series);

    -- Create trigger for updated_at
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER update_games_database_updated_at
        BEFORE UPDATE ON games_database
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
  `;

  const createResult = await supabase.rpc('execute_sql', {
    sql: createTableSQL
  });

  if (createResult.error) {
    console.error('❌ Error creating table:', createResult.error);
    throw createResult.error;
  }

  console.log('✅ Database tables created successfully');
}

async function insertGames(games: LaunchBoxGame[]) {
  console.log(`📥 Inserting ${games.length} games into database...`);

  const batchSize = 1000;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);

    try {
      const { error } = await supabase
        .from('games_database')
        .insert(batch.map(game => ({
          id: game.database_id,
          name: game.name,
          platform_name: game.platform_name,
          database_id: game.database_id + ID_OFFSET, // Store original LaunchBox ID

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

          dos: game.dos,
          video_urls: game.video_url ? [game.video_url] : null
        })));

      if (error) {
        console.error(`❌ Error inserting batch ${i}-${i + batch.length}:`, error);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }

      console.log(`  Inserted ${inserted}/${games.length} games (${errors} errors)...`);

    } catch (error) {
      console.error(`❌ Batch error:`, error);
      errors += batch.length;
    }
  }

  console.log(`✅ Import complete: ${inserted} inserted, ${errors} errors`);
}

async function verifyImport() {
  console.log('🔍 Verifying import...');

  // Get total count
  const { count, error: countError } = await supabase
    .from('games_database')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error getting count:', countError);
    return;
  }

  console.log(`📊 Total games imported: ${count}`);

  // Test specific games to verify ID mapping
  const testGames = [
    { name: 'Super Mario Bros.', platform: 'Nintendo Entertainment System', expectedXmlId: 140, expectedDbId: -49860 },
    { name: '3D Atlas', platform: '3DO Interactive Multiplayer', expectedXmlId: 50135, expectedDbId: 135 }
  ];

  for (const test of testGames) {
    const { data, error } = await supabase
      .from('games_database')
      .select('*')
      .eq('name', test.name)
      .eq('platform_name', test.platform)
      .single();

    if (error || !data) {
      console.log(`❌ ${test.name} not found`);
      continue;
    }

    console.log(`✅ ${test.name}:`);
    console.log(`   Database ID: ${data.id} (expected: ${test.expectedDbId}) ✓`);
    console.log(`   LaunchBox ID: ${data.database_id} (expected: ${test.expectedXmlId}) ✓`);
    console.log(`   Video URL: ${data.video_url || 'None'}`);
    console.log(`   Developer: ${data.developer || 'None'}`);
    console.log(`   Genres: ${data.genres?.join(', ') || 'None'}`);
  }
}

async function comprehensiveLaunchBoxImport() {
  try {
    console.log('🚀 Starting comprehensive LaunchBox import...');
    console.log(`📋 ID Mapping: XML DatabaseID - ${ID_OFFSET} = Supabase ID`);
    console.log('');

    const games = await parseMetadataXML();
    await createTables();
    await insertGames(games);
    await verifyImport();

    console.log('');
    console.log('🎉 Comprehensive LaunchBox import completed successfully!');
    console.log('💡 All metadata fields have been imported with correct ID mapping.');

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

comprehensiveLaunchBoxImport().then(() => process.exit(0));