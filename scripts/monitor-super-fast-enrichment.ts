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

async function monitorSuperFastEnrichment() {
  const startTime = Date.now();
  const totalDatabaseGames = 31753; // Games with clear logos in our database
  let lastEnrichedCount = 0;
  let lastCheckTime = startTime;

  while (true) {
    try {
      clearScreen();

      // Header
      console.log(`${colors.bright}${colors.magenta}⚡ SUPER FAST METADATA ENRICHMENT MONITOR${colors.reset}\n`);

      // Get current enrichment status
      const { count: totalGames, error: totalError } = await supabase
        .from('games_database')
        .select('*', { count: 'exact', head: true })
        .gte('id', 0);

      if (totalError) {
        console.log(`${colors.red}❌ Error getting total games: ${totalError.message}${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      // Get enriched games count
      const { count: enrichedGames, error: enrichedError } = await supabase
        .from('games_database')
        .select('*', { count: 'exact', head: true })
        .not('developer', 'is', null)
        .gte('id', 0);

      if (enrichedError) {
        console.log(`${colors.red}❌ Error getting enriched games: ${enrichedError.message}${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      // Get games with video URLs
      const { count: gamesWithVideos, error: videoError } = await supabase
        .from('games_database')
        .select('*', { count: 'exact', head: true })
        .not('video_url', 'is', null)
        .neq('video_url', '')
        .gte('id', 0);

      if (videoError) {
        console.log(`${colors.red}❌ Error getting games with videos: ${videoError.message}${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      // Calculate progress and rates
      const enrichmentPercentage = totalGames ? (enrichedGames / totalGames) * 100 : 0;
      const videoPercentage = totalGames ? (gamesWithVideos / totalGames) * 100 : 0;
      const remainingToEnrich = Math.max(0, totalGames - enrichedGames);

      // Calculate real-time processing rate
      const currentTime = Date.now();
      const timeSinceLastCheck = (currentTime - lastCheckTime) / 1000;
      const gamesSinceLastCheck = enrichedGames - lastEnrichedCount;
      const currentRate = timeSinceLastCheck > 0 ? gamesSinceLastCheck / timeSinceLastCheck : 0;

      lastEnrichedCount = enrichedGames;
      lastCheckTime = currentTime;

      // Display progress bars
      console.log(`${colors.bright}Enrichment Progress:${colors.reset}`);
      console.log(createProgressBar(enrichedGames, totalGames, 60));
      console.log('');

      console.log(`${colors.bright}Video URLs Added:${colors.reset}`);
      console.log(createProgressBar(gamesWithVideos, Math.round(totalGames * 0.6), 60));
      console.log('');

      // Display detailed stats
      console.log(`${colors.bright}Processing Statistics:${colors.reset}`);
      console.log(`${colors.blue}📚 Database Games:${colors.reset}       ${colors.bright}${formatNumber(totalGames)}${colors.reset} total games with clear logos`);
      console.log(`${colors.green}✅ Enriched Games:${colors.reset}       ${colors.bright}${formatNumber(enrichedGames)}${colors.reset} / ${formatNumber(totalGames)} (${enrichmentPercentage.toFixed(1)}%)`);
      console.log(`${colors.magenta}🎬 Games with Videos:${colors.reset}    ${colors.bright}${formatNumber(gamesWithVideos)}${colors.reset} (${videoPercentage.toFixed(1)}%)`);
      console.log(`${colors.yellow}⏳ Remaining:${colors.reset}            ${colors.bright}${formatNumber(remainingToEnrich)}${colors.reset} games need metadata`);

      // Calculate timing
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const elapsedTime = formatTime(elapsedSeconds);

      console.log('');
      console.log(`${colors.bright}Performance Metrics:${colors.reset}`);
      console.log(`${colors.cyan}⏰ Elapsed Time:${colors.reset}         ${colors.bright}${elapsedTime}${colors.reset}`);

      if (currentRate > 0) {
        console.log(`${colors.cyan}⚡ Current Rate:${colors.reset}         ${colors.bright}${currentRate.toFixed(1)} games/second${colors.reset}`);
      }

      if (enrichedGames > 0 && remainingToEnrich > 0 && currentRate > 0) {
        const estimatedSeconds = remainingToEnrich / currentRate;
        const estimatedTime = formatTime(estimatedSeconds);
        console.log(`${colors.cyan}⏱️  Estimated Remaining:${colors.reset}   ${colors.bright}${estimatedTime}${colors.reset}`);
      }

      // Show recently enriched games
      const { data: recentGames, error: recentError } = await supabase
        .from('games_database')
        .select('name, platform_name, developer, community_rating, video_url, updated_at')
        .not('developer', 'is', null)
        .gte('id', 0)
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
      if (enrichmentPercentage >= 99.5) {
        console.log(`${colors.bgGreen}${colors.white} 🎉 SUPER FAST ENRICHMENT COMPLETE! 🎉 ${colors.reset}`);
        console.log(`${colors.green}${colors.bright}All games have been enriched with metadata at lightning speed!${colors.reset}`);
        break;
      } else if (enrichmentPercentage >= 95) {
        console.log(`${colors.bgYellow}${colors.white} ⚡ NEARLY COMPLETE - FINAL GAMES PROCESSING ⚡ ${colors.reset}`);
      } else if (currentRate > 50) {
        console.log(`${colors.bgMagenta}${colors.white} 🚀 SUPER FAST MODE - HIGH SPEED PROCESSING 🚀 ${colors.reset}`);
      } else {
        console.log(`${colors.bgBlue}${colors.white} ⚡ FAST ENRICHMENT IN PROGRESS... ⚡ ${colors.reset}`);
      }

      console.log('');
      console.log(`${colors.dim}Press Ctrl+C to exit | Refreshing every 2 seconds for fast updates...${colors.reset}`);

      // Shorter refresh interval for fast processing
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.log(`${colors.red}❌ Monitor error: ${error}${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}👋 Super fast enrichment monitoring stopped.${colors.reset}`);
  process.exit(0);
});

console.log(`${colors.bright}${colors.magenta}Starting super fast metadata enrichment monitor...${colors.reset}`);
monitorSuperFastEnrichment().catch(console.error);