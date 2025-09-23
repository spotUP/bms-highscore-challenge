#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import sqlite3 from 'sqlite3';
import { writeFileSync, readFileSync, existsSync } from 'fs';
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
        console.log('✅ SQLite database initialized');
        resolve(db);
      });
    });
  });
}

// Fetch logo from LaunchBox (using working method from production-logo-scraper.ts)
async function fetchClearLogoByGameId(gameId: number, gameName: string): Promise<string | null> {
  try {
    await new Promise(resolve => setTimeout(resolve, 150)); // Rate limiting

    const gamePageUrl = `https://gamesdb.launchbox-app.com/games/details/${gameId}`;

    const gamePageResponse = await fetch(gamePageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!gamePageResponse.ok) {
      return null;
    }

    const gamePageHtml = await gamePageResponse.text();

    // Extract the "Clear Logo" section and find images within it
    const clearLogoSectionMatch = gamePageHtml.match(/Clear Logo<\/h3>([\s\S]*?)(?=<h3|$)/i);

    if (!clearLogoSectionMatch) {
      return null;
    }

    const clearLogoSection = clearLogoSectionMatch[1];
    const imageMatches = [...clearLogoSection.matchAll(/<img[^>]*src="([^"]*\.(?:png|jpg|jpeg))"/gi)];

    if (imageMatches.length === 0) {
      return null;
    }

    // Take the first image (typically the best quality)
    let logoUrl = imageMatches[0][1];

    // Ensure it's a full URL
    if (logoUrl && !logoUrl.startsWith('http')) {
      logoUrl = logoUrl.startsWith('//') ? `https:${logoUrl}` : `https://gamesdb.launchbox-app.com${logoUrl}`;
    }

    // Download and convert the logo to base64
    const logoResponse = await fetch(logoUrl, {
      signal: AbortSignal.timeout(6000)
    });

    if (!logoResponse.ok) {
      return null;
    }

    const logoBuffer = await logoResponse.arrayBuffer();
    const mimeType = logoResponse.headers.get('content-type') || 'image/png';
    const logoBase64 = Buffer.from(logoBuffer).toString('base64');

    return `data:${mimeType};base64,${logoBase64}`;

  } catch (error) {
    console.log(`⚠️  Error fetching logo for ${gameName}: ${error}`);
    return null;
  }
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
          console.error(`❌ Failed to store logo for ${name}:`, err);
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

// Get games from Supabase with platform-aware batching
async function getGamesToProcess(lastProcessedId: number, batchSize: number): Promise<any[]> {
  try {
    // Try to get games from priority platforms first
    const priorityPlatforms = Object.keys(PLATFORM_PRIORITY)
      .filter(p => p !== 'DEFAULT')
      .slice(0, 15); // Top 15 priority platforms

    // First, try to get games from popular platforms
    for (const platform of priorityPlatforms) {
      const { data: priorityGames, error: priorityError } = await supabase
        .from('games_database')
        .select('id, name, platform_name, launchbox_id')
        .gt('id', lastProcessedId)
        .eq('platform_name', platform)
        .order('id')
        .limit(Math.ceil(batchSize / 3)); // Smaller batches per platform

      if (!priorityError && priorityGames && priorityGames.length > 0) {
        console.log(`🎮 Prioritizing ${priorityGames.length} games from ${platform}`);
        return priorityGames;
      }
    }

    // If no priority platform games found, fall back to regular query
    const { data: games, error } = await supabase
      .from('games_database')
      .select('id, name, platform_name, launchbox_id')
      .gt('id', lastProcessedId)
      .order('id')
      .limit(batchSize);

    if (error) {
      console.error('❌ Error fetching games from Supabase:', error);
      return [];
    }

    return games || [];
  } catch (error) {
    console.error('❌ Error:', error);
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
      console.log(`🔄 Resuming from checkpoint ${latestCheckpointNumber} (${checkpointData['0']?.processedGames || 0} games processed)`);
      return checkpointData['0'] || defaultProgress;
    } catch (error) {
      console.log(`⚠️  Failed to load checkpoint ${latestCheckpoint}, falling back to regular progress`);
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
  console.log(`📋 Checkpoint ${checkpointNumber} saved at ${progress.processedGames} games`);
}

// Get current SQLite stats
function getSQLiteStats(db: sqlite3.Database): Promise<{total: number, withLogos: number}> {
  return new Promise((resolve) => {
    db.get('SELECT COUNT(*) as total, COUNT(logo_base64) as withLogos FROM games', (err, row: any) => {
      if (err) {
        console.error('Error getting SQLite stats:', err);
        resolve({total: 0, withLogos: 0});
      } else {
        resolve({total: row.total, withLogos: row.withLogos});
      }
    });
  });
}

async function runHybridScraper() {
  console.log('🎮 Starting Hybrid Logo Scraper');
  console.log('📊 Querying games from Supabase → Storing logos in SQLite');

  const db = await initializeDatabase();
  let progress = loadProgress();

  const stats = await getSQLiteStats(db);
  progress.processedGames = stats.total;
  progress.successfulLogos = stats.withLogos;

  console.log(`📈 Current progress: ${progress.successfulLogos}/${progress.totalGames} logos`);

  const BATCH_SIZE = 30;
  const DELAY_BETWEEN_BATCHES = 250;
  let lastProcessedId = progress.currentGameId || 0;

  while (true) {
    try {
      // Get games from Supabase
      const games = await getGamesToProcess(lastProcessedId, BATCH_SIZE);

      if (games.length === 0) {
        console.log('🎯 No more games to process');
        progress.status = 'completed';
        saveProgress(progress);
        break;
      }

      console.log(`\n🔄 Processing batch of ${games.length} games with 5 concurrent workers...`);

      // Process games in chunks of 5 concurrently
      const CONCURRENCY = 5;
      for (let i = 0; i < games.length; i += CONCURRENCY) {
        const chunk = games.slice(i, i + CONCURRENCY);

        const results = await Promise.allSettled(
          chunk.map(async (game) => {
            // Use launchbox_id if available, otherwise use our ID
            const searchId = game.launchbox_id || game.id;

            console.log(`Processing: ${game.name} (ID: ${game.id})`);

            // Try to fetch logo
            const logoData = await fetchClearLogoByGameId(searchId, game.name);

            if (logoData) {
              // Store in SQLite
              const stored = await storeLogoInSQLite(db, game.id, game.name, game.platform_name, logoData);
              if (stored) {
                console.log(`✅ Logo saved for ${game.name}`);
                return { success: true, game, logoData };
              } else {
                return { success: false, game, error: 'Failed to store' };
              }
            } else {
              console.log(`⚠️  No logo found for ${game.name}`);
              // Still store the game record without logo
              await storeLogoInSQLite(db, game.id, game.name, game.platform_name, '');
              return { success: false, game, error: 'No logo found' };
            }
          })
        );

        // Process results
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const game = chunk[j];

          progress.currentGameId = game.id;
          progress.currentGameName = game.name;
          progress.currentPlatform = game.platform_name;
          progress.lastUpdate = new Date().toISOString();

          if (result.status === 'fulfilled' && result.value.success) {
            progress.successfulLogos++;
            progress.recentSuccesses.unshift({
              gameId: game.id,
              gameName: game.name,
              platform: game.platform_name,
              timestamp: new Date().toISOString()
            });

            // Keep only last 5 successes
            progress.recentSuccesses = progress.recentSuccesses.slice(0, 5);
          } else {
            progress.failedLogos++;
          }

          progress.processedGames++;
          lastProcessedId = game.id;
        }
      }

      // Calculate games per second
      const elapsed = (Date.now() - new Date(progress.startTime).getTime()) / 1000;
      progress.gamesPerSecond = elapsed > 0 ? Math.round((progress.processedGames / elapsed) * 100) / 100 : 0;

      // Save progress
      saveProgress(progress);

      // Save checkpoint every 100 games
      if (progress.processedGames % 100 === 0) {
        const checkpointNumber = Math.floor(progress.processedGames / 100);
        saveCheckpoint(progress, checkpointNumber);
      }

      console.log(`📊 Progress: ${progress.successfulLogos}/${progress.totalGames} logos (${Math.round((progress.successfulLogos / progress.totalGames) * 100)}%)`);

      // Wait between batches
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));

    } catch (error) {
      console.error('❌ Batch processing error:', error);
      progress.errors.push(String(error));
      saveProgress(progress);

      // Wait longer on error
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  db.close();
  console.log('🎯 Hybrid scraper completed');
}

runHybridScraper().catch(console.error);