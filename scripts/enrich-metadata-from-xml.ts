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

async function enrichMetadataFromXML() {
  const failedGames: Array<{launchboxId: number, name: string, error: string, updateData: any}> = [];

  try {
    console.log('🚀 Enriching metadata from LaunchBox XML in memory-efficient chunks...\\n');

    // Parse XML in streaming chunks to avoid memory issues
    console.log('📖 Reading LaunchBox XML file...');
    const xmlData = fs.readFileSync('Metadata.xml', 'utf8');

    // Split XML into smaller chunks by processing games in batches
    console.log('🔍 Extracting game entries from XML...');

    // Find all game entries using regex to avoid parsing entire XML
    const gameMatches = xmlData.match(/<Game>.*?<\/Game>/gs);

    if (!gameMatches) {
      console.log('❌ No game entries found in XML');
      return;
    }

    console.log(`📊 Found ${gameMatches.length} game entries in XML`);

    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: false,
      parseTrueNumberOnly: false,
    });

    const BATCH_SIZE = 100;
    let processed = 0;
    let updated = 0;

    console.log('\\n📥 Processing XML games in batches...');

    for (let i = 0; i < gameMatches.length; i += BATCH_SIZE) {
      const batch = gameMatches.slice(i, i + BATCH_SIZE);

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
      const progress = ((processed / gameMatches.length) * 100).toFixed(1);
      console.log(`📈 Progress: ${processed}/${gameMatches.length} games processed (${progress}%) - ${updated} updated`);

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\\n🎉 Metadata enrichment completed!`);
    console.log(`📊 Total XML games processed: ${processed}`);
    console.log(`📊 Games updated with metadata: ${updated}`);

    // Verify some updated records
    const { data: sampleGames, error: sampleError } = await supabase
      .from('games_database')
      .select('name, platform_name, developer, community_rating, overview, genres')
      .not('overview', 'is', null)
      .limit(5);

    if (!sampleError && sampleGames && sampleGames.length > 0) {
      console.log('\\n🎮 Sample updated games with metadata:');
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
    } else {
      console.log('\\n⚠️ No games found with updated metadata - checking if updates were applied...');

      // Check total count of games with any metadata
      const { count: enrichedCount, error: countError } = await supabase
        .from('games_database')
        .select('*', { count: 'exact', head: true })
        .or('overview.not.is.null,developer.not.is.null,community_rating.not.is.null');

      if (!countError) {
        console.log(`📊 Games with some metadata: ${enrichedCount}`);
      }
    }

    // Save failed games to file for retry later
    if (failedGames.length > 0) {
      const failedGamesFile = 'failed-games-enrichment.json';
      fs.writeFileSync(failedGamesFile, JSON.stringify(failedGames, null, 2));
      console.log(`\\n⚠️  ${failedGames.length} games failed to update due to network/server errors`);
      console.log(`📄 Failed games saved to: ${failedGamesFile}`);
      console.log(`🔄 You can retry these later with: npx tsx scripts/retry-failed-enrichment.ts`);
    } else {
      console.log(`\\n✅ All games were successfully enriched with no failures!`);
    }

  } catch (error) {
    console.error('❌ Error enriching metadata:', error);

    // Save failed games even if script crashes
    if (failedGames.length > 0) {
      const failedGamesFile = 'failed-games-enrichment.json';
      fs.writeFileSync(failedGamesFile, JSON.stringify(failedGames, null, 2));
      console.log(`📄 Failed games saved to: ${failedGamesFile}`);
    }
  }
}

enrichMetadataFromXML().catch(console.error);