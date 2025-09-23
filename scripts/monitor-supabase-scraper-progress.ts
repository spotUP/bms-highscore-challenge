#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

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

const PROGRESS_FILE = 'production-turbo-progress.json';
const PUBLIC_PROGRESS_FILE = 'public/production-scraper-progress.json';

let startTime = new Date().toISOString();
let lastProcessedCount = 0;
let lastUpdateTime = Date.now();

async function getSupabaseScraperProgress(): Promise<ScraperProgress> {
  try {
    // Get total games count
    const { count: totalGames } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true });

    // Get processed games count (with logos)
    const { count: processedGames } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true })
      .not('logo_base64', 'is', null);

    // Get recent successful logo additions
    const { data: recentGames } = await supabase
      .from('games_database')
      .select('id, name, platform_name, updated_at')
      .not('logo_base64', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(5);

    // Get the most recent game being processed
    const mostRecentGame = recentGames?.[0];

    // Calculate games per second
    const currentTime = Date.now();
    const timeDiffSeconds = (currentTime - lastUpdateTime) / 1000;
    const gamesDiff = (processedGames || 0) - lastProcessedCount;
    const gamesPerSecond = timeDiffSeconds > 0 ? gamesDiff / timeDiffSeconds : 0;

    // Update tracking variables
    lastProcessedCount = processedGames || 0;
    lastUpdateTime = currentTime;

    // Format recent successes
    const recentSuccesses = (recentGames || []).map(game => ({
      gameId: game.id,
      gameName: game.name,
      platform: game.platform_name,
      timestamp: game.updated_at || new Date().toISOString()
    }));

    const progress: ScraperProgress = {
      instanceId: 0,
      totalGames: totalGames || 169556,
      processedGames: processedGames || 0,
      successfulLogos: processedGames || 0,
      failedLogos: 0, // We don't track failures in Supabase
      currentGameId: mostRecentGame?.id || null,
      currentGameName: mostRecentGame?.name || null,
      currentPlatform: mostRecentGame?.platform_name || null,
      lastUpdate: new Date().toISOString(),
      status: 'running',
      errors: [],
      recentSuccesses,
      startTime,
      gamesPerSecond: Math.round(gamesPerSecond * 100) / 100
    };

    return progress;

  } catch (error) {
    console.error('Error getting Supabase scraper progress:', error);

    return {
      instanceId: 0,
      totalGames: 169556,
      processedGames: 0,
      successfulLogos: 0,
      failedLogos: 0,
      currentGameId: null,
      currentGameName: null,
      currentPlatform: null,
      lastUpdate: new Date().toISOString(),
      status: 'error',
      errors: [String(error)],
      recentSuccesses: [],
      startTime,
      gamesPerSecond: 0
    };
  }
}

async function updateProgressFiles() {
  try {
    const progress = await getSupabaseScraperProgress();

    // Wrap in the expected format
    const progressData = {
      "0": progress
    };

    // Write to both files
    writeFileSync(PROGRESS_FILE, JSON.stringify(progressData, null, 2));
    writeFileSync(PUBLIC_PROGRESS_FILE, JSON.stringify(progressData, null, 2));

    console.log(`✅ Updated progress: ${progress.processedGames}/${progress.totalGames} games (${Math.round((progress.processedGames / progress.totalGames) * 100)}%)`);

  } catch (error) {
    console.error('❌ Failed to update progress files:', error);
  }
}

async function runMonitor() {
  console.log('🔄 Starting Supabase scraper progress monitor...');
  console.log('📊 Monitoring real logo scraper progress from Supabase');

  // Update immediately
  await updateProgressFiles();

  // Update every 5 seconds
  setInterval(updateProgressFiles, 5000);
}

runMonitor().catch(console.error);