#!/usr/bin/env tsx

// Improved scraper that specifically targets the Clear Logo section

import { createClient } from '@supabase/supabase-js';
import sqlite3 from 'sqlite3';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import cliProgress from 'cli-progress';
import chalk from 'chalk';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// SQLite setup
const DB_FILE = 'improved-clear-logos.db';
const PROGRESS_FILE = 'improved-scraper-progress.json';
const CHECKPOINT_INTERVAL = 30; // Save checkpoint every 30 games

interface ScraperProgress {
  instanceId: number;
  totalGames: number;
  processedGames: number;
  successfulLogos: number;
  failedLogos: number;
  currentGameId: number | null;
  currentGameName: string | null;
  currentPlatform: string | null;
  lastUpdate: string;
  status: 'running' | 'paused' | 'completed' | 'error';
  errors: string[];
  recentSuccesses: Array<{
    gameId: number;
    gameName: string;
    platform: string;
    timestamp: string;
  }>;
  startTime: string;
  gamesPerSecond?: number;
  lastCheckpointAt: number;
  resumeFromGame?: number;
}

// Expanded game list with correct LaunchBox IDs for faster bulk scraping
const CORRECT_LAUNCHBOX_IDS: Record<string, number> = {
  'Halo: Combat Evolved': 1,
  'Crysis': 2,
  'Star Fox 64': 3,
  'Donkey Kong': 4,
  'Tapper': 5,
  'Halo 2': 6,
  'Ace Combat 6: Fires of Liberation': 7,
  'Army of Two': 8,
  'Assassin\'s Creed': 9,
  'BioShock': 10,
  'Dead Space (2008)': 11,
  'Devil May Cry': 12,
  'Devil May Cry 3: Dante\'s Awakening': 13,
  'Devil May Cry 4': 14,
  'Driver: Parallel Lines': 15,
  'Final Fantasy X-2': 16,
  'Final Fantasy X': 17,
  'Final Fantasy XIII': 18,
  'Left 4 Dead': 19,
  'Gears of War': 20,
  'Gears of War 2': 21,
  'God Hand': 22,
  'God of War': 23,
  'Golden Axe: Beast Rider': 24,
  'Race Driver: Grid': 25,
  'Grand Theft Auto IV': 26,
  'Guild Wars': 27,
  'Heavenly Sword': 28,
  'Jade Empire: Special Edition': 29,
  'Jet Grind Radio': 30,
  'Killer7': 31,
  'Killzone': 32,
  'Killzone 2': 33,
  'Lair': 34,
  'The Last Remnant': 35,
  'Lost Odyssey': 36,
  'Super Mario Galaxy': 37,
  'Super Mario Kart': 38,
  'Mario Party': 39,
  'Metal Gear Ac!d': 40,
  'Metal Gear Solid 3: Snake Eater': 41,
  'Metal Gear Solid 4: Guns of the Patriots': 42,
  'Mirror\'s Edge': 43,
  'Need for Speed: ProStreet': 44,
  'NiGHTS into Dreams...': 45,
  'Ninja Gaiden II': 46,
  'Ninja Gaiden: Dragon Sword': 47,
  'Ōkami': 48,
  'Perfect Dark Zero': 49,
  'Prince of Persia': 50
};

// Progress tracking
let progress: ScraperProgress;

function loadProgress(): ScraperProgress {
  if (existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    } catch (error) {
      console.log('⚠️  Error loading progress, starting fresh');
    }
  }

  return {
    instanceId: Date.now(),
    totalGames: 0, // Will be updated with actual count from Supabase
    processedGames: 0,
    successfulLogos: 0,
    failedLogos: 0,
    currentGameId: null,
    currentGameName: null,
    currentPlatform: null,
    lastUpdate: new Date().toISOString(),
    status: 'running',
    errors: [],
    recentSuccesses: [],
    startTime: new Date().toISOString(),
    lastCheckpointAt: 0,
    resumeFromGame: 0
  };
}

function saveProgress(progress: ScraperProgress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function saveCheckpoint(progress: ScraperProgress) {
  const checkpointFile = `improved-checkpoint-${progress.processedGames}.json`;
  writeFileSync(checkpointFile, JSON.stringify(progress, null, 2));
  progress.lastCheckpointAt = progress.processedGames;
  console.log(chalk.blue(`📁 Checkpoint saved: ${checkpointFile}`));
}

// ANSI escape codes for terminal control
const ANSI = {
  SAVE_CURSOR: '\u001b[s',
  RESTORE_CURSOR: '\u001b[u',
  CLEAR_LINE: '\u001b[2K',
  MOVE_TO_TOP: '\u001b[1;1H',
  MOVE_TO_LINE_3: '\u001b[3;1H',
  HIDE_CURSOR: '\u001b[?25l',
  SHOW_CURSOR: '\u001b[?25h',
  CLEAR_SCREEN: '\u001b[2J'
};

let logLineCount = 0;

function initializeSplitScreen() {
  // Clear screen and hide cursor
  process.stdout.write(ANSI.CLEAR_SCREEN + ANSI.HIDE_CURSOR);
  // Reserve top 2 lines for progress bar
  process.stdout.write(ANSI.MOVE_TO_LINE_3);
  logLineCount = 3;
}

function updateStickyProgressBar(progressText: string) {
  // Save current cursor position
  process.stdout.write(ANSI.SAVE_CURSOR);

  // Move to top line and clear it
  process.stdout.write(ANSI.MOVE_TO_TOP + ANSI.CLEAR_LINE);

  // Write progress bar
  process.stdout.write(progressText);

  // Restore cursor to log area
  process.stdout.write(ANSI.RESTORE_CURSOR);
}

function logToBottomWithProgressUpdate(message: string, progress: ScraperProgress) {
  // Calculate games per second
  const elapsed = (Date.now() - new Date(progress.startTime).getTime()) / 1000;
  progress.gamesPerSecond = elapsed > 0 ? progress.processedGames / elapsed : 0;

  // Only log important messages
  if (progress.processedGames % 10 === 0 || message.includes('✅') || message.includes('📁') || message.includes('🎯')) {
    // Write to current log position
    process.stdout.write(message + '\n');
    logLineCount++;

    // If we've filled too many lines, scroll
    if (logLineCount > 50) {
      process.stdout.write('\n'.repeat(5));
      logLineCount = 8;
    }
  }
}

function updateProgressBar(progressBar: any, progress: ScraperProgress) {
  // Truncate long game names for display
  const displayName = progress.currentGameName && progress.currentGameName.length > 30
    ? progress.currentGameName.substring(0, 27) + '...'
    : progress.currentGameName || 'Unknown';

  const displayPlatform = progress.currentPlatform && progress.currentPlatform.length > 20
    ? progress.currentPlatform.substring(0, 17) + '...'
    : progress.currentPlatform || 'Unknown';

  // Create custom progress bar with ANSI colors
  const percentage = (progress.processedGames / progress.totalGames) * 100;
  const barLength = 40;
  const filledLength = Math.round((percentage / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

  // Calculate ETA
  const rate = progress.gamesPerSecond || 0;
  const remaining = progress.totalGames - progress.processedGames;
  const etaSeconds = rate > 0 ? remaining / rate : 0;
  const etaHours = Math.floor(etaSeconds / 3600);
  const etaMinutes = Math.floor((etaSeconds % 3600) / 60);
  const etaDisplay = etaHours > 0 ? `${etaHours}h${etaMinutes}m` : `${etaMinutes}m`;

  // Build the sticky progress bar text
  const progressText = chalk.cyan('🎮 ') +
    chalk.cyan(`[${bar}]`) +
    ` ${percentage.toFixed(1)}% | ${progress.processedGames.toLocaleString()}/${progress.totalGames.toLocaleString()} | ` +
    chalk.green(`✅ ${progress.successfulLogos}`) + ` ` +
    chalk.red(`❌ ${progress.failedLogos}`) + ` | ` +
    chalk.yellow(`🎯 ${displayPlatform}`) + ` | ` +
    chalk.magenta(`🎲 ${displayName}`) + ` | ` +
    chalk.blue(`⚡ ${rate.toFixed(1)}/s`) + ` | ` +
    chalk.white(`⏱️ ETA: ${etaDisplay}`);

  // Update the sticky progress bar at the top
  updateStickyProgressBar(progressText);
}

// Create chunked databases for immediate browser use
const indexDb = new sqlite3.Database('public/games-index.db');
const logoDb = new sqlite3.Database('public/logos-1.db');

// Initialize index database
indexDb.run(`CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  platform_name TEXT NOT NULL,
  has_logo INTEGER DEFAULT 0,
  logo_chunk INTEGER,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Initialize logo chunk database
logoDb.run(`CREATE TABLE IF NOT EXISTS logos (
  game_id INTEGER PRIMARY KEY,
  logo_base64 TEXT NOT NULL
)`);

// Simple approach - only use verified correct IDs

// Ultra-fast Clear Logo fetcher with aggressive timeouts
async function fetchClearLogoImproved(launchboxId: number, gameName: string): Promise<{logo: string | null, sourceUrl: string | null, error?: string}> {
  const maxRetries = 1; // Reduced retries for speed

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Minimal delay for retries
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const gamePageUrl = `https://gamesdb.launchbox-app.com/games/details/${launchboxId}`;

      const response = await fetch(gamePageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Connection': 'keep-alive'
        },
        signal: AbortSignal.timeout(3000) // Aggressive 3s timeout for speed
      });

    if (!response.ok) return { logo: null, sourceUrl: null, error: `HTTP ${response.status}` };

    const html = await response.text();

    // Look specifically for Clear Logo section with improved patterns
    const patterns = [
      // Pattern 1: Clear Logo heading followed by image
      /Clear Logo[^<]*<[\s\S]*?<img[^>]*src="([^"]+\.(?:png|jpg|jpeg|webp))"/i,

      // Pattern 2: Find "Clear Logo" text and then look for the next image
      /Clear Logo[\s\S]*?<img[^>]*src="([^"]+\.(?:png|jpg|jpeg|webp))"/i,

      // Pattern 3: Look for alt="Clear Logo" specifically
      /<img[^>]*alt="[^"]*Clear Logo[^"]*"[^>]*src="([^"]+)"/i,

      // Pattern 4: Look in a div or section containing "Clear Logo"
      /<[^>]*>Clear Logo<\/[^>]*>[\s\S]*?<img[^>]*src="([^"]+\.(?:png|jpg|jpeg|webp))"/i
    ];

    let logoUrl = null;
    let patternUsed = 0;

    for (let i = 0; i < patterns.length; i++) {
      const match = html.match(patterns[i]);
      if (match && match[1]) {
        logoUrl = match[1];
        patternUsed = i + 1;
        break;
      }
    }

    if (!logoUrl) {
      return { logo: null, sourceUrl: null, error: "No Clear Logo section found on page" };
    }

    // Make sure URL is absolute
    if (logoUrl.startsWith('//')) {
      logoUrl = 'https:' + logoUrl;
    } else if (logoUrl.startsWith('/')) {
      logoUrl = 'https://gamesdb.launchbox-app.com' + logoUrl;
    }

    console.log(`   📥 Downloading: ${logoUrl}`);

    // Fetch the actual logo with aggressive timeout
    const logoResponse = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) });
    if (!logoResponse.ok) {
      console.log(`   ❌ Failed to download logo: ${logoResponse.status}`);
      return { logo: null, sourceUrl: logoUrl };
    }

    const logoBuffer = await logoResponse.arrayBuffer();
    const sizeKB = Math.round(logoBuffer.byteLength / 1024);
    console.log(`   ✅ Downloaded: ${sizeKB}KB`);

    // Convert to base64
    const base64 = Buffer.from(logoBuffer).toString('base64');
    const contentType = logoResponse.headers.get('content-type') || 'image/png';
    const dataUrl = `data:${contentType};base64,${base64}`;

      return { logo: dataUrl, sourceUrl: logoUrl };

    } catch (error) {
      if (attempt === maxRetries) {
        return { logo: null, sourceUrl: null, error: error.message };
      }
    }
  }

  return { logo: null, sourceUrl: null, error: "Max retries exceeded" };
}

// Search LaunchBox website for correct ID
async function findLaunchBoxWebsiteId(gameName: string, platformName: string): Promise<number | null> {
  try {
    // Clean up game name for search (keep more characters but clean spacing)
    const cleanName = gameName
      .replace(/[™®©]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/:\s*/g, ':')  // Clean up colons
      .trim();

    // Search LaunchBox games database
    const searchUrl = `https://gamesdb.launchbox-app.com/games/search?query=${encodeURIComponent(cleanName)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Look for game links in search results
    // Format: /games/details/123-game-name
    const gameLinks = html.match(/\/games\/details\/(\d+)-[^"'\s>]+/g);

    if (!gameLinks || gameLinks.length === 0) {
      // Reduced logging for search failures
      // console.log(`   ❌ No games found in search results`);
      return null;
    }

    // Extract IDs from the links
    const foundIds: number[] = [];
    for (const link of gameLinks) {
      const idMatch = link.match(/\/games\/details\/(\d+)-/);
      if (idMatch) {
        foundIds.push(parseInt(idMatch[1]));
      }
    }

    if (foundIds.length === 0) {
      console.log(`   ❌ No valid IDs found in search results`);
      return null;
    }

    // For now, return the first found ID
    // In the future, we could verify by checking the actual game page
    const foundId = foundIds[0];
    console.log(`   ✅ Found potential ID: ${foundId} (from ${foundIds.length} results)`);

    return foundId;

  } catch (error) {
    console.log(`   ❌ Search error: ${error.message}`);
    return null;
  }
}

// Store logo in chunked format for immediate browser use
function storeLogo(gameId: number, name: string, platform: string, logoData: string, sourceUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Store in index database (mark as having logo in chunk 1)
    indexDb.run(
      'INSERT OR REPLACE INTO games (id, name, platform_name, has_logo, logo_chunk) VALUES (?, ?, ?, 1, 1)',
      [gameId, name, platform],
      (err) => {
        if (err) {
          resolve(false);
          return;
        }

        // Store actual logo data in chunk database
        logoDb.run(
          'INSERT OR REPLACE INTO logos (game_id, logo_base64) VALUES (?, ?)',
          [gameId, logoData],
          (err) => resolve(!err)
        );
      }
    );
  });
}

async function runImprovedScraper() {
  console.log(chalk.cyan('🚀 Starting improved Clear Logo scraper for ALL LaunchBox games...'));

  // Load or create progress
  progress = loadProgress();

  // Get all games from Supabase first
  console.log(chalk.yellow('📊 Loading all games from Supabase LaunchBox database...'));
  const { count: totalCount } = await supabase
    .from('games_database')
    .select('*', { count: 'exact', head: true });

  if (!totalCount) {
    console.log(chalk.red('❌ Failed to get total count from Supabase'));
    return;
  }

  console.log(chalk.green(`✅ Found ${totalCount.toLocaleString()} games in LaunchBox database`));

  // Update progress with actual total
  progress.totalGames = totalCount;

  // Initialize split screen interface
  console.log(chalk.cyan('🖥️ Initializing split screen interface...'));
  await new Promise(resolve => setTimeout(resolve, 2000)); // Brief pause to read
  initializeSplitScreen();

  // Set initial progress values
  progress.currentPlatform = 'Starting...';
  progress.currentGameName = 'Initializing...';

  // Show initial progress bar
  const dummyProgressBar = null; // We don't use cli-progress anymore
  updateProgressBar(dummyProgressBar, progress);

  const startIndex = progress.resumeFromGame || 0;
  console.log(chalk.cyan(`📍 Starting from game ${startIndex + 1}/${totalCount.toLocaleString()}`));

  console.log(chalk.yellow(`🎯 Processing ALL ${totalCount.toLocaleString()} games with platform prioritization`));

  // Define platform priority order (80s/90s classics first, niche/modern last)
  const platformPriority = [
    // Tier 1: Classic 80s/90s Arcade & Home Consoles (HIGHEST PRIORITY)
    'Arcade',
    'Nintendo Entertainment System',
    'Super Nintendo Entertainment System',
    'Sega Genesis',
    'Nintendo Game Boy',
    'Nintendo Game Boy Color',
    'Sega Master System',
    'Atari 2600',
    'Atari 7800',
    'Commodore 64',
    'Apple II',
    'Amiga',

    // Tier 2: Popular 90s/2000s Consoles
    'Sony Playstation',
    'Nintendo 64',
    'Sega Saturn',
    'Sega Dreamcast',
    'Nintendo Game Boy Advance',
    'Sony Playstation 2',
    'Nintendo GameCube',
    'Microsoft Xbox',

    // Tier 3: Modern Popular Consoles
    'Microsoft Xbox 360',
    'Sony Playstation 3',
    'Nintendo Wii',
    'Nintendo DS',
    'Sony PSP',
    'Microsoft Xbox One',
    'Sony Playstation 4',
    'Nintendo 3DS',
    'Nintendo Wii U',
    'Nintendo Switch',
    'Sony PS Vita',
    'Microsoft Xbox Series X',
    'Sony Playstation 5',
    'Windows',

    // Tier 4: Niche/Obscure Platforms (LOWEST PRIORITY)
    // Everything else will be processed last
  ];

  console.log(chalk.cyan(`🕹️  Platform priority: 80s/90s classics → Popular consoles → Modern → Niche`));

  // Get games organized by platform priority
  let allGamesByPriority: any[] = [];

  // Process high-priority platforms first
  for (const platform of platformPriority) {
    const { data: platformGames } = await supabase
      .from('games_database')
      .select('id, name, platform_name')
      .eq('platform_name', platform)
      .order('name');

    if (platformGames && platformGames.length > 0) {
      allGamesByPriority.push(...platformGames);
      console.log(chalk.green(`✅ Queued ${platformGames.length.toLocaleString()} games from ${platform}`));
    }
  }

  // Add remaining games from unlisted platforms (niche/obscure)
  const { data: remainingGames } = await supabase
    .from('games_database')
    .select('id, name, platform_name')
    .not('platform_name', 'in', `(${platformPriority.map(p => `"${p}"`).join(',')})`)
    .order('name');

  if (remainingGames && remainingGames.length > 0) {
    allGamesByPriority.push(...remainingGames);
    console.log(chalk.yellow(`📋 Queued ${remainingGames.length.toLocaleString()} games from niche/unlisted platforms`));
  }

  console.log(chalk.green(`🎮 Total games prioritized: ${allGamesByPriority.length.toLocaleString()}`));

  // Update progress with actual total
  progress.totalGames = allGamesByPriority.length;
  updateProgressBar(dummyProgressBar, progress);

  // Process games in larger batches for speed
  const BATCH_SIZE = 200;
  let processedTotal = 0;

  for (let offset = startIndex; offset < allGamesByPriority.length; offset += BATCH_SIZE) {
    // Get batch from prioritized games
    const gamesBatch = allGamesByPriority.slice(offset, offset + BATCH_SIZE);

    if (!gamesBatch || gamesBatch.length === 0) {
      console.log(chalk.yellow('⚠️ No more games found'));
      break;
    }

    // Process each game in the batch
    for (let i = 0; i < gamesBatch.length; i++) {
      const game = gamesBatch[i];
      const currentIndex = offset + i;

      // Update current game info
      progress.currentGameName = game.name;
      progress.currentPlatform = game.platform_name;
      progress.currentGameId = game.id;
      progress.lastUpdate = new Date().toISOString();

      // Check if logo already exists in index database
      const existingLogo = await new Promise<boolean>((resolve) => {
        indexDb.get('SELECT has_logo FROM games WHERE id = ? AND has_logo = 1', [game.id], (err, row) => {
          resolve(!!row);
        });
      });

      if (existingLogo) {
        logToBottomWithProgressUpdate(`⏭️  ${game.name} (${game.platform_name}) - already has logo`, progress);
        progress.successfulLogos++;
        progress.processedGames++;
        updateProgressBar(dummyProgressBar, progress);

        progress.resumeFromGame = currentIndex + 1;

        if (progress.processedGames % CHECKPOINT_INTERVAL === 0) {
          saveCheckpoint(progress);
        } else {
          saveProgress(progress);
        }
        continue;
      }

      // Try to find LaunchBox website ID using hybrid approach
      let launchboxId = null;

      // First check if we have a verified correct ID
      if (CORRECT_LAUNCHBOX_IDS[game.name]) {
        launchboxId = CORRECT_LAUNCHBOX_IDS[game.name];
        logToBottomWithProgressUpdate(`🎯 ${game.name} (${game.platform_name}) - Using verified ID ${launchboxId}`, progress);
      } else {
        // Try to search LaunchBox website for the correct ID
        logToBottomWithProgressUpdate(`🔍 ${game.name} (${game.platform_name}) - Searching LaunchBox database...`, progress);
        launchboxId = await findLaunchBoxWebsiteId(game.name, game.platform_name);
      }

      if (!launchboxId) {
        logToBottomWithProgressUpdate(`❌ ${game.name} (${game.platform_name}) - LaunchBox ID not found after search`, progress);
        progress.failedLogos++;
        progress.processedGames++;

        updateProgressBar(dummyProgressBar, progress);

        progress.resumeFromGame = currentIndex + 1;

        if (progress.processedGames % CHECKPOINT_INTERVAL === 0) {
          saveCheckpoint(progress);
        } else {
          saveProgress(progress);
        }

        // Minimal delay to avoid overwhelming search
        await new Promise(resolve => setTimeout(resolve, 200));
        continue;
      }

      // Try to fetch Clear Logo
      logToBottomWithProgressUpdate(`🌐 ${game.name} (${game.platform_name}) - Fetching from LaunchBox ID ${launchboxId}...`, progress);
      const { logo, sourceUrl, error } = await fetchClearLogoImproved(launchboxId, game.name);

      if (logo && sourceUrl) {
        const logoSizeKB = Math.round((logo.split(',')[1]?.length || 0) * 0.75 / 1024);
        logToBottomWithProgressUpdate(`💾 ${game.name} (${game.platform_name}) - Storing ${logoSizeKB}KB logo...`, progress);
        const stored = await storeLogo(game.id, game.name, game.platform_name, logo, sourceUrl);
        if (stored) {
          logToBottomWithProgressUpdate(`✅ ${game.name} (${game.platform_name}) - Clear Logo found & stored (${logoSizeKB}KB)`, progress);
          progress.successfulLogos++;
          progress.recentSuccesses.unshift({
            gameId: game.id,
            gameName: game.name,
            platform: game.platform_name,
            timestamp: new Date().toISOString()
          });
          progress.recentSuccesses = progress.recentSuccesses.slice(0, 5);
        } else {
          logToBottomWithProgressUpdate(`❌ ${game.name} (${game.platform_name}) - Logo found but storage failed`, progress);
          progress.failedLogos++;
        }
      } else {
        const errorDetail = error ? ` (${error})` : '';
        logToBottomWithProgressUpdate(`❌ ${game.name} (${game.platform_name}) - No Clear Logo found${errorDetail}`, progress);
        progress.failedLogos++;
      }

      progress.processedGames++;
      progress.resumeFromGame = currentIndex + 1;

      updateProgressBar(progressBar, progress);

      // Checkpoint regularly
      if (progress.processedGames % CHECKPOINT_INTERVAL === 0) {
        saveCheckpoint(progress);
      } else {
        saveProgress(progress);
      }

      // Show periodic summary to reduce clutter
      if (progress.processedGames % 100 === 0) {
        console.log(chalk.blue(`🎯 Progress Summary: ${progress.successfulLogos} logos found from ${progress.processedGames} games processed (${((progress.successfulLogos/progress.processedGames)*100).toFixed(1)}% success rate)`));
      }

      // Fast but respectful delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Final results
  progress.status = 'completed';
  progress.lastUpdate = new Date().toISOString();
  saveProgress(progress);

  // Clear split screen and restore normal terminal
  process.stdout.write(ANSI.CLEAR_SCREEN + ANSI.SHOW_CURSOR + ANSI.MOVE_TO_TOP);

  console.log(chalk.green('\n📊 Final Results:'));
  console.log(chalk.cyan('────────────────────────────────────────────────────────────────────────────────'));
  console.log(`${chalk.green('✅ Successful:')} ${progress.successfulLogos}`);
  console.log(`${chalk.red('❌ Failed:')} ${progress.failedLogos}`);
  console.log(`${chalk.blue('📊 Total processed:')} ${progress.processedGames}`);
  console.log(`${chalk.yellow('⚡ Average rate:')} ${progress.gamesPerSecond?.toFixed(2) || '0'}/s`);

  if (progress.recentSuccesses.length > 0) {
    console.log(chalk.cyan('\n🎯 Recent successes:'));
    progress.recentSuccesses.forEach(success => {
      console.log(`   ✅ ${success.gameName} (${success.platform})`);
    });
  }

  console.log(chalk.cyan('\n🎯 Logos available immediately in /games - no splitting needed!'));
  indexDb.close();
  logoDb.close();

  // Restore cursor on exit
  process.on('exit', () => {
    process.stdout.write(ANSI.SHOW_CURSOR);
  });
  process.on('SIGINT', () => {
    process.stdout.write(ANSI.SHOW_CURSOR + '\n');
    process.exit(0);
  });
}

runImprovedScraper().catch(console.error);