#!/usr/bin/env tsx

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const CHUNK_SIZE = 5000; // Games per logo chunk
const PUBLIC_DIR = 'public';

console.log('🔄 Starting database split process...');

// Open source database
const sourceDb = new Database('improved-clear-logos.db');

// Get total count and basic stats
const stats = sourceDb.prepare('SELECT COUNT(*) as total, COUNT(logo_base64) as with_logos FROM games').get() as any;
console.log(`📊 Source database: ${stats.total} games, ${stats.with_logos} with logos`);

// 1. Create games index database (no logos)
console.log('📇 Creating games index database...');
const indexDb = new Database('public/games-index.db');

indexDb.exec(`
  CREATE TABLE games (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    platform_name TEXT NOT NULL,
    has_logo INTEGER DEFAULT 0,
    logo_chunk INTEGER,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_games_name ON games(name);
  CREATE INDEX idx_games_platform ON games(platform_name);
  CREATE INDEX idx_games_has_logo ON games(has_logo);
  CREATE INDEX idx_games_chunk ON games(logo_chunk);
`);

// 2. Get all games ordered by popularity (games with common words first, then alphabetical)
console.log('🎯 Analyzing game popularity for optimal chunking...');
const allGames = sourceDb.prepare(`
  SELECT id, name, platform_name, logo_base64,
    CASE
      WHEN name LIKE '%Mario%' OR name LIKE '%Zelda%' OR name LIKE '%Pac-Man%' OR
           name LIKE '%Sonic%' OR name LIKE '%Street Fighter%' OR name LIKE '%Final Fantasy%' THEN 1
      WHEN name LIKE '%Call of Duty%' OR name LIKE '%Grand Theft Auto%' OR name LIKE '%Pokemon%' OR
           name LIKE '%Resident Evil%' OR name LIKE '%Metal Gear%' THEN 2
      ELSE 3
    END as popularity_tier
  FROM games
  WHERE logo_base64 IS NOT NULL
  ORDER BY popularity_tier, name
`).all();

console.log(`📦 Processing ${allGames.length} games with logos...`);

// 3. Create logo chunk databases and populate index
const chunks: { [key: number]: Database } = {};
let currentChunk = 1;
let gamesInCurrentChunk = 0;

const indexInsert = indexDb.prepare(`
  INSERT INTO games (id, name, platform_name, has_logo, logo_chunk)
  VALUES (?, ?, ?, 1, ?)
`);

for (let i = 0; i < allGames.length; i++) {
  const game = allGames[i];

  // Create new chunk database if needed
  if (gamesInCurrentChunk === 0) {
    const chunkPath = `public/logos-${currentChunk}.db`;
    console.log(`📁 Creating chunk ${currentChunk}: ${chunkPath}`);

    chunks[currentChunk] = new Database(chunkPath);
    chunks[currentChunk].exec(`
      CREATE TABLE logos (
        game_id INTEGER PRIMARY KEY,
        logo_base64 TEXT NOT NULL
      );
    `);
  }

  // Add logo to current chunk
  chunks[currentChunk].prepare('INSERT INTO logos (game_id, logo_base64) VALUES (?, ?)').run(
    game.id,
    game.logo_base64
  );

  // Add to index
  indexInsert.run(game.id, game.name, game.platform_name, currentChunk);

  gamesInCurrentChunk++;

  // Move to next chunk if current is full
  if (gamesInCurrentChunk >= CHUNK_SIZE) {
    chunks[currentChunk].close();
    delete chunks[currentChunk];
    currentChunk++;
    gamesInCurrentChunk = 0;

    if (i % 10000 === 0) {
      console.log(`⏳ Progress: ${i + 1}/${allGames.length} games processed...`);
    }
  }
}

// Close any remaining open chunk
if (chunks[currentChunk]) {
  chunks[currentChunk].close();
}

// 4. Add games without logos to index
console.log('📋 Adding games without logos to index...');
const gamesWithoutLogos = sourceDb.prepare(`
  SELECT id, name, platform_name
  FROM games
  WHERE logo_base64 IS NULL
`).all();

const indexInsertNoLogo = indexDb.prepare(`
  INSERT INTO games (id, name, platform_name, has_logo, logo_chunk)
  VALUES (?, ?, ?, 0, NULL)
`);

for (const game of gamesWithoutLogos) {
  indexInsertNoLogo.run(game.id, game.name, game.platform_name);
}

// Close databases
indexDb.close();
sourceDb.close();

// 5. Generate summary
console.log('\n📈 Database split complete!');
console.log('='.repeat(50));

// Check file sizes
const sourceSize = fs.statSync('public/games.db').size;
const indexSize = fs.statSync('public/games-index.db').size;

console.log(`📊 Original database: ${(sourceSize / 1024 / 1024).toFixed(2)}MB`);
console.log(`📇 Games index: ${(indexSize / 1024).toFixed(2)}KB`);

let totalChunkSize = 0;
for (let i = 1; i <= currentChunk; i++) {
  const chunkPath = `public/logos-${i}.db`;
  if (fs.existsSync(chunkPath)) {
    const chunkSize = fs.statSync(chunkPath).size;
    totalChunkSize += chunkSize;
    console.log(`📁 Chunk ${i}: ${(chunkSize / 1024 / 1024).toFixed(2)}MB`);
  }
}

console.log(`📦 Total chunks size: ${(totalChunkSize / 1024 / 1024).toFixed(2)}MB`);
console.log(`✅ Created ${currentChunk} logo chunks`);
console.log(`🎯 Users can now browse ${stats.total} games instantly!`);
console.log(`🖼️  Logos load progressively from ${currentChunk} chunks`);