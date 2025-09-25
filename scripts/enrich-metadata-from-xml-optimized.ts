#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
  VideoURL?: string;
}

function parseGenres(genresString?: string): string[] | null {
  if (!genresString) return null;
  return genresString.split(';').map(g => g.trim()).filter(g => g.length > 0);
}

async function enrichMetadataFromXMLOptimized() {
  const failedGames: Array<{launchboxId: number, name: string, error: string, updateData: any}> = [];

  try {
    console.log('🚀 Optimized metadata enrichment from LaunchBox XML...\n');

    // Step 1: Pre-load LaunchBox IDs we actually need
    console.log('📊 Loading LaunchBox IDs from our database...');
    const { data: existingGames, error: gamesError } = await supabase
      .from('games_database')
      .select('launchbox_id')
      .not('launchbox_id', 'is', null);

    if (gamesError) {
      console.error('❌ Error loading existing games:', gamesError);
      return;
    }

    const neededLaunchboxIds = new Set(
      existingGames.map(game => game.launchbox_id.toString())
    );

    console.log(`✅ Loaded ${neededLaunchboxIds.size} LaunchBox IDs that need metadata`);
    console.log(`🎯 Will skip ${169664 - neededLaunchboxIds.size} unnecessary XML entries (${(((169664 - neededLaunchboxIds.size) / 169664) * 100).toFixed(1)}% reduction)`);

    // Step 2: Read and filter XML efficiently
    console.log('\n📖 Reading LaunchBox XML file...');
    const xmlData = fs.readFileSync('Metadata.xml', 'utf8');

    console.log('🔍 Extracting and filtering game entries from XML...');

    // Extract all game XML blocks
    const gameMatches = xmlData.match(/<Game>.*?<\/Game>/gs);

    if (!gameMatches) {
      console.log('❌ No game entries found in XML');
      return;
    }

    console.log(`📊 Found ${gameMatches.length} total game entries in XML`);

    // Step 3: Pre-filter XML games by DatabaseID before parsing
    console.log('⚡ Pre-filtering XML games by LaunchBox ID...');
    const filteredGameXml: string[] = [];

    for (const gameXml of gameMatches) {
      // Quick regex check for DatabaseID without full XML parsing
      const dbIdMatch = gameXml.match(/<DatabaseID>(\d+)<\/DatabaseID>/);
      if (dbIdMatch && neededLaunchboxIds.has(dbIdMatch[1])) {
        filteredGameXml.push(gameXml);
      }
    }

    console.log(`✅ Filtered down to ${filteredGameXml.length} games that need metadata (${((filteredGameXml.length / gameMatches.length) * 100).toFixed(1)}% of original)`);
    console.log(`🚀 Processing will be ${Math.round(gameMatches.length / filteredGameXml.length)}x faster!\n`);

    // Step 4: Process only the filtered games
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: false,
      parseTrueNumberOnly: false,
    });

    const BATCH_SIZE = 100;
    let processed = 0;
    let updated = 0;

    console.log('📥 Processing filtered XML games in batches...');

    for (let i = 0; i < filteredGameXml.length; i += BATCH_SIZE) {
      const batch = filteredGameXml.slice(i, i + BATCH_SIZE);

      // Parse this batch of games
      const parsedGames: LaunchBoxGame[] = [];

      for (const gameXml of batch) {
        try {
          const wrappedXml = `<root>${gameXml}</root>`;
          const parsed = parser.parse(wrappedXml);
          if (parsed.root?.Game) {
            parsedGames.push(parsed.root.Game);
          }
        } catch (error) {
          console.warn(`⚠️ Error parsing game XML: ${error}`);
        }
      }

      // Update Supabase records for this batch
      for (const xmlGame of parsedGames) {
        try {
          const launchboxId = parseInt(xmlGame.DatabaseID);

          // Prepare metadata update
          const updateData = {
            overview: xmlGame.Overview || null,
            genres: parseGenres(xmlGame.Genres),
            esrb_rating: xmlGame.ESRB || null,
            community_rating: xmlGame.CommunityRating ? parseFloat(xmlGame.CommunityRating) : null,
            community_rating_count: xmlGame.CommunityRatingCount ? parseInt(xmlGame.CommunityRatingCount) : null,
            release_year: xmlGame.ReleaseYear ? parseInt(xmlGame.ReleaseYear) : null,
            developer: xmlGame.Developer || null,
            publisher: xmlGame.Publisher || null,
            max_players: xmlGame.MaxPlayers ? parseInt(xmlGame.MaxPlayers) : null,
            video_url: xmlGame.VideoURL || null,
          };

          // Update records in Supabase that match this LaunchBox ID
          const { error: updateError } = await supabase
            .from('games_database')
            .update(updateData)
            .eq('launchbox_id', launchboxId);

          if (updateError) {
            console.warn(`⚠️ Error updating game ${xmlGame.Name} (ID: ${launchboxId}):`, updateError.message);

            // Log failed game for retry later
            failedGames.push({
              launchboxId,
              name: xmlGame.Name,
              error: updateError.message,
              updateData
            });
          } else {
            updated++;
          }
        } catch (error) {
          console.warn(`⚠️ Error processing game ${xmlGame.Name}:`, error);
        }
      }

      processed += batch.length;
      const progress = ((processed / filteredGameXml.length) * 100).toFixed(1);
      console.log(`📈 Progress: ${processed}/${filteredGameXml.length} relevant games processed (${progress}%) - ${updated} updated`);

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 50)); // Shorter delay since we're processing fewer games
    }

    console.log(`\n🎉 Optimized metadata enrichment completed!`);
    console.log(`📊 Total relevant XML games processed: ${processed}`);
    console.log(`📊 Games updated with metadata: ${updated}`);
    console.log(`⚡ Efficiency: Skipped ${gameMatches.length - filteredGameXml.length} irrelevant games`);

    // Verify some updated records
    const { data: sampleGames, error: sampleError } = await supabase
      .from('games_database')
      .select('name, platform_name, developer, community_rating, overview, genres')
      .not('overview', 'is', null)
      .limit(5);

    if (!sampleError && sampleGames && sampleGames.length > 0) {
      console.log('\n🎮 Sample updated games with metadata:');
      sampleGames.forEach((game, index) => {
        const rating = game.community_rating ? `${game.community_rating}/10` : 'No rating';
        const dev = game.developer || 'Unknown developer';
        const overview = game.overview ? `${game.overview.substring(0, 100)}...` : 'No overview';
        const genres = game.genres ? game.genres.join(', ') : 'No genres';
        console.log(`${(index + 1).toString().padStart(2)}. ${game.name} (${game.platform_name})`);
        console.log(`    Developer: ${dev} | Rating: ${rating}`);
        console.log(`    Genres: ${genres}`);
        console.log(`    Overview: ${overview}`);
        console.log('');
      });
    }

    // Save failed games to file for retry later
    if (failedGames.length > 0) {
      const failedGamesFile = 'failed-games-enrichment-optimized.json';
      fs.writeFileSync(failedGamesFile, JSON.stringify(failedGames, null, 2));
      console.log(`\n⚠️  ${failedGames.length} games failed to update due to network/server errors`);
      console.log(`📄 Failed games saved to: ${failedGamesFile}`);
      console.log(`🔄 You can retry these later with: npx tsx scripts/retry-failed-enrichment.ts`);
    } else {
      console.log(`\n✅ All games were successfully enriched with no failures!`);
    }

  } catch (error) {
    console.error('❌ Error enriching metadata:', error);

    // Save failed games even if script crashes
    if (failedGames.length > 0) {
      const failedGamesFile = 'failed-games-enrichment-optimized.json';
      fs.writeFileSync(failedGamesFile, JSON.stringify(failedGames, null, 2));
      console.log(`📄 Failed games saved to: ${failedGamesFile}`);
    }
  }
}

enrichMetadataFromXMLOptimized().catch(console.error);