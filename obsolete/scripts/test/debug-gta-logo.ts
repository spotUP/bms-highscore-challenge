#!/usr/bin/env tsx

// Debug the specific Grand Theft Auto V / Cool World mismatch

import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🕵️ Debugging Grand Theft Auto V logo mismatch...');

// Find Grand Theft Auto V in Supabase
const { data: gtaSupabase, error } = await supabase
  .from('games_database')
  .select('id, name, platform_name')
  .ilike('name', '%Grand Theft Auto V%')
  .limit(5);

if (error) {
  console.error('Error loading GTA from Supabase:', error);
  process.exit(1);
}

console.log('\n📊 Grand Theft Auto V games in Supabase:');
gtaSupabase?.forEach(game => {
  console.log(`   ID: ${game.id}, Name: "${game.name}", Platform: ${game.platform_name}`);
});

// Check what's in SQLite with those same IDs
const indexDb = new Database('public/games-index.db');

console.log('\n🔍 What SQLite has for those IDs:');
for (const gtaGame of gtaSupabase || []) {
  const sqliteGame = indexDb.prepare('SELECT id, name, platform_name FROM games WHERE id = ?').get(gtaGame.id);

  if (sqliteGame) {
    console.log(`   ID: ${gtaGame.id}`);
    console.log(`      Supabase: "${gtaGame.name}" on ${gtaGame.platform_name}`);
    console.log(`      SQLite:   "${sqliteGame.name}" on ${sqliteGame.platform_name}`);

    if (sqliteGame.name !== gtaGame.name) {
      console.log(`      🚨 MISMATCH! Same ID, different games!`);
    } else {
      console.log(`      ✅ Names match`);
    }
  } else {
    console.log(`   ID: ${gtaGame.id} - Not found in SQLite`);
  }
}

// Also check for "Cool World" in SQLite to see what ID it has
console.log('\n🎮 Cool World in SQLite:');
const coolWorldGames = indexDb.prepare('SELECT id, name, platform_name FROM games WHERE name LIKE ?').all('%Cool World%');
coolWorldGames.forEach(game => {
  console.log(`   ID: ${game.id}, Name: "${game.name}", Platform: ${game.platform_name}`);
});

// Check if any GTA IDs match Cool World IDs
console.log('\n🔍 Cross-checking IDs:');
for (const gtaGame of gtaSupabase || []) {
  const coolWorldMatch = coolWorldGames.find(cw => cw.id === gtaGame.id);
  if (coolWorldMatch) {
    console.log(`   🚨 FOUND THE PROBLEM!`);
    console.log(`      Supabase GTA ID ${gtaGame.id} matches SQLite Cool World ID ${coolWorldMatch.id}`);
    console.log(`      This explains why GTA shows Cool World logo!`);
  }
}

indexDb.close();

console.log('\n💡 This should reveal the exact ID mapping issue!');