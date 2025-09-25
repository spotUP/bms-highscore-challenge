#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkEnrichedMetadata() {
  try {
    console.log('🔍 Checking for games with enriched metadata...\n');

    // Check games that have been updated with metadata
    const { data: enrichedGames, error } = await supabase
      .from('games_database')
      .select('name, platform_name, overview, genres, esrb_rating, community_rating, developer, publisher, release_year, max_players')
      .not('overview', 'is', null)
      .limit(5);

    if (error) {
      console.error('Error fetching enriched games:', error);
      return;
    }

    if (enrichedGames && enrichedGames.length > 0) {
      console.log('🎮 Games with enriched metadata:');
      enrichedGames.forEach((game, index) => {
        const rating = game.community_rating ? `${game.community_rating}/10` : 'No rating';
        const dev = game.developer || 'Unknown developer';
        const overview = game.overview ? `${game.overview.substring(0, 100)}...` : 'No overview';
        const genres = game.genres ? game.genres.join(', ') : 'No genres';
        console.log(`\n${index + 1}. ${game.name} (${game.platform_name})`);
        console.log(`   Developer: ${dev} | Publisher: ${game.publisher || 'Unknown'}`);
        console.log(`   Year: ${game.release_year || 'Unknown'} | Rating: ${rating} | Players: ${game.max_players || 'Unknown'}`);
        console.log(`   ESRB: ${game.esrb_rating || 'Not rated'}`);
        console.log(`   Genres: ${genres}`);
        console.log(`   Overview: ${overview}`);
      });
    } else {
      console.log('❌ No games found with enriched metadata yet.');

      // Count total vs enriched
      const { count: totalGames } = await supabase
        .from('games_database')
        .select('*', { count: 'exact', head: true });

      const { count: enrichedCount } = await supabase
        .from('games_database')
        .select('*', { count: 'exact', head: true })
        .or('overview.not.is.null,developer.not.is.null,community_rating.not.is.null');

      console.log(`📊 Total games: ${totalGames}`);
      console.log(`📊 Enriched games: ${enrichedCount}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkEnrichedMetadata().catch(console.error);