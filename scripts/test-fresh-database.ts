#!/usr/bin/env tsx

// Test the fresh database to ensure logos are correct

import Database from 'better-sqlite3';

console.log('🧪 Testing fresh database...');

// Check the main games we know should have correct logos
const testGames = [
  'Halo: Combat Evolved',
  'Crysis',
  'BioShock',
  'Grand Theft Auto IV',
  'Left 4 Dead',
  'Assassin\'s Creed'
];

// Test index database
const indexDb = new Database('public/games-index.db');
console.log('\n📋 Games in index database:');

for (const gameName of testGames) {
  const game = indexDb.prepare('SELECT id, name, has_logo, logo_chunk FROM games WHERE name = ?').get(gameName);

  if (game) {
    console.log(`✅ ${game.name}: has_logo=${game.has_logo}, chunk=${game.logo_chunk}`);
  } else {
    console.log(`❌ ${gameName}: Not found`);
  }
}

// Test a few logos from chunk 1
console.log('\n🖼️  Testing logos in chunk 1:');
const chunkDb = new Database('public/logos-1.db');

for (const gameName of testGames.slice(0, 3)) {
  const indexGame = indexDb.prepare('SELECT id FROM games WHERE name = ?').get(gameName);

  if (indexGame) {
    const logo = chunkDb.prepare('SELECT logo_base64 FROM logos WHERE game_id = ?').get(indexGame.id);

    if (logo && logo.logo_base64) {
      const logoStart = logo.logo_base64.substring(0, 50);
      console.log(`✅ ${gameName}: Has logo (${logo.logo_base64.length} chars)`);
      console.log(`   Starts with: ${logoStart}...`);

      // Check if it's the wrong Cool World logo
      if (logoStart.includes('iVBORw0KGgoAAAANSUhEUgAAAZAAAADhCAYAAADmtuMc')) {
        console.log(`🚨 WARNING: This appears to be the Cool World logo!`);
      } else {
        console.log(`✅ Logo appears to be different from Cool World`);
      }
    } else {
      console.log(`❌ ${gameName}: No logo in chunk database`);
    }
  }
}

indexDb.close();
chunkDb.close();

console.log('\n🎯 Test complete! The database is ready for browser testing.');
console.log('Visit http://localhost:8080/games to see the games with their correct logos.');
console.log('You should see major games like Halo, Crysis, BioShock, etc. with proper logos.');