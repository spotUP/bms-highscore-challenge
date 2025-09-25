#!/usr/bin/env tsx

// Test if SQLite service can initialize properly
// This simulates browser initialization

import { sqliteService } from '../src/services/sqliteService.js';

console.log('🧪 Testing SQLite service initialization...');

// Test the service (this will fail in Node but shows us the logic)
try {
  const result = await sqliteService.getLogosForGames(['Grand Theft Auto V']);
  console.log('Result:', result);
} catch (error) {
  console.log('Expected error in Node.js:', error.message);
}

// Check if files exist
import { existsSync } from 'fs';

console.log('\n📁 Checking database files:');
console.log('Index DB exists:', existsSync('public/games-index.db'));
console.log('Chunk 1 exists:', existsSync('public/logos-1.db'));

// Check if GTA V is in the right place
import Database from 'better-sqlite3';
const indexDb = new Database('public/games-index.db');

const gtaInfo = indexDb.prepare('SELECT id, name, has_logo, logo_chunk FROM games WHERE name = ? AND id = ?').get('Grand Theft Auto V', -29048);
console.log('\n🎮 GTA V Windows in index:', gtaInfo);

if (gtaInfo && gtaInfo.has_logo) {
  const chunkDb = new Database(`public/logos-${gtaInfo.logo_chunk}.db`);
  const logoExists = chunkDb.prepare('SELECT game_id FROM logos WHERE game_id = ?').get(-29048);
  console.log(`🖼️  Logo exists in chunk ${gtaInfo.logo_chunk}:`, !!logoExists);
  chunkDb.close();
}

indexDb.close();