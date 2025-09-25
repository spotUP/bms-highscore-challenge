#!/usr/bin/env tsx

// Test if the browser can load the SQLite files we just created

import { sqliteService } from '../src/services/sqliteService.js';

console.log('🧪 Testing browser SQLite service with new database...');

try {
  // This will fail in Node.js but shows us if the service logic is working
  const result = await sqliteService.getLogosForGames(['Halo: Combat Evolved', 'Crysis', 'BioShock']);
  console.log('SQLite service result:', result);
} catch (error) {
  console.log('Expected Node.js error:', error.message);
}

// Check if the files exist and are readable
import { existsSync, statSync } from 'fs';

const files = [
  'public/games-index.db',
  'public/logos-1.db'
];

console.log('\n📁 Checking database files:');
for (const file of files) {
  if (existsSync(file)) {
    const stats = statSync(file);
    console.log(`✅ ${file}: ${(stats.size / 1024).toFixed(2)}KB`);
  } else {
    console.log(`❌ ${file}: Not found`);
  }
}

// Test the index database directly
import Database from 'better-sqlite3';

try {
  const indexDb = new Database('public/games-index.db');
  const gameCount = indexDb.prepare('SELECT COUNT(*) as count FROM games').get() as any;
  const logoCount = indexDb.prepare('SELECT COUNT(*) as count FROM games WHERE has_logo = 1').get() as any;

  console.log(`\n📊 Index database: ${gameCount.count} games, ${logoCount.count} with logos`);

  // Test searching for Halo
  const halo = indexDb.prepare('SELECT * FROM games WHERE name LIKE ?').get('%Halo%');
  if (halo) {
    console.log('✅ Can find Halo in index:', halo.name);
  } else {
    console.log('❌ Cannot find Halo in index');
  }

  indexDb.close();
} catch (error) {
  console.error('❌ Error reading index database:', error.message);
}