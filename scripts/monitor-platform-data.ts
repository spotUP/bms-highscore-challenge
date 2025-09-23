#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function monitorPlatformData() {
  const PROGRESS_FILE = 'production-scraper-progress.json';

  while (true) {
    try {
      if (!existsSync(PROGRESS_FILE)) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      const progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
      let updated = false;

      for (const [instanceId, instanceProgress] of Object.entries(progress)) {
        const gameId = (instanceProgress as any).currentGameId;

        // Only add platform if it's missing
        if (gameId && !(instanceProgress as any).currentPlatform) {
          try {
            const { data: game } = await supabase
              .from('games_database')
              .select('platform_name')
              .eq('id', gameId)
              .single();

            if (game) {
              (instanceProgress as any).currentPlatform = game.platform_name;
              updated = true;
              console.log(`Added platform "${game.platform_name}" to instance ${instanceId}`);
            }
          } catch (error) {
            // Silent fail for individual lookups
          }
        }
      }

      if (updated) {
        writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
        console.log('✅ Updated progress file with platform data');
      }

    } catch (error) {
      console.error('Error monitoring platform data:', error);
    }

    // Check every 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

console.log('🎮 Starting platform data monitor...');
monitorPlatformData().catch(console.error);