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
  const expectedTotalGames = 31753; // Games with clear logos that need enrichment
  const expectedGamesWithVideos = 15000; // Estimated games with video URLs after enrichment

  while (true) {
    try {
      clearScreen();

      // Header
      console.log(`${colors.bright}${colors.blue}📚 METADATA ENRICHMENT PROGRESS${colors.reset}\n`);

      // Get total games count
      const { count: totalGames, error: totalError } = await supabase
        .from('games_database')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        console.log(`${colors.red}❌ Error getting total games: ${totalError.message}${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      // Get games with video URLs count
      const { count: gamesWithVideos, error: videoError } = await supabase
        .from('games_database')
        .select('*', { count: 'exact', head: true })
        .not('video_url', 'is', null);

      if (videoError) {
        console.log(`${colors.red}❌ Error getting games with videos: ${videoError.message}${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      // Calculate progress based on enrichment, not total games
      const gamesWithMetadata = await supabase
        .from('games_database')
        .select('*', { count: 'exact', head: true })
        .not('developer', 'is', null);

      const enrichedGames = gamesWithMetadata.count || 0;
      const enrichmentPercentage = totalGames ? (enrichedGames / totalGames) * 100 : 0;
      const videoPercentage = gamesWithVideos ? (gamesWithVideos / expectedGamesWithVideos) * 100 : 0;
      const remainingToEnrich = Math.max(0, totalGames - enrichedGames);
      const remainingVideos = Math.max(0, expectedGamesWithVideos - gamesWithVideos);

      // Display progress bars
      console.log(`${colors.bright}Metadata Enrichment:${colors.reset}`);
      console.log(createProgressBar(enrichedGames, totalGames, 60));
      console.log('');

      console.log(`${colors.bright}Video URLs Added:${colors.reset}`);
      console.log(createProgressBar(gamesWithVideos, expectedGamesWithVideos, 60));
      console.log('');

      // Display stats
      console.log(`${colors.bright}Enrichment Statistics:${colors.reset}`);
      console.log(`${colors.green}📚 Games Enriched:${colors.reset}      ${colors.bright}${formatNumber(enrichedGames)}${colors.reset} / ${formatNumber(totalGames)}`);
      console.log(`${colors.blue}🎬 Games with Videos:${colors.reset}   ${colors.bright}${formatNumber(gamesWithVideos)}${colors.reset} / ${formatNumber(expectedGamesWithVideos)}`);
      console.log(`${colors.yellow}⏳ Need Enrichment:${colors.reset}     ${colors.bright}${formatNumber(remainingToEnrich)}${colors.reset}`);
      console.log(`${colors.magenta}📈 Enrichment Progress:${colors.reset} ${colors.bright}${enrichmentPercentage.toFixed(2)}%${colors.reset}`);
      console.log(`${colors.cyan}🎥 Video Progress:${colors.reset}      ${colors.bright}${videoPercentage.toFixed(2)}%${colors.reset}`);

      // Calculate elapsed time and estimated completion
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const elapsedTime = formatTime(elapsedSeconds);

      console.log('');
      console.log(`${colors.bright}Timing:${colors.reset}`);
      console.log(`${colors.cyan}⏰ Elapsed Time:${colors.reset}       ${colors.bright}${elapsedTime}${colors.reset}`);

      if (enrichedGames > 0 && enrichmentPercentage < 100) {
        const rate = enrichedGames / elapsedSeconds; // games per second
        const remainingSeconds = remainingToEnrich / rate;
        const estimatedTime = formatTime(remainingSeconds);
        console.log(`${colors.cyan}⏱️  Estimated Remaining:${colors.reset}  ${colors.bright}${estimatedTime}${colors.reset}`);
        console.log(`${colors.dim}   Rate: ${rate.toFixed(1)} games/second${colors.reset}`);
      }

      // Show recently enriched games
      const { data: recentGames, error: recentError } = await supabase
        .from('games_database')
        .select('name, platform_name, developer, community_rating, video_url')
        .not('developer', 'is', null)
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
      if (enrichmentPercentage >= 100) {
        console.log(`${colors.bgGreen}${colors.white} 🎉 ENRICHMENT COMPLETE! 🎉 ${colors.reset}`);
      } else {
        console.log(`${colors.bgBlue}${colors.white} 📚 ENRICHMENT IN PROGRESS... 📚 ${colors.reset}`);
      }

      console.log('');
      console.log(`${colors.dim}Press Ctrl+C to exit | Refreshing every 5 seconds...${colors.reset}`);

      // Exit if complete
      if (enrichmentPercentage >= 100) {
        console.log(`${colors.green}${colors.bright}All games have been enriched with metadata!${colors.reset}`);
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