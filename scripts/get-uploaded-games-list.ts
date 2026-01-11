#!/usr/bin/env tsx

import { config } from 'dotenv';
import Database from 'better-sqlite3';
import * as fs from 'fs/promises';

config();

// Mainstream platforms that were used in the upload
const MAINSTREAM_PLATFORMS = [
  'Nintendo Entertainment System',
  'Super Nintendo Entertainment System',
  'Nintendo 64',
  'Nintendo GameCube',
  'Nintendo Wii',
  'Nintendo DS',
  'Nintendo 3DS',
  'Game Boy',
  'Game Boy Color',
  'Game Boy Advance',
  'Sega Master System',
  'Sega Genesis',
  'Sega Saturn',
  'Sega Dreamcast',
  'Sega Game Gear',
  'Sony PlayStation',
  'Sony PlayStation 2',
  'Sony PlayStation 3',
  'Sony PlayStation Portable',
  'Microsoft Xbox',
  'Microsoft Xbox 360',
  'Atari 2600',
  'Atari 5200',
  'Atari 7800',
  'Atari Lynx',
  'Atari Jaguar',
  'ColecoVision',
  'Intellivision',
  'Neo Geo',
  'Neo Geo Pocket',
  'Neo Geo Pocket Color',
  'PC Engine',
  'TurboGrafx-16',
  '3DO',
  'Amiga',
  'Amstrad CPC',
  'Apple II',
  'Arcade',
  'Commodore 64',
  'MSX',
  'ZX Spectrum',
  'DOS',
  'Windows',
  'ScummVM',
  'Nintendo Switch',
  'Sony PlayStation 4',
  'Microsoft Xbox One',
  'Nintendo Wii U',
  'Sony PlayStation Vita',
  'WonderSwan',
  'WonderSwan Color',
  'Virtual Boy',
  'Vectrex',
  'Channel F',
  'Magnavox Odyssey²',
  'Philips CD-i',
  'Panasonic 3DO',
  'Sega 32X',
  'Sega CD',
  'PC-FX',
  'FM Towns',
  'Sharp X68000',
  'PC-98'
];

async function getUploadedGamesList() {
  try {
    console.log('🔍 Getting list of games that were uploaded to R2...\\n');

    // Open the clear-logos database that was used for the upload
    const db = new Database('public/clear-logos.db', { readonly: true });

    // Create placeholders for the platforms
    const placeholders = MAINSTREAM_PLATFORMS.map(() => '?').join(',');

    // Get all games from mainstream platforms (same filter used in upload)
    const query = `
      SELECT DISTINCT game_name
      FROM clear_logos
      WHERE platform_name IN (${placeholders})
      ORDER BY game_name
    `;

    console.log('📖 Querying clear-logos database...');
    const games = db.prepare(query).all(...MAINSTREAM_PLATFORMS);
    db.close();

    const gameNames = games.map((game: any) => game.game_name);

    console.log(`✅ Found ${gameNames.length} games that were uploaded to R2`);

    // Save the list to a file
    await fs.writeFile(
      'available-logos-list.json',
      JSON.stringify(gameNames, null, 2)
    );

    console.log(`💾 Game list saved to: available-logos-list.json`);

    // Show sample
    console.log('\\n🎮 Sample games with logos:');
    gameNames.slice(0, 20).forEach((name, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${name}`);
    });

    return gameNames;

  } catch (error) {
    console.error('❌ Error getting uploaded games list:', error);
    return [];
  }
}

getUploadedGamesList().catch(console.error);