#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import sqlite3 from 'sqlite3';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import cliProgress from 'cli-progress';
import chalk from 'chalk';
import 'dotenv/config';

// Supabase setup
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// SQLite setup
const DB_FILE = 'production-turbo-logos.db';
const PROGRESS_FILE = 'production-turbo-progress.json';

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
}

// Initialize SQLite database
function initializeDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_FILE, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Create table if it doesn't exist
      db.run(`CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        platform_name TEXT NOT NULL,
        logo_base64 TEXT,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(db);
      });
    });
  });
}

// Fetch logo from LaunchBox with optimized timeout handling and retry logic
async function fetchClearLogoByGameId(gameId: number, gameName: string): Promise<string | null> {
  const maxRetries = 2; // Reduced from 3 to 2

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Exponential backoff: 150ms, 300ms
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, attempt * 150));
      }

      const gamePageUrl = `https://gamesdb.launchbox-app.com/games/details/${gameId}`;

      const gamePageResponse = await fetch(gamePageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none'
        },
        signal: AbortSignal.timeout(15000) // 15 second timeout for faster failures
      });

      if (!gamePageResponse.ok) {
        if (gamePageResponse.status === 429) {
          // Rate limited - wait longer before retry
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        continue;
      }

      const gamePageHtml = await gamePageResponse.text();

      // Extract the "Clear Logo" section and find images within it
      const clearLogoSectionMatch = gamePageHtml.match(/Clear Logo<\/h3>([\s\S]*?)(?=<h3|$)/i);

      if (!clearLogoSectionMatch) {
        continue;
      }

      const clearLogoSection = clearLogoSectionMatch[1];
      const imageMatches = [...clearLogoSection.matchAll(/<img[^>]*src="([^"]*\.(?:png|jpg|jpeg))"/gi)];

      if (imageMatches.length === 0) {
        continue;
      }

      // Take the first image (typically the best quality)
      let logoUrl = imageMatches[0][1];

      // Ensure it's a full URL
      if (logoUrl && !logoUrl.startsWith('http')) {
        logoUrl = logoUrl.startsWith('//') ? `https:${logoUrl}` : `https://gamesdb.launchbox-app.com${logoUrl}`;
      }

      // Download and convert the logo to base64
      const logoResponse = await fetch(logoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout for image download
      });

      if (!logoResponse.ok) {
        continue;
      }

      const logoBuffer = await logoResponse.arrayBuffer();
      const mimeType = logoResponse.headers.get('content-type') || 'image/png';
      const logoBase64 = Buffer.from(logoBuffer).toString('base64');

      return `data:${mimeType};base64,${logoBase64}`;

    } catch (error) {
      // Silent retry
    }
  }

  return null; // All attempts failed
}

// Store logo in SQLite
function storeLogoInSQLite(db: sqlite3.Database, gameId: number, name: string, platform: string, logoData: string): Promise<boolean> {
  return new Promise((resolve) => {
    // First, insert or update the game record
    db.run(
      'INSERT OR REPLACE INTO games (id, name, platform_name, logo_base64, processed_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [gameId, name, platform, logoData],
      function(err) {
        if (err) {
          resolve(false);
        } else {
          resolve(true);
        }
      }
    );
  });
}

// Define platform priority order (most popular gaming platforms first)
const PLATFORM_PRIORITY = {
  // Modern consoles
  'Windows': 1,
  'Sony Playstation 4': 2,
  'Microsoft Xbox One': 3,
  'Nintendo Switch': 4,
  'Sony Playstation 5': 5,
  'Microsoft Xbox Series X': 6,

  // Previous generation
  'Sony Playstation 3': 10,
  'Microsoft Xbox 360': 11,
  'Nintendo Wii': 12,
  'Nintendo DS': 13,
  'Sony PSP': 14,
  'Nintendo 3DS': 15,

  // Classic consoles
  'Sony Playstation 2': 20,
  'Sony Playstation': 21,
  'Microsoft Xbox': 22,
  'Nintendo GameCube': 23,
  'Nintendo 64': 24,
  'Super Nintendo Entertainment System': 25,
  'Nintendo Entertainment System': 26,
  'Sega Genesis': 27,
  'Sega Dreamcast': 28,

  // Handhelds
  'Nintendo Game Boy Advance': 30,
  'Nintendo Game Boy Color': 31,
  'Nintendo Game Boy': 32,
  'Sega Game Gear': 33,

  // PC Platforms
  'MS-DOS': 40,
  'Steam': 41,

  // Default for unlisted platforms
  'DEFAULT': 1000
};

// Excluded niche platforms - will be processed after mainstream platforms are complete
const EXCLUDED_PLATFORMS = [
  // Obscure/Regional Computers
  'Aamber Pegasus',
  'APF Imagination Machine',
  'Apogee BK-01',
  'Acorn Archimedes',
  'Acorn Atom',
  'Acorn Electron',
  'BBC Microcomputer System',
  'Camputers Lynx',
  'Dragon 32/64',
  'EACA EG2000 Colour Genie',
  'Elektronika BK',
  'Enterprise',
  'Exidy Sorcerer',
  'Hector HRX',
  'Jupiter Ace',
  'Matra and Hachette Alice',
  'Memotech MTX512',
  'Oric Atmos',
  'SAM Coupé',
  'Sinclair ZX-81',
  'Sord M5',
  'Tandy TRS-80',
  'TRS-80 Color Computer',
  'Texas Instruments TI 99/4A',
  'Tomy Tutor',
  'Vector-06C',

  // Rare/Failed Consoles
  'Bandai Super Vision 8000',
  'Casio Loopy',
  'Casio PV-1000',
  'Coleco ADAM',
  'Emerson Arcadia 2001',
  'Entex Adventure Vision',
  'Epoch Game Pocket Computer',
  'Epoch Super Cassette Vision',
  'Exelvision EXL 100',
  'Fairchild Channel F',
  'Funtech Super Acan',
  'Game Wave Family Entertainment System',
  'GameWave',
  'Hartung Game Master',
  'Magnavox Odyssey',
  'Magnavox Odyssey 2',
  'Mattel Aquarius',
  'Mattel HyperScan',
  'Mega Duck',
  'Nintendo Pokemon Mini',
  'Nokia N-Gage',
  'Nuon',
  'Othello Multivision',
  'Ouya',
  'Philips CD-i',
  'RCA Studio II',
  'Sega Pico',
  'Tapwave Zodiac',
  'Tiger Game.com',
  'VTech CreatiVision',
  'VTech Socrates',
  'VTech V.Smile',
  'Watara Supervision',
  'WoW Action Max',
  'XaviXPORT',

  // Specialty/Modern Niche
  'Arduboy',
  'MUGEN',
  'OpenBOR',
  'PICO-8',
  'ScummVM',
  'WASM-4',
  'Uzebox',
  'ZiNc'
];

// Get games from Supabase with platform-aware batching
async function getGamesToProcess(lastProcessedId: number, batchSize: number): Promise<any[]> {
  try {

    // Try to get games from priority platforms first
    const priorityPlatforms = Object.keys(PLATFORM_PRIORITY)
      .filter(p => p !== 'DEFAULT')
      .slice(0, 15); // Top 15 priority platforms

    // First, try to get games from popular platforms (excluding niche platforms)
    for (const platform of priorityPlatforms) {
      if (EXCLUDED_PLATFORMS.includes(platform)) {
        continue; // Skip excluded platforms
      }

      const { data: priorityGames, error: priorityError } = await supabase
        .from('games_database')
        .select('id, name, platform_name, launchbox_id')
        .gt('id', lastProcessedId)
        .eq('platform_name', platform)
        .order('id')
        .limit(Math.ceil(batchSize / 3)); // Smaller batches per platform

      if (!priorityError && priorityGames && priorityGames.length > 0) {
        // Add platform info to games for progress display
        priorityGames.forEach(game => game.currentPlatformBatch = platform);
        return priorityGames;
      }
    }

    // If no priority platform games found, fall back to regular query (excluding niche platforms)
    const { data: games, error } = await supabase
      .from('games_database')
      .select('id, name, platform_name, launchbox_id')
      .gt('id', lastProcessedId)
      .not('platform_name', 'in', `(${EXCLUDED_PLATFORMS.map(p => `"${p}"`).join(',')})`)
      .order('id')
      .limit(batchSize);

    if (error) {
      logToBottom('❌ Error fetching games from Supabase: ' + error);
      return [];
    }

    return games || [];
  } catch (error) {
    logToBottom('❌ Error: ' + error);
    return [];
  }
}

// Load progress from checkpoint or regular progress file
function loadProgress(): ScraperProgress {
  const defaultProgress: ScraperProgress = {
    instanceId: 0,
    totalGames: 169556, // Supabase total
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
    gamesPerSecond: 0
  };

  // First try to load from the most recent checkpoint
  let latestCheckpoint = null;
  let latestCheckpointNumber = 0;

  for (let i = 1; i <= 2000; i++) { // Check up to checkpoint 2000 (200,000 games)
    const checkpointFile = `hybrid-checkpoint-${i}.json`;
    if (existsSync(checkpointFile)) {
      latestCheckpointNumber = i;
      latestCheckpoint = checkpointFile;
    }
  }

  if (latestCheckpoint) {
    try {
      const checkpointData = JSON.parse(readFileSync(latestCheckpoint, 'utf8'));
      return checkpointData['0'] || defaultProgress;
    } catch (error) {
      logToBottom(`⚠️  Failed to load checkpoint ${latestCheckpoint}, falling back to regular progress`);
    }
  }

  // Fall back to regular progress file
  if (!existsSync(PROGRESS_FILE)) {
    return defaultProgress;
  }

  try {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
    return data['0'] || defaultProgress;
  } catch {
    return defaultProgress;
  }
}

// Save progress
function saveProgress(progress: ScraperProgress) {
  const data = { "0": progress };
  writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
  writeFileSync('public/production-scraper-progress.json', JSON.stringify(data, null, 2));
  // Also update the main production-scraper-progress.json that the frontend reads
  writeFileSync('production-scraper-progress.json', JSON.stringify(data, null, 2));
}

// Save checkpoint every 100 games
function saveCheckpoint(progress: ScraperProgress, checkpointNumber: number) {
  const checkpointFile = `hybrid-checkpoint-${checkpointNumber}.json`;
  const data = {
    "0": progress,
    "checkpoint": checkpointNumber,
    "timestamp": new Date().toISOString()
  };
  writeFileSync(checkpointFile, JSON.stringify(data, null, 2));
}

// Get current SQLite stats
function getSQLiteStats(db: sqlite3.Database): Promise<{total: number, withLogos: number}> {
  return new Promise((resolve) => {
    db.get('SELECT COUNT(*) as total, COUNT(logo_base64) as withLogos FROM games', (err, row: any) => {
      if (err) {
        logToBottom('Error getting SQLite stats: ' + err);
        resolve({total: 0, withLogos: 0});
      } else {
        resolve({total: row.total, withLogos: row.withLogos});
      }
    });
  });
}

// Progress bar setup
let mainProgressBar: any = null;
let batchProgressBar: any = null;
let lastProgressUpdate = 0;

function initProgressBars(totalGames: number, currentGames: number) {
  // Hide cursor and setup split screen
  process.stdout.write('\x1b[?25l'); // Hide cursor
  console.clear();

  // Reserve just 2 lines for progress display (super compact)
  process.stdout.write('\n'); // Progress bar will go here
  process.stdout.write('─'.repeat(process.stdout.columns || 80) + '\n'); // Separator line

  // Set scrolling region to only allow scrolling from line 3 onwards
  // This protects lines 1-2 (progress bar and separator) from scrolling
  process.stdout.write('\x1b[3;r'); // Set scrolling region from line 3 to end

  return null;
}

// Helper function for logging that preserves the split screen
function logToBottom(message: string) {
  // Move to the bottom of the scrolling area and add the message
  // The scrolling region is already set to protect lines 1-2
  process.stdout.write('\x1b[999;1H'); // Move to bottom of scrolling region
  process.stdout.write(message + '\n'); // Write message with newline
}

// Enhanced logging function that also triggers progress update
function logToBottomWithProgressUpdate(message: string, progress: any) {
  logToBottom(message);
  // Update progress bar immediately after each log message for real-time updates
  updateProgress(progress);
}

function formatETA(seconds: number): string {
  if (seconds === Infinity || isNaN(seconds)) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function drawProgressBar(current: number, total: number, width: number = 40): string {
  const percentage = Math.min(current / total, 1);
  const filled = Math.round(width * percentage);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return bar;
}

function updateProgress(progress: any, platform: string = '') {
  const percentage = Math.round((progress.processedGames / progress.totalGames) * 100);
  const bar = drawProgressBar(progress.processedGames, progress.totalGames, 30); // Shorter bar to fit more info

  const remaining = progress.totalGames - progress.processedGames;
  const etaSeconds = remaining / (progress.gamesPerSecond || 1);
  const etaFormatted = formatETA(etaSeconds);

  // Compact all info into one line
  const compactInfo = `${bar} ${percentage}% | ${chalk.green(progress.successfulLogos)} ✓ | ${chalk.red(progress.failedLogos)} ✗ | ETA: ${etaFormatted} | ${progress.gamesPerSecond}/s`;

  // Temporarily disable scrolling region to update progress bar
  process.stdout.write('\x1b[r'); // Reset scrolling region to full screen

  // Update progress bar at line 1 (compact single line)
  process.stdout.write('\x1b[1;1H'); // Move to line 1, column 1
  process.stdout.write('\x1b[K'); // Clear line
  process.stdout.write(compactInfo);

  // Re-enable scrolling region to protect lines 1-2
  process.stdout.write('\x1b[3;r'); // Set scrolling region from line 3 to end
}

async function runHybridScraper() {

  const db = await initializeDatabase();
  let progress = loadProgress();

  const stats = await getSQLiteStats(db);
  progress.processedGames = stats.total;
  progress.successfulLogos = stats.withLogos;


  // Initialize progress bars
  const multibar = initProgressBars(progress.totalGames, progress.processedGames);

  // Position cursor in the logging area
  process.stdout.write('\x1b[3;1H'); // Move to line 3 (after separator)

  // Check if we've completed the high range and need to process the low range
  const maxProcessedId = await new Promise<number>((resolve) => {
    db.get('SELECT MAX(id) as maxId FROM games', (err, row: any) => {
      if (err) {
        logToBottom('Error getting max ID from SQLite: ' + err);
        resolve(0);
      } else {
        resolve(row?.maxId || 0);
      }
    });
  });

  const minProcessedId = await new Promise<number>((resolve) => {
    db.get('SELECT MIN(id) as minId FROM games', (err, row: any) => {
      if (err) {
        logToBottom('Error getting min ID from SQLite: ' + err);
        resolve(0);
      } else {
        resolve(row?.minId || 0);
      }
    });
  });

  // Check if we have a gap between min processed and the start of the Supabase range
  // If minProcessedId is 40291 but Supabase starts at -49999, we need to fill the gap
  let startFromId = progress.currentGameId || 0;

  // Check for large gaps in processing

  // Special case: If we have processed some games but not the majority, there's likely a gap in the middle
  // We have 45,238 out of 169,556 total games, which means there's a big gap somewhere
  const hasGap = stats.total > 0 && stats.total < 100000;

  if (hasGap) {

    // Get the actual minimum ID from Supabase to start from the very beginning
    const { data: minSupabaseGame, error: minError } = await supabase
      .from('games_database')
      .select('id')
      .order('id', { ascending: true })
      .limit(1);

    if (!minError && minSupabaseGame && minSupabaseGame[0]) {
      startFromId = minSupabaseGame[0].id - 1; // Start from before the lowest ID
    }
  } else {
    startFromId = Math.max(progress.currentGameId || 0, maxProcessedId);
  }

  const BATCH_SIZE = 20; // Increased batch size for faster processing
  const DELAY_BETWEEN_BATCHES = 800; // 0.8 seconds between batches for better throughput
  let lastProcessedId = startFromId;


  while (true) {
    try {
      // Get games from Supabase
      const games = await getGamesToProcess(lastProcessedId, BATCH_SIZE);

      if (games.length === 0) {
        logToBottom('🎯 No more games to process');
        progress.status = 'completed';
        saveProgress(progress);
        break;
      }


      // Process games ONE BY ONE (no concurrency) to avoid overwhelming the server
      for (let i = 0; i < games.length; i++) {
        const game = games[i];

        // Use launchbox_id if available, otherwise use our ID
        const searchId = game.launchbox_id || game.id;


        // Update current progress
        progress.currentGameId = game.id;
        progress.currentGameName = game.name;
        progress.currentPlatform = game.platform_name;
        progress.lastUpdate = new Date().toISOString();

        try {
          // Try to fetch logo
          const logoData = await fetchClearLogoByGameId(searchId, game.name);

          if (logoData) {
            // Store in SQLite
            const stored = await storeLogoInSQLite(db, game.id, game.name, game.platform_name, logoData);
            if (stored) {
              progress.successfulLogos++;
              progress.recentSuccesses.unshift({
                gameId: game.id,
                gameName: game.name,
                platform: game.platform_name,
                timestamp: new Date().toISOString()
              });

              // Keep only last 5 successes
              progress.recentSuccesses = progress.recentSuccesses.slice(0, 5);
              logToBottomWithProgressUpdate(`✅ ${game.name}`, progress);
            } else {
              progress.failedLogos++;
            }
          } else {
            // Still store the game record without logo
            await storeLogoInSQLite(db, game.id, game.name, game.platform_name, '');
            progress.failedLogos++;
            logToBottomWithProgressUpdate(`❌ ${game.name} (no logo found)`, progress);
          }

        } catch (error) {
          progress.failedLogos++;
        }

        progress.processedGames++;
        lastProcessedId = game.id;

        // Small delay between games to be respectful to LaunchBox
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // Calculate games per second
      const elapsed = (Date.now() - new Date(progress.startTime).getTime()) / 1000;
      progress.gamesPerSecond = elapsed > 0 ? Math.round((progress.processedGames / elapsed) * 100) / 100 : 0;

      // Progress bar is now updated immediately with each log message via logToBottomWithProgressUpdate()

      // Save progress
      saveProgress(progress);

      // Save checkpoint every 100 games
      if (progress.processedGames % 100 === 0) {
        const checkpointNumber = Math.floor(progress.processedGames / 100);
        saveCheckpoint(progress, checkpointNumber);
      }

      // Wait between batches
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));

    } catch (error) {
      logToBottom('❌ Batch processing error: ' + error);
      progress.errors.push(String(error));
      saveProgress(progress);

      // Shorter wait on error for speed
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  db.close();

  // Show cursor again and add final newline
  process.stdout.write('\x1b[?25h'); // Show cursor
  console.log(); // Final newline

  console.log(chalk.green.bold('🎯 Hybrid scraper completed successfully!'));
  console.log(chalk.cyan(`✅ Total processed: ${chalk.yellow(progress.processedGames)} games`));
  console.log(chalk.cyan(`🖼️  Successful logos: ${chalk.green(progress.successfulLogos)}`));
  console.log(chalk.cyan(`❌ Failed logos: ${chalk.red(progress.failedLogos)}`));
  console.log(chalk.cyan(`⚡ Average speed: ${chalk.yellow(progress.gamesPerSecond + '/s')}`));
}

runHybridScraper().catch(console.error);