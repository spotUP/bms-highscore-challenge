import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

async function buildDatabaseForVercel() {
  console.log('🏗️ Building SQLite database for Vercel deployment...');

  if (!process.env.DATABASE_URL) {
    console.log('⏭️  Skipping database build (DATABASE_URL not set)');
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Create public directory if it doesn't exist
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const dbPath = path.join(publicDir, 'games.db');
  const db = new Database(dbPath);

  try {
    // Create tables matching production schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        platform_name TEXT,
        launchbox_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_games_platform ON games(platform_name);
      CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
      CREATE INDEX IF NOT EXISTS idx_games_launchbox_id ON games(launchbox_id);
    `);

    // Fetch games from database in batches
    let offset = 0;
    const batchSize = 1000;
    let totalInserted = 0;

    while (true) {
      const result = await pool.query(
        `
          SELECT id, name, platform_name, launchbox_id, created_at, updated_at
          FROM games_database
          ORDER BY id
          OFFSET $1
          LIMIT $2
        `,
        [offset, batchSize]
      );

      const games = result.rows;
      if (games.length === 0) {
        break;
      }

      // Insert batch into SQLite
      const insert = db.prepare(`
        INSERT OR REPLACE INTO games (id, name, platform_name, launchbox_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((gamesBatch: any[]) => {
        for (const game of gamesBatch) {
          insert.run(
            game.id,
            game.name,
            game.platform_name,
            game.launchbox_id,
            game.created_at,
            game.updated_at
          );
        }
      });

      insertMany(games);
      totalInserted += games.length;

      console.log(`📦 Inserted batch: ${games.length} games (Total: ${totalInserted})`);

      if (games.length < batchSize) {
        break;
      }

      offset += batchSize;
    }

    console.log(`✅ Database built successfully with ${totalInserted} games`);
    console.log(`📁 Database saved to: ${dbPath}`);

    // Log file size
    const stats = fs.statSync(dbPath);
    console.log(`💾 Database size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  } catch (error) {
    console.error('❌ Error building database:', error);
    process.exit(1);
  } finally {
    db.close();
    await pool.end();
  }
}

// Run if this is the main module
buildDatabaseForVercel().catch(console.error);

export default buildDatabaseForVercel;
