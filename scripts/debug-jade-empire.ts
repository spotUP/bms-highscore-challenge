#!/usr/bin/env tsx

// Debug why Jade Empire shows Killzone logo

import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

console.log('🔍 Debugging Jade Empire vs Killzone logo issue...');

// 1. Find Jade Empire in Supabase
console.log('\n1️⃣ Jade Empire in Supabase:');
const { data: jadeEmpire } = await supabase
  .from('games_database')
  .select('id, name, platform_name, launchbox_id')
  .ilike('name', '%Jade Empire%')
  .limit(3);

jadeEmpire?.forEach(game => {
  console.log(`   ID: ${game.id}, LaunchBox ID: ${game.launchbox_id}, Name: "${game.name}", Platform: ${game.platform_name}`);
});

// 2. Find Killzone games in Supabase
console.log('\n2️⃣ Killzone games in Supabase:');
const { data: killzoneGames } = await supabase
  .from('games_database')
  .select('id, name, platform_name, launchbox_id')
  .ilike('name', '%Killzone%')
  .limit(5);

killzoneGames?.forEach(game => {
  console.log(`   ID: ${game.id}, LaunchBox ID: ${game.launchbox_id}, Name: "${game.name}", Platform: ${game.platform_name}`);
});

// 3. Check if there's LaunchBox ID overlap
console.log('\n3️⃣ Checking for LaunchBox ID overlaps:');
if (jadeEmpire && killzoneGames) {
  for (const jade of jadeEmpire) {
    for (const killzone of killzoneGames) {
      if (jade.launchbox_id === killzone.launchbox_id) {
        console.log(`🚨 MATCH! Jade Empire (${jade.id}) and Killzone (${killzone.id}) both have LaunchBox ID ${jade.launchbox_id}`);
      }

      // Check if they're close numbers
      const diff = Math.abs(jade.launchbox_id - killzone.launchbox_id);
      if (diff < 100) {
        console.log(`⚠️  Close IDs: Jade Empire LaunchBox ${jade.launchbox_id} vs Killzone LaunchBox ${killzone.launchbox_id} (diff: ${diff})`);
      }
    }
  }
}

// 4. Check what's in our SQLite database
console.log('\n4️⃣ Jade Empire in our fresh database:');
const db = new Database('production-turbo-logos.db');

const jadeInDb = db.prepare('SELECT * FROM games WHERE name LIKE ?').get('%Jade Empire%');
if (jadeInDb) {
  console.log(`   SQLite: ID ${jadeInDb.id}, Name: "${jadeInDb.name}", Platform: ${jadeInDb.platform_name}`);

  if (jadeInDb.logo_base64) {
    const logoStart = jadeInDb.logo_base64.substring(0, 100);
    console.log(`   Logo starts with: ${logoStart}...`);
  }
}

db.close();

console.log('\n💡 This should show us if the scraper fetched Killzone\'s logo for Jade Empire\'s LaunchBox ID!');