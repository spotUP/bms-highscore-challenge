#!/usr/bin/env tsx

import Database from 'better-sqlite3';
import * as fs from 'fs';

// Create a small development database with popular games only
const sourceDb = new Database('public/games.db');
const devDb = new Database('public/dev-games.db');

console.log('Creating development database...');

// Create the same table structure as the actual database
devDb.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    platform_name TEXT NOT NULL,
    logo_base64 TEXT,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Get a sample of popular games with logos
const popularGames = sourceDb.prepare(`
  SELECT id, name, platform_name, logo_base64
  FROM games
  WHERE logo_base64 IS NOT NULL
    AND (
      name LIKE '%Mario%' OR
      name LIKE '%Zelda%' OR
      name LIKE '%Pac-Man%' OR
      name LIKE '%Sonic%' OR
      name LIKE '%Street Fighter%' OR
      name LIKE '%Mortal Kombat%' OR
      name LIKE '%Final Fantasy%' OR
      name LIKE '%Resident Evil%' OR
      name LIKE '%Call of Duty%' OR
      name LIKE '%Grand Theft Auto%' OR
      name LIKE '%Pokemon%' OR
      name LIKE '%Metal Gear%' OR
      name LIKE '%Doom%' OR
      name LIKE '%Quake%' OR
      name LIKE '%Half-Life%'
    )
  LIMIT 500
`).all();

console.log(`Found ${popularGames.length} popular games with logos`);

// Insert games into dev database
const insert = devDb.prepare(`
  INSERT INTO games (id, name, platform_name, logo_base64)
  VALUES (?, ?, ?, ?)
`);

const insertMany = devDb.transaction((games: any[]) => {
  for (const game of games) {
    insert.run(game.id, game.name, game.platform_name, game.logo_base64);
  }
});

insertMany(popularGames);

// Get file sizes
const sourceSize = fs.statSync('public/games.db').size;
const devSize = fs.statSync('public/dev-games.db').size;

console.log(`Original database: ${(sourceSize / 1024 / 1024).toFixed(2)}MB`);
console.log(`Development database: ${(devSize / 1024 / 1024).toFixed(2)}MB`);
console.log(`Inserted ${popularGames.length} games`);

// Verify Pac-Man games are included
const pacmanGames = devDb.prepare(`
  SELECT name, platform_name
  FROM games
  WHERE name LIKE '%Pac-Man%'
`).all();

console.log(`Pac-Man games in dev database:`, pacmanGames);

sourceDb.close();
devDb.close();

console.log('Development database created successfully!');