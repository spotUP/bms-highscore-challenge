#!/usr/bin/env tsx

// Test script to understand the ID offset issue

import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Testing ID offset between Supabase and SQLite...');

// Get a few games from Supabase games_database
const { data: supabaseGames, error } = await supabase
  .from('games_database')
  .select('id, name, platform_name')
  .limit(5);

if (error) {
  console.error('Error loading from Supabase:', error);
  process.exit(1);
}

console.log('📊 Sample games from Supabase games_database:');
supabaseGames?.forEach(game => {
  console.log(`   ID: ${game.id}, Name: "${game.name}"`);
});

// Check SQLite for corresponding IDs
const indexDb = new Database('public/games-index.db');

console.log('\n🔍 Checking SQLite for same IDs:');
for (const supabaseGame of supabaseGames || []) {
  const sqliteGame = indexDb.prepare('SELECT id, name FROM games WHERE id = ?').get(supabaseGame.id);

  if (sqliteGame) {
    console.log(`   ✅ ID ${supabaseGame.id}: "${sqliteGame.name}" (matches)`);
  } else {
    console.log(`   ❌ ID ${supabaseGame.id}: "${supabaseGame.name}" not found in SQLite`);

    // Try with offset -50000
    const offsetId = supabaseGame.id - 50000;
    const sqliteGameOffset = indexDb.prepare('SELECT id, name FROM games WHERE id = ?').get(offsetId);

    if (sqliteGameOffset) {
      console.log(`      🎯 FOUND with offset: SQLite ID ${offsetId}: "${sqliteGameOffset.name}"`);
    } else {
      // Try by name
      const sqliteGameByName = indexDb.prepare('SELECT id, name FROM games WHERE name = ?').get(supabaseGame.name);
      if (sqliteGameByName) {
        console.log(`      🔍 Found by name: SQLite ID ${sqliteGameByName.id}: "${sqliteGameByName.name}"`);
      } else {
        console.log(`      ❌ Not found by name either`);
      }
    }
  }
}

indexDb.close();

console.log('\n💡 This will help us determine the exact offset pattern!');