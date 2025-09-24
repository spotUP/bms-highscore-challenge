#!/usr/bin/env tsx

import Database from 'better-sqlite3';
import * as fs from 'fs';

const CHUNK_SIZE = 5000; // Same as split-database.ts

console.log('🔄 Updating split databases with new logos from scraper...');

// Check if scraper database exists
if (!fs.existsSync('production-turbo-logos.db')) {
  console.log('❌ No scraper database found (production-turbo-logos.db)');
  process.exit(1);
}

// Open databases
const scraperDb = new Database('production-turbo-logos.db');
const indexDb = new Database('public/games-index.db');

console.log('📊 Checking for new logos in scraper database...');

// Get games with logos from scraper that might need updating
const newLogos = scraperDb.prepare(`
  SELECT id, name, platform_name, logo_base64
  FROM games
  WHERE logo_base64 IS NOT NULL AND logo_base64 != ''
`).all();

console.log(`📦 Found ${newLogos.length} games with logos in scraper database`);

let updatedCount = 0;
let newGameCount = 0;

for (const game of newLogos) {
  try {
    // Check if game exists in index
    const indexGame = indexDb.prepare(`
      SELECT id, has_logo, logo_chunk FROM games WHERE id = ?
    `).get(game.id) as any;

    if (!indexGame) {
      // Game doesn't exist in index - this is a completely new game
      console.log(`🆕 New game found: ${game.name} (ID: ${game.id})`);

      // Determine which chunk this should go in based on existing chunk sizes
      let targetChunk = 1;
      let minChunkSize = Infinity;

      // Find the chunk with the least games
      for (let chunkNum = 1; chunkNum <= 11; chunkNum++) {
        const chunkPath = `public/logos-${chunkNum}.db`;
        if (fs.existsSync(chunkPath)) {
          const chunkDb = new Database(chunkPath);
          const count = chunkDb.prepare('SELECT COUNT(*) as count FROM logos').get() as any;
          if (count.count < minChunkSize) {
            minChunkSize = count.count;
            targetChunk = chunkNum;
          }
          chunkDb.close();
        }
      }

      // Add to index
      indexDb.prepare(`
        INSERT INTO games (id, name, platform_name, has_logo, logo_chunk)
        VALUES (?, ?, ?, 1, ?)
      `).run(game.id, game.name, game.platform_name, targetChunk);

      // Add logo to chunk
      const chunkDb = new Database(`public/logos-${targetChunk}.db`);
      chunkDb.prepare(`
        INSERT INTO logos (game_id, logo_base64) VALUES (?, ?)
      `).run(game.id, game.logo_base64);
      chunkDb.close();

      newGameCount++;
    } else if (!indexGame.has_logo) {
      // Game exists but doesn't have logo yet - update it
      console.log(`🖼️  Adding logo for existing game: ${game.name} (ID: ${game.id})`);

      // Determine which chunk to put this in (same logic as above)
      let targetChunk = 1;
      let minChunkSize = Infinity;

      for (let chunkNum = 1; chunkNum <= 11; chunkNum++) {
        const chunkPath = `public/logos-${chunkNum}.db`;
        if (fs.existsSync(chunkPath)) {
          const chunkDb = new Database(chunkPath);
          const count = chunkDb.prepare('SELECT COUNT(*) as count FROM logos').get() as any;
          if (count.count < minChunkSize) {
            minChunkSize = count.count;
            targetChunk = chunkNum;
          }
          chunkDb.close();
        }
      }

      // Update index
      indexDb.prepare(`
        UPDATE games SET has_logo = 1, logo_chunk = ? WHERE id = ?
      `).run(targetChunk, game.id);

      // Add logo to chunk
      const chunkDb = new Database(`public/logos-${targetChunk}.db`);
      chunkDb.prepare(`
        INSERT INTO logos (game_id, logo_base64) VALUES (?, ?)
      `).run(game.id, game.logo_base64);
      chunkDb.close();

      updatedCount++;
    } else {
      // Game already has logo - could update if different
      const chunkDb = new Database(`public/logos-${indexGame.logo_chunk}.db`);
      const existingLogo = chunkDb.prepare('SELECT logo_base64 FROM logos WHERE game_id = ?').get(game.id) as any;

      if (existingLogo && existingLogo.logo_base64 !== game.logo_base64) {
        console.log(`🔄 Updating logo for: ${game.name} (ID: ${game.id})`);
        chunkDb.prepare('UPDATE logos SET logo_base64 = ? WHERE game_id = ?').run(game.logo_base64, game.id);
        updatedCount++;
      }

      chunkDb.close();
    }

    if ((newGameCount + updatedCount) % 100 === 0) {
      console.log(`⏳ Progress: ${newGameCount} new games, ${updatedCount} updated...`);
    }
  } catch (error) {
    console.warn(`❌ Error processing game ${game.id} (${game.name}):`, error);
  }
}

// Close databases
scraperDb.close();
indexDb.close();

console.log('\n✅ Split database update complete!');
console.log('='.repeat(50));
console.log(`🆕 Added ${newGameCount} new games`);
console.log(`🔄 Updated ${updatedCount} existing games with new logos`);
console.log(`📊 Total changes: ${newGameCount + updatedCount}`);

if (newGameCount + updatedCount > 0) {
  console.log('\n💡 Tip: You may want to backup your split databases before deploying');
}