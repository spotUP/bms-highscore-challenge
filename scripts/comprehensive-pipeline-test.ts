#!/usr/bin/env tsx

// Comprehensive end-to-end test of the entire logo pipeline

import { createClient } from '@supabase/supabase-js';
import sqlite3 from 'sqlite3';
import Database from 'better-sqlite3';
import { existsSync, statSync, unlinkSync } from 'fs';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

console.log('🔄 COMPREHENSIVE PIPELINE TEST');
console.log('═'.repeat(80));

// Test game we'll use throughout the pipeline
const TEST_GAME = {
  name: 'Prince of Persia',
  launchboxId: 50,
  expectedLogoPattern: 'https://images.launchbox-app.com/'
};

let testResults = {
  scraper: false,
  database: false,
  split: false,
  chunks: false,
  browser: false
};

// === STEP 1: Test the scraper ===
console.log('\n1️⃣ TESTING SCRAPER');
console.log('─'.repeat(40));

async function testScraper() {
  try {
    console.log(`🎮 Testing scraper for: ${TEST_GAME.name}`);

    // Clean up any existing test database
    if (existsSync('pipeline-test.db')) {
      unlinkSync('pipeline-test.db');
    }

    const db = new sqlite3.Database('pipeline-test.db');
    await new Promise<void>((resolve) => {
      db.run(`CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        platform_name TEXT NOT NULL,
        logo_base64 TEXT,
        logo_source_url TEXT,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, () => resolve());
    });

    // Fetch logo using correct LaunchBox ID
    const gamePageUrl = `https://gamesdb.launchbox-app.com/games/details/${TEST_GAME.launchboxId}`;
    console.log(`🌐 Fetching: ${gamePageUrl}`);

    const response = await fetch(gamePageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
      return false;
    }

    const html = await response.text();

    // Look for Clear Logo
    const clearLogoMatch = html.match(/Clear Logo[^<]*<[\s\S]*?<img[^>]*src="([^"]+\.(?:png|jpg|jpeg|webp))"/i);

    if (!clearLogoMatch) {
      console.log('❌ No Clear Logo found');
      return false;
    }

    const logoUrl = clearLogoMatch[1];
    console.log(`🎯 Found Clear Logo: ${logoUrl}`);

    // Fetch the logo
    const logoResponse = await fetch(logoUrl, { signal: AbortSignal.timeout(10000) });
    if (!logoResponse.ok) {
      console.log(`❌ Failed to download logo: ${logoResponse.status}`);
      return false;
    }

    const logoBuffer = await logoResponse.arrayBuffer();
    const sizeKB = Math.round(logoBuffer.byteLength / 1024);
    console.log(`📥 Downloaded: ${sizeKB}KB`);

    // Convert to base64
    const base64 = Buffer.from(logoBuffer).toString('base64');
    const contentType = logoResponse.headers.get('content-type') || 'image/png';
    const dataUrl = `data:${contentType};base64,${base64}`;

    // Get game from Supabase
    const { data: games } = await supabase
      .from('games_database')
      .select('id, name, platform_name')
      .ilike('name', TEST_GAME.name)
      .eq('platform_name', 'Windows')
      .limit(1);

    if (!games || games.length === 0) {
      console.log(`❌ ${TEST_GAME.name} not found in Supabase`);
      return false;
    }

    const game = games[0];

    // Store in database
    await new Promise<void>((resolve, reject) => {
      db.run(
        'INSERT INTO games (id, name, platform_name, logo_base64, logo_source_url) VALUES (?, ?, ?, ?, ?)',
        [game.id, game.name, game.platform_name, dataUrl, logoUrl],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    db.close();

    console.log(`✅ Scraper test PASSED`);
    return true;

  } catch (error) {
    console.log(`❌ Scraper test FAILED: ${error.message}`);
    return false;
  }
}

// === STEP 2: Test database integrity ===
console.log('\n2️⃣ TESTING DATABASE INTEGRITY');
console.log('─'.repeat(40));

function testDatabase() {
  try {
    if (!existsSync('pipeline-test.db')) {
      console.log('❌ Test database not found');
      return false;
    }

    const db = new Database('pipeline-test.db');

    // Check if game was stored correctly
    const game = db.prepare('SELECT * FROM games WHERE name = ?').get(TEST_GAME.name);

    if (!game) {
      console.log(`❌ ${TEST_GAME.name} not found in database`);
      db.close();
      return false;
    }

    console.log(`✅ Found: ${game.name} (${game.platform_name})`);

    if (!game.logo_base64) {
      console.log('❌ No logo data stored');
      db.close();
      return false;
    }

    const logoSize = Math.round((game.logo_base64.split(',')[1]?.length || 0) * 0.75 / 1024);
    console.log(`✅ Logo data: ${logoSize}KB`);

    if (!game.logo_source_url || !game.logo_source_url.includes('launchbox-app.com')) {
      console.log('❌ Invalid source URL');
      db.close();
      return false;
    }

    console.log(`✅ Source URL: ${game.logo_source_url}`);
    console.log(`✅ Database test PASSED`);

    db.close();
    return true;

  } catch (error) {
    console.log(`❌ Database test FAILED: ${error.message}`);
    return false;
  }
}

// === STEP 3: Test database splitting ===
console.log('\n3️⃣ TESTING DATABASE SPLITTING');
console.log('─'.repeat(40));

function testDatabaseSplit() {
  try {
    // Clean up old split files
    ['test-games-index.db', 'test-logos-1.db'].forEach(file => {
      if (existsSync(file)) unlinkSync(file);
    });

    const sourceDb = new Database('pipeline-test.db');

    // Create index database
    const indexDb = new Database('test-games-index.db');
    indexDb.exec(`
      CREATE TABLE games (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        platform_name TEXT NOT NULL,
        has_logo INTEGER DEFAULT 0,
        logo_chunk INTEGER
      )
    `);

    // Create logo chunk database
    const logoDb = new Database('test-logos-1.db');
    logoDb.exec(`
      CREATE TABLE logos (
        game_id INTEGER PRIMARY KEY,
        logo_base64 TEXT NOT NULL
      )
    `);

    // Get game from source
    const game = sourceDb.prepare('SELECT * FROM games').get();

    if (!game) {
      console.log('❌ No games in source database');
      return false;
    }

    // Insert into index
    indexDb.prepare('INSERT INTO games (id, name, platform_name, has_logo, logo_chunk) VALUES (?, ?, ?, ?, ?)')
      .run(game.id, game.name, game.platform_name, 1, 1);

    // Insert into logo chunk
    logoDb.prepare('INSERT INTO logos (game_id, logo_base64) VALUES (?, ?)')
      .run(game.id, game.logo_base64);

    sourceDb.close();
    indexDb.close();
    logoDb.close();

    console.log('✅ Split databases created');

    // Verify split databases
    const testIndex = new Database('test-games-index.db');
    const testLogo = new Database('test-logos-1.db');

    const indexGame = testIndex.prepare('SELECT * FROM games WHERE id = ?').get(game.id);
    const logoData = testLogo.prepare('SELECT * FROM logos WHERE game_id = ?').get(game.id);

    testIndex.close();
    testLogo.close();

    if (!indexGame || !logoData) {
      console.log('❌ Split verification failed');
      return false;
    }

    console.log(`✅ Index entry: ${indexGame.name}, has_logo: ${indexGame.has_logo}, chunk: ${indexGame.logo_chunk}`);
    console.log(`✅ Logo chunk: ${Math.round((logoData.logo_base64.split(',')[1]?.length || 0) * 0.75 / 1024)}KB`);
    console.log('✅ Database split test PASSED');

    return true;

  } catch (error) {
    console.log(`❌ Database split test FAILED: ${error.message}`);
    return false;
  }
}

// === STEP 4: Test chunk file integrity ===
console.log('\n4️⃣ TESTING CHUNK FILE INTEGRITY');
console.log('─'.repeat(40));

function testChunks() {
  try {
    const files = ['test-games-index.db', 'test-logos-1.db'];

    for (const file of files) {
      if (!existsSync(file)) {
        console.log(`❌ Missing file: ${file}`);
        return false;
      }

      const stats = statSync(file);
      console.log(`✅ ${file}: ${(stats.size / 1024).toFixed(2)}KB`);

      // Test database can be opened and queried
      const db = new Database(file);
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      console.log(`   Tables: ${tables.map(t => t.name).join(', ')}`);
      db.close();
    }

    console.log('✅ Chunk files test PASSED');
    return true;

  } catch (error) {
    console.log(`❌ Chunk files test FAILED: ${error.message}`);
    return false;
  }
}

// === STEP 5: Test browser simulation ===
console.log('\n5️⃣ TESTING BROWSER SIMULATION');
console.log('─'.repeat(40));

function testBrowserSimulation() {
  try {
    // Simulate what the browser SQLite service would do

    // 1. Load index database
    const indexDb = new Database('test-games-index.db');
    const game = indexDb.prepare('SELECT * FROM games WHERE name LIKE ?').get(`%${TEST_GAME.name}%`);

    if (!game) {
      console.log('❌ Game not found in index');
      indexDb.close();
      return false;
    }

    console.log(`✅ Found in index: ${game.name} (chunk: ${game.logo_chunk})`);

    // 2. Load logo from chunk
    if (game.has_logo && game.logo_chunk) {
      const chunkDb = new Database(`test-logos-${game.logo_chunk}.db`);
      const logo = chunkDb.prepare('SELECT logo_base64 FROM logos WHERE game_id = ?').get(game.id);

      if (!logo || !logo.logo_base64) {
        console.log('❌ Logo not found in chunk');
        chunkDb.close();
        indexDb.close();
        return false;
      }

      const logoSize = Math.round((logo.logo_base64.split(',')[1]?.length || 0) * 0.75 / 1024);
      console.log(`✅ Logo loaded from chunk: ${logoSize}KB`);

      // 3. Verify it's a valid data URL
      if (!logo.logo_base64.startsWith('data:image/')) {
        console.log('❌ Invalid data URL format');
        chunkDb.close();
        indexDb.close();
        return false;
      }

      console.log('✅ Valid data URL format');
      chunkDb.close();
    }

    indexDb.close();
    console.log('✅ Browser simulation test PASSED');
    return true;

  } catch (error) {
    console.log(`❌ Browser simulation test FAILED: ${error.message}`);
    return false;
  }
}

// === RUN ALL TESTS ===
async function runAllTests() {
  console.log(`🎯 Testing with: ${TEST_GAME.name} (LaunchBox ID: ${TEST_GAME.launchboxId})`);

  testResults.scraper = await testScraper();
  testResults.database = testDatabase();
  testResults.split = testDatabaseSplit();
  testResults.chunks = testChunks();
  testResults.browser = testBrowserSimulation();

  // === FINAL RESULTS ===
  console.log('\n📊 FINAL RESULTS');
  console.log('═'.repeat(80));

  const tests = [
    { name: 'Scraper', result: testResults.scraper },
    { name: 'Database Storage', result: testResults.database },
    { name: 'Database Splitting', result: testResults.split },
    { name: 'Chunk Integrity', result: testResults.chunks },
    { name: 'Browser Simulation', result: testResults.browser }
  ];

  let allPassed = true;
  tests.forEach(test => {
    const status = test.result ? '✅ PASS' : '❌ FAIL';
    console.log(`${test.name.padEnd(20)}: ${status}`);
    if (!test.result) allPassed = false;
  });

  console.log('─'.repeat(40));
  console.log(allPassed ? '🎉 ALL TESTS PASSED - Pipeline working correctly!' : '❌ SOME TESTS FAILED - Check issues above');

  // Cleanup test files
  ['pipeline-test.db', 'test-games-index.db', 'test-logos-1.db'].forEach(file => {
    if (existsSync(file)) unlinkSync(file);
  });

  console.log('\n🧹 Test files cleaned up');
}

runAllTests().catch(console.error);