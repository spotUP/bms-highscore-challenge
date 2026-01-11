#!/usr/bin/env tsx

// Restore Commodore 64 and Commodore Amiga platforms to Clear Logo database
// This adds back platforms that were removed without permission

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';

// Load environment variables
config();

interface ClearLogo {
  id: number;
  launchbox_database_id: number;
  game_name: string;
  platform_name: string;
  source_url: string;
  logo_base64: string;
  region?: string;
  created_at: string;
}

// Platforms to restore
const PLATFORMS_TO_RESTORE = [
  'Commodore 64',
  'Commodore Amiga'
];

async function restoreCommodorePlatforms() {
  console.log('🔄 Starting Commodore platforms restoration...');

  const dbPath = path.join(process.cwd(), 'public', 'clear-logos.db');
  const backupPath = path.join(process.cwd(), 'public', 'clear-logos-backup.db');

  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Clear Logo database not found at: ${dbPath}`);
    return;
  }

  // Check if we have a backup to restore from
  if (!fs.existsSync(backupPath)) {
    console.log('⚠️ No backup found. Need to re-import from LaunchBox API...');
    console.log('💡 Run the Clear Logo importer for these specific platforms:');
    PLATFORMS_TO_RESTORE.forEach(platform => {
      console.log(`   - ${platform}`);
    });
    return;
  }

  console.log('📦 Found backup database, restoring from backup...');

  const db = new Database(dbPath);
  const backupDb = new Database(backupPath, { readonly: true });

  // Get current count
  const currentCount = db.prepare('SELECT COUNT(*) as count FROM clear_logos').get() as { count: number };
  console.log(`📊 Current Clear Logos: ${currentCount.count.toLocaleString()}`);

  // Get Commodore platforms from backup
  const placeholders = PLATFORMS_TO_RESTORE.map(() => '?').join(',');
  const commodoreLogos = backupDb.prepare(`
    SELECT * FROM clear_logos
    WHERE platform_name IN (${placeholders})
    ORDER BY platform_name, game_name
  `).all(...PLATFORMS_TO_RESTORE) as ClearLogo[];

  console.log(`🎯 Found ${commodoreLogos.length.toLocaleString()} Commodore logos to restore`);

  // Show platform breakdown
  const platformCounts = new Map<string, number>();
  commodoreLogos.forEach(logo => {
    platformCounts.set(logo.platform_name, (platformCounts.get(logo.platform_name) || 0) + 1);
  });

  console.log('📊 Platforms to restore:');
  platformCounts.forEach((count, platform) => {
    console.log(`   ${platform}: ${count.toLocaleString()} logos`);
  });

  // Insert logos back into main database
  console.log('📥 Inserting Commodore platforms...');

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO clear_logos (
      launchbox_database_id, game_name, platform_name, source_url, logo_base64, region, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let insertedCount = 0;
  const transaction = db.transaction(() => {
    for (const logo of commodoreLogos) {
      const result = insertStmt.run(
        logo.launchbox_database_id,
        logo.game_name,
        logo.platform_name,
        logo.source_url,
        logo.logo_base64,
        logo.region,
        logo.created_at
      );
      if (result.changes > 0) {
        insertedCount++;
      }
    }
  });

  transaction();

  backupDb.close();

  // Get final count
  const finalCount = db.prepare('SELECT COUNT(*) as count FROM clear_logos').get() as { count: number };
  console.log(`📊 Final Clear Logos: ${finalCount.count.toLocaleString()}`);

  // Show restored platform counts
  console.log('✅ Restored platforms:');
  for (const platform of PLATFORMS_TO_RESTORE) {
    const count = db.prepare('SELECT COUNT(*) as count FROM clear_logos WHERE platform_name = ?').get(platform) as { count: number };
    console.log(`   ${platform}: ${count.count.toLocaleString()} logos`);
  }

  db.close();

  console.log('');
  console.log('🎉 Commodore platforms restoration completed!');
  console.log(`✅ Restored: ${insertedCount.toLocaleString()} logos`);
  console.log(`📈 Total increase: ${(finalCount.count - currentCount.count).toLocaleString()} logos`);
}

// Run the restoration
restoreCommodorePlatforms().catch(console.error);