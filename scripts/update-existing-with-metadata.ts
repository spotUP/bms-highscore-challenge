#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import xml2js from 'xml2js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface LaunchBoxGame {
  DatabaseID: string;
  Name: string;
  Platform?: string;
  Overview?: string;
  VideoURL?: string;
  ReleaseYear?: string;
  MaxPlayers?: string;
  Genres?: string[];
  Developer?: string;
  Publisher?: string;
  CommunityRating?: string;
  CommunityRatingCount?: string;
  ESRBRating?: string;
  WikipediaURL?: string;
  VideoURLs?: string[];
  ReleaseType?: string;
  ReleaseDate?: string;
  Series?: string;
  Region?: string;
  AlternateNames?: string[];
  PlayModes?: string[];
  Themes?: string[];
}

async function updateExistingGamesWithMetadata() {
  console.log('🔄 Updating existing games with LaunchBox metadata...\n');

  // Read and parse the LaunchBox XML data
  const dataPath = '/tmp/Metadata.xml';
  if (!fs.existsSync(dataPath)) {
    console.error('❌ metadata.xml not found. Please run the download script first.');
    process.exit(1);
  }

  console.log('📖 Reading LaunchBox metadata...');
  const xmlData = fs.readFileSync(dataPath, 'utf-8');
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xmlData);

  const launchBoxGames: LaunchBoxGame[] = result.LaunchBox.Game || [];
  console.log(`✅ Found ${launchBoxGames.length} games in LaunchBox data`);

  // Create a lookup map of LaunchBox ID to metadata
  const metadataMap = new Map<number, any>();

  for (const game of launchBoxGames) {
    const id = parseInt(game.DatabaseID);
    if (!isNaN(id)) {
      const metadata = {
        release_year: game.ReleaseYear ? parseInt(game.ReleaseYear) : null,
        overview: game.Overview || null,
        max_players: game.MaxPlayers ? parseInt(game.MaxPlayers) : null,
        genres: game.Genres || null,
        developer: game.Developer || null,
        publisher: game.Publisher || null,
        community_rating: game.CommunityRating ? parseFloat(game.CommunityRating) : null,
        video_url: game.VideoURL || null
      };
      metadataMap.set(id, metadata);
    }
  }

  console.log(`✅ Created metadata map for ${metadataMap.size} games\n`);

  // Get existing games from database
  console.log('🔍 Fetching existing games from database...');
  const { data: existingGames, error: fetchError } = await supabase
    .from('games_database')
    .select('id, name, platform_name, logo_base64')
    .order('id');

  if (fetchError) {
    console.error('❌ Error fetching games:', fetchError);
    process.exit(1);
  }

  console.log(`✅ Found ${existingGames?.length || 0} existing games\n`);

  if (!existingGames || existingGames.length === 0) {
    console.log('ℹ️ No existing games found to update');
    return;
  }

  let updatedCount = 0;
  let withVideoCount = 0;
  const batchSize = 50;

  for (let i = 0; i < existingGames.length; i += batchSize) {
    const batch = existingGames.slice(i, i + batchSize);
    const updates = [];

    for (const game of batch) {
      const metadata = metadataMap.get(game.id);
      if (metadata) {
        // Parse existing logo_base64 if it exists
        let currentData = {};
        if (game.logo_base64) {
          try {
            const decoded = Buffer.from(game.logo_base64, 'base64').toString('utf-8');
            currentData = JSON.parse(decoded);
          } catch (e) {
            // Keep existing if not JSON
          }
        }

        // Merge with new metadata
        const enrichedData = {
          ...currentData,
          ...metadata
        };

        const enrichedBase64 = Buffer.from(JSON.stringify(enrichedData)).toString('base64');

        updates.push({
          id: game.id,
          logo_base64: enrichedBase64
        });

        updatedCount++;
        if (metadata.video_url) {
          withVideoCount++;
        }
      }
    }

    if (updates.length > 0) {
      const { error: updateError } = await supabase
        .from('games_database')
        .upsert(updates, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (updateError) {
        console.error(`❌ Error updating batch ${i / batchSize + 1}:`, updateError);
      } else {
        console.log(`✅ Updated batch ${i / batchSize + 1}/${Math.ceil(existingGames.length / batchSize)} - ${updates.length} games enriched`);
      }
    }
  }

  console.log('\n🎉 Update completed!');
  console.log(`✅ ${updatedCount} games enriched with metadata`);
  console.log(`🎬 ${withVideoCount} games now have video URLs`);
  console.log('🔄 Video functionality should now work in GameDetailsModal');
}

updateExistingGamesWithMetadata().then(() => process.exit(0));