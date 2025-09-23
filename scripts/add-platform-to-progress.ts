#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function addPlatformToProgress() {
  const PROGRESS_FILE = 'production-scraper-progress.json';

  if (!existsSync(PROGRESS_FILE)) {
    console.log('No progress file found');
    return;
  }

  const progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));

  for (const [instanceId, instanceProgress] of Object.entries(progress)) {
    const gameId = (instanceProgress as any).currentGameId;

    if (gameId) {
      try {
        const { data: game } = await supabase
          .from('games_database')
          .select('platform_name')
          .eq('id', gameId)
          .single();

        if (game) {
          (instanceProgress as any).currentPlatform = game.platform_name;
          console.log(`Added platform "${game.platform_name}" to instance ${instanceId}`);
        }
      } catch (error) {
        console.log(`Could not get platform for game ${gameId} in instance ${instanceId}`);
      }
    }
  }

  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  console.log('✅ Updated progress file with platform data');
}

addPlatformToProgress().catch(console.error);