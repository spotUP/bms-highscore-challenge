#!/usr/bin/env tsx

// Create smaller, manageable Clear Logo database chunks for browser consumption
// This splits the massive 10GB database into 100MB chunks

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

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

async function createClearLogoChunks() {
  console.log('🔄 Creating Clear Logo database chunks...');

  const mainDbPath = path.join(process.cwd(), 'public', 'clear-logos.db');
  const chunksDir = path.join(process.cwd(), 'public', 'clear-logo-chunks');

  if (!fs.existsSync(mainDbPath)) {
    console.error('❌ Main Clear Logo database not found at:', mainDbPath);
    return;
  }

  // Create chunks directory
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  const mainDb = new Database(mainDbPath);

  // Get total count
  const totalResult = mainDb.prepare('SELECT COUNT(*) as count FROM clear_logos').get() as { count: number };
  console.log(`📊 Processing ${totalResult.count.toLocaleString()} Clear Logos`);

  const CHUNK_SIZE = 5; // 5 logos per chunk (~2-8MB each, well within Vercel limits)
  const totalChunks = Math.ceil(totalResult.count / CHUNK_SIZE);

  console.log(`📦 Creating ${totalChunks} chunks of ${CHUNK_SIZE} logos each`);

  // Create chunk info file
  const chunkInfo = {
    totalLogos: totalResult.count,
    totalChunks,
    chunkSize: CHUNK_SIZE,
    lastUpdated: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(chunksDir, 'chunk-info.json'),
    JSON.stringify(chunkInfo, null, 2)
  );

  // Create each chunk
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const offset = chunkIndex * CHUNK_SIZE;
    const chunkPath = path.join(chunksDir, `chunk-${chunkIndex.toString().padStart(3, '0')}.db`);

    console.log(`📦 Creating chunk ${chunkIndex + 1}/${totalChunks} (offset: ${offset})`);

    // Create new chunk database
    const chunkDb = new Database(chunkPath);

    // Create table
    chunkDb.exec(`
      CREATE TABLE clear_logos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        launchbox_database_id INTEGER NOT NULL,
        game_name TEXT NOT NULL,
        platform_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        logo_base64 TEXT NOT NULL,
        region TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(launchbox_database_id, region)
      );

      CREATE INDEX idx_clear_logos_game_platform ON clear_logos(game_name, platform_name);
      CREATE INDEX idx_clear_logos_launchbox_id ON clear_logos(launchbox_database_id);
    `);

    // Copy data to chunk
    const selectStmt = mainDb.prepare(`
      SELECT * FROM clear_logos
      ORDER BY id
      LIMIT ? OFFSET ?
    `);

    const insertStmt = chunkDb.prepare(`
      INSERT INTO clear_logos
      (launchbox_database_id, game_name, platform_name, source_url, logo_base64, region, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const logos = selectStmt.all(CHUNK_SIZE, offset) as ClearLogo[];

    for (const logo of logos) {
      insertStmt.run(
        logo.launchbox_database_id,
        logo.game_name,
        logo.platform_name,
        logo.source_url,
        logo.logo_base64,
        logo.region,
        logo.created_at
      );
    }

    chunkDb.close();

    const chunkStats = fs.statSync(chunkPath);
    const chunkSizeMB = (chunkStats.size / 1024 / 1024).toFixed(1);
    console.log(`✅ Chunk ${chunkIndex + 1} created: ${chunkSizeMB}MB (${logos.length} logos)`);
  }

  mainDb.close();

  console.log('🎉 Clear Logo chunks created successfully!');
  console.log(`📁 Chunks directory: ${chunksDir}`);
  console.log(`📦 Total chunks: ${totalChunks}`);
  console.log(`💾 Chunk size: ~10-30MB each (Vercel compatible)`);
}

// Run the function if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createClearLogoChunks().catch(console.error);
}