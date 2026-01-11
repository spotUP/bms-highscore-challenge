#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
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
  recentSuccesses?: Array<{
    gameId: number;
    gameName: string;
    platform: string;
    timestamp: string;
  }>;
  lastSuccessCount?: number;
}

async function monitorSuccessNotifications() {
  const PROGRESS_FILE = 'production-scraper-progress.json';

  console.log('🔔 Starting success notification monitor...');

  while (true) {
    try {
      if (!existsSync(PROGRESS_FILE)) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      const progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
      let updated = false;

      for (const [instanceId, instanceProgress] of Object.entries(progress)) {
        const instance = instanceProgress as ScraperProgress;

        // Initialize tracking fields if missing
        if (!instance.recentSuccesses) {
          instance.recentSuccesses = [];
          updated = true;
        }

        // Check if successful logo count increased
        const currentSuccessCount = instance.successfulLogos;
        const lastSuccessCount = instance.lastSuccessCount || 0;

        if (currentSuccessCount > lastSuccessCount) {
          console.log(`🎉 Instance ${instanceId} success count increased: ${lastSuccessCount} → ${currentSuccessCount}`);

          // Look up recent successful games near the current processing range
          if (instance.currentGameId && instance.currentGameName && instance.currentPlatform) {
            // Add the current game as a recent success (approximation)
            const newSuccess = {
              gameId: instance.currentGameId,
              gameName: instance.currentGameName,
              platform: instance.currentPlatform,
              timestamp: new Date().toISOString()
            };

            instance.recentSuccesses.unshift(newSuccess);
            instance.recentSuccesses = instance.recentSuccesses.slice(0, 3); // Keep only last 3

            console.log(`   Added success: ${instance.currentGameName} (${instance.currentPlatform})`);
            updated = true;
          }

          instance.lastSuccessCount = currentSuccessCount;
        }
      }

      if (updated) {
        writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
        console.log('✅ Updated progress with success notifications');
      }

    } catch (error) {
      console.error('Error monitoring successes:', error);
    }

    // Check every 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

monitorSuccessNotifications().catch(console.error);