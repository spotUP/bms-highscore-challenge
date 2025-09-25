#!/usr/bin/env tsx

// Test actual logo matching like the GamesBrowser does

import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🧪 Testing logo matching like GamesBrowser does...');

// Get games that should have logos (popular ones)
const { data: supabaseGames, error } = await supabase
  .from('games_database')
  .select('id, name, platform_name')
  .or('name.ilike.%Mario%,name.ilike.%Zelda%,name.ilike.%Pac-Man%')
  .limit(10);

if (error) {
  console.error('Error loading from Supabase:', error);
  process.exit(1);
}

console.log(`📊 Found ${supabaseGames?.length} games from Supabase with popular names:`);

const indexDb = new Database('public/games-index.db');

// Test logo lookup by name (current approach)
console.log('\n🔍 Testing logo lookup by NAME (current approach):');
for (const game of supabaseGames || []) {
  const sqliteGame = indexDb.prepare('SELECT id, name, has_logo, logo_chunk FROM games WHERE name = ? AND has_logo = 1').get(game.name);

  if (sqliteGame) {
    console.log(`   ✅ "${game.name}" → SQLite ID ${sqliteGame.id}, chunk ${sqliteGame.logo_chunk}`);
  } else {
    console.log(`   ❌ "${game.name}" → No logo found`);
  }
}

// Test logo lookup by ID (what might work better)
console.log('\n🎯 Testing logo lookup by ID (potential fix):');
for (const game of supabaseGames || []) {
  const sqliteGame = indexDb.prepare('SELECT id, name, has_logo, logo_chunk FROM games WHERE id = ? AND has_logo = 1').get(game.id);

  if (sqliteGame) {
    console.log(`   ✅ ID ${game.id} "${game.name}" → SQLite: "${sqliteGame.name}", chunk ${sqliteGame.logo_chunk}`);

    // Check if names match
    if (sqliteGame.name === game.name) {
      console.log(`      ✅ Names match perfectly`);
    } else {
      console.log(`      ⚠️  Name mismatch: "${sqliteGame.name}" vs "${game.name}"`);
    }
  } else {
    console.log(`   ❌ ID ${game.id} "${game.name}" → No logo found in SQLite`);
  }
}

indexDb.close();

console.log('\n💡 This shows us the exact issue and how to fix it!');