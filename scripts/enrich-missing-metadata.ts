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

async function enrichMissingMetadata() {
  try {
    console.log('🔍 Finding and enriching games missing metadata...\n');

    // Step 1: Get games missing developer info (our key indicator for missing metadata)
    console.log('📋 Loading games missing metadata from database...');
    const { data: missingGames, error: missingError } = await supabase
      .from('games_database')
      .select('id, name, platform_name, launchbox_id')
      .is('developer', null);

    if (missingError) {
      console.error('❌ Error loading missing games:', missingError);
      return;
    }

    console.log(`✅ Found ${missingGames.length} games missing metadata`);

    // Step 2: Create lookup set of missing LaunchBox IDs
    const missingLaunchboxIds = new Set(
      missingGames.map(game => game.launchbox_id.toString())
    );

    console.log('📖 Scanning LaunchBox XML for missing game entries...');

    // Step 3: Read XML and find entries for missing games
    const xmlData = fs.readFileSync('Metadata.xml', 'utf8');
    const gamePattern = /<Game>(.*?)<\/Game>/gs;
    const dbIdPattern = /<DatabaseID>(\d+)<\/DatabaseID>/;

    const foundGames: string[] = [];
    const notFoundIds: string[] = [];
    let match;
    let scannedGames = 0;

    while ((match = gamePattern.exec(xmlData)) !== null) {
      scannedGames++;
      const gameXml = match[0];
      const dbIdMatch = gameXml.match(dbIdPattern);

      if (dbIdMatch && missingLaunchboxIds.has(dbIdMatch[1])) {
        foundGames.push(gameXml);
        missingLaunchboxIds.delete(dbIdMatch[1]); // Remove found ID
      }

      if (scannedGames % 20000 === 0) {
        console.log(`   Scanned ${scannedGames} XML games, found ${foundGames.length} missing entries...`);
      }
    }

    // Collect IDs not found in XML
    notFoundIds.push(...Array.from(missingLaunchboxIds));

    console.log(`\n📊 Results:`);
    console.log(`✅ Found in XML: ${foundGames.length} games`);
    console.log(`❌ Not in XML: ${notFoundIds.length} games`);

    // Step 4: Process found games
    if (foundGames.length > 0) {
      console.log(`\n🔄 Processing ${foundGames.length} games found in XML...`);

      const parser = new XMLParser({
        ignoreAttributes: false,
        parseAttributeValue: false,
        parseTrueNumberOnly: false,
      });

      let processed = 0;
      let updated = 0;
      const BATCH_SIZE = 100;

      for (let i = 0; i < foundGames.length; i += BATCH_SIZE) {
        const batch = foundGames.slice(i, i + BATCH_SIZE);

        // Parse batch
        const parsedGames: LaunchBoxGame[] = [];
        for (const gameXml of batch) {
          try {
            const wrappedXml = `<root>${gameXml}</root>`;
            const parsed = parser.parse(wrappedXml);
            if (parsed.root?.Game) {
              parsedGames.push(parsed.root.Game);
            }
          } catch (error) {
            // Skip parse errors
          }
        }

        // Update database
        for (const xmlGame of parsedGames) {
          try {
            const launchboxId = parseInt(xmlGame.DatabaseID);

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

            const { error: updateError } = await supabase
              .from('games_database')
              .update(updateData)
              .eq('launchbox_id', launchboxId);

            if (!updateError) {
              updated++;
            }

          } catch (error) {
            // Skip errors
          }
        }

        processed += batch.length;
        const progress = ((processed / foundGames.length) * 100).toFixed(1);
        console.log(`📈 Progress: ${processed}/${foundGames.length} (${progress}%) - ${updated} updated`);

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`\n✅ Successfully enriched ${updated} additional games!`);
    }

    // Step 5: Report games not found in XML
    if (notFoundIds.length > 0) {
      console.log(`\n⚠️  ${notFoundIds.length} games not found in LaunchBox XML`);

      // Get sample of games not found
      const { data: notFoundSamples } = await supabase
        .from('games_database')
        .select('name, platform_name, launchbox_id')
        .in('launchbox_id', notFoundIds.slice(0, 10).map(id => parseInt(id)));

      if (notFoundSamples && notFoundSamples.length > 0) {
        console.log('\n📋 Sample games not in XML:');
        notFoundSamples.forEach((game, index) => {
          console.log(`${index + 1}. ${game.name} (${game.platform_name}) - ID: ${game.launchbox_id}`);
        });
      }

      console.log(`\nℹ️  These ${notFoundIds.length} games exist in your database but not in the LaunchBox XML.`);
      console.log(`   This is normal - not all games have complete metadata in LaunchBox.`);
    }

    // Final statistics
    console.log('\n🎉 Missing metadata enrichment completed!');

    const { count: totalEnriched } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true })
      .not('developer', 'is', null);

    console.log(`📊 Total games now with metadata: ${totalEnriched?.toLocaleString()}`);
    console.log(`📈 Added metadata for: ${updated} additional games`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

enrichMissingMetadata().catch(console.error);