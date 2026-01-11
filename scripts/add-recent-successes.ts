#!/usr/bin/env tsx

import { readFileSync, writeFileSync, existsSync } from 'fs';

async function addRecentSuccesses() {
  const PROGRESS_FILE = 'production-scraper-progress.json';

  if (!existsSync(PROGRESS_FILE)) {
    console.log('No progress file found');
    return;
  }

  const progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));

  for (const [instanceId, instanceProgress] of Object.entries(progress)) {
    if (!(instanceProgress as any).recentSuccesses) {
      (instanceProgress as any).recentSuccesses = [];
      console.log(`Added recentSuccesses array to instance ${instanceId}`);
    }
  }

  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  console.log('✅ Updated progress file with recentSuccesses arrays');
}

addRecentSuccesses().catch(console.error);