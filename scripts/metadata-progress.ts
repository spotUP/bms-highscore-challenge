#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ANSI escape codes for colors and formatting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

function createProgressBar(current: number, total: number, width: number = 50): string {
  const percentage = (current / total) * 100;
  const filled = Math.round((current / total) * width);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `${colors.cyan}[${bar}]${colors.reset} ${percentage.toFixed(1)}%`;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

async function showProgress() {
  const startTime = Date.now();
  const totalXMLGames = 169664; // Total games in LaunchBox XML
  const totalDatabaseGames = 31753; // Games with clear logos in our database

  while (true) {
    try {
      clearScreen();

      // Header
      console.log(`${colors.bright}${colors.blue}🔄 LAUNCHBOX XML PROCESSING PROGRESS${colors.reset}\n`);

      // Get database games count (with cache-busting timestamp)
      const cacheKey = Date.now();
      const { count: totalGames, error: totalError } = await supabase
        .from('games_database')
        .select('*', { count: 'exact', head: true })
        .gte('id', 0); // Force fresh query

      if (totalError) {
        console.log(`${colors.red}❌ Error getting total games: ${totalError.message}${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      // Get games with metadata (enriched) - force fresh query
      const { count: enrichedGames, error: enrichedError } = await supabase
        .from('games_database')
        .select('*', { count: 'exact', head: true })
        .not('developer', 'is', null)
        .gte('id', 0); // Force fresh query

      if (enrichedError) {
        console.log(`${colors.red}❌ Error getting enriched games: ${enrichedError.message}${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      // Get games with video URLs count - force fresh query
      const { count: gamesWithVideos, error: videoError } = await supabase
        .from('games_database')
        .select('*', { count: 'exact', head: true })
        .not('video_url', 'is', null)
        .neq('video_url', '')
        .gte('id', 0); // Force fresh query

      if (videoError) {
        console.log(`${colors.red}❌ Error getting games with videos: ${videoError.message}${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      // Calculate progress percentages
      const databaseEnrichmentPercentage = totalGames ? (enrichedGames / totalGames) * 100 : 0;

      // Calculate XML processing progress more accurately
      // The enrichment script processes XML games sequentially, updating matching database games
      // If we have enriched X database games out of ~31,753 total, that corresponds to
      // processing (X / 31,753) * 169,664 XML games (proportional processing)
      const xmlProcessingRatio = totalDatabaseGames > 0 ? (enrichedGames / totalDatabaseGames) : 0;
      const estimatedXMLProcessed = Math.round(xmlProcessingRatio * totalXMLGames);
      const xmlProcessingPercentage = Math.min(100, (estimatedXMLProcessed / totalXMLGames) * 100);

      const remainingToEnrich = Math.max(0, totalGames - enrichedGames);

      // Display progress bars
      console.log(`${colors.bright}XML Processing Progress:${colors.reset}`);
      console.log(createProgressBar(estimatedXMLProcessed, totalXMLGames, 60));
      console.log('');

      console.log(`${colors.bright}Database Enrichment:${colors.reset}`);
      console.log(createProgressBar(enrichedGames, totalGames, 60));
      console.log('');

      console.log(`${colors.bright}Video URLs Added:${colors.reset}`);
      console.log(createProgressBar(gamesWithVideos, Math.round(totalGames * 0.6), 60));
      console.log('');

      // Display stats
      console.log(`${colors.bright}Processing Statistics:${colors.reset}`);
      console.log(`${colors.green}🔄 XML Games Processed:${colors.reset}   ${colors.bright}${formatNumber(estimatedXMLProcessed)}${colors.reset} / ${formatNumber(totalXMLGames)} (${xmlProcessingPercentage.toFixed(1)}%)`);
      console.log(`${colors.blue}📚 Database Enriched:${colors.reset}    ${colors.bright}${formatNumber(enrichedGames)}${colors.reset} / ${formatNumber(totalGames)} (${databaseEnrichmentPercentage.toFixed(1)}%)`);
      console.log(`${colors.magenta}🎬 Games with Videos:${colors.reset}    ${colors.bright}${formatNumber(gamesWithVideos)}${colors.reset}`);
      console.log(`${colors.yellow}⏳ Remaining to Process:${colors.reset} ${colors.bright}${formatNumber(totalXMLGames - estimatedXMLProcessed)}${colors.reset}`);

      // Calculate elapsed time and estimated completion
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const elapsedTime = formatTime(elapsedSeconds);

      console.log('');
      console.log(`${colors.bright}Timing:${colors.reset}`);
      console.log(`${colors.cyan}⏰ Elapsed Time:${colors.reset}         ${colors.bright}${elapsedTime}${colors.reset}`);

      if (enrichedGames > 0 && xmlProcessingPercentage < 100) {
        const rate = estimatedXMLProcessed / elapsedSeconds; // XML games per second
        const remainingSeconds = (totalXMLGames - estimatedXMLProcessed) / rate;
        const estimatedTime = formatTime(remainingSeconds);
        console.log(`${colors.cyan}⏱️  Estimated Remaining:${colors.reset}    ${colors.bright}${estimatedTime}${colors.reset}`);
        console.log(`${colors.dim}   Rate: ${rate.toFixed(1)} XML games/second${colors.reset}`);
      }

      // Show recently enriched games - force fresh query
      const { data: recentGames, error: recentError } = await supabase
        .from('games_database')
        .select('name, platform_name, developer, community_rating, video_url, updated_at')
        .not('developer', 'is', null)
        .gte('id', 0) // Force fresh query
        .order('updated_at', { ascending: false })
        .limit(3);

      if (!recentError && recentGames && recentGames.length > 0) {
        console.log('');
        console.log(`${colors.bright}Recently Enriched:${colors.reset}`);
        recentGames.forEach((game, index) => {
          const rating = game.community_rating ? ` (${game.community_rating.toFixed(1)}/10)` : '';
          const dev = game.developer ? ` - ${game.developer}` : '';
          const hasVideo = game.video_url ? ' 🎬' : '';
          console.log(`${colors.dim}${index + 1}.${colors.reset} ${colors.white}${game.name}${colors.reset} ${colors.dim}(${game.platform_name})${dev}${colors.green}${rating}${colors.reset}${hasVideo}`);
        });
      }

      // Status indicator
      console.log('');
      if (xmlProcessingPercentage >= 99.5) {
        console.log(`${colors.bgGreen}${colors.white} 🎉 XML PROCESSING COMPLETE! 🎉 ${colors.reset}`);
      } else if (databaseEnrichmentPercentage >= 95) {
        console.log(`${colors.bgYellow}${colors.white} 🔄 NEARLY COMPLETE - PROCESSING FINAL XML GAMES 🔄 ${colors.reset}`);
      } else {
        console.log(`${colors.bgBlue}${colors.white} 🔄 XML PROCESSING IN PROGRESS... 🔄 ${colors.reset}`);
      }

      console.log('');
      console.log(`${colors.dim}Press Ctrl+C to exit | Refreshing every 5 seconds...${colors.reset}`);

      // Exit if complete
      if (xmlProcessingPercentage >= 99.5) {
        console.log(`${colors.green}${colors.bright}LaunchBox XML processing completed! All games have been enriched with metadata!${colors.reset}`);
        break;
      }

      // Wait 5 seconds before next update
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      console.log(`${colors.red}❌ Error: ${error}${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}👋 Progress monitoring stopped.${colors.reset}`);
  process.exit(0);
});

console.log(`${colors.bright}${colors.cyan}Starting metadata enrichment progress monitor...${colors.reset}`);
showProgress().catch(console.error);