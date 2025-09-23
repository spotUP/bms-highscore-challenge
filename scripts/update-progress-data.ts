#!/usr/bin/env tsx

import { copyFileSync } from 'fs';

async function updateProgressFiles() {
  try {
    // Copy production progress to the location LogoScraper expects
    copyFileSync('production-turbo-progress.json', 'public/production-scraper-progress.json');
    console.log('✅ Updated production-scraper-progress.json');
  } catch (error) {
    console.error('❌ Failed to update progress files:', error);
  }
}

async function runUpdate() {
  console.log('🔄 Starting progress file updater...');
  await updateProgressFiles();

  // Update every 2 seconds for real-time updates
  setInterval(updateProgressFiles, 2000);
}

runUpdate().catch(console.error);