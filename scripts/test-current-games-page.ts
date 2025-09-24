#!/usr/bin/env tsx

// Simulate what the GamesBrowser actually does to find the issue

import { createClient } from '@supabase/supabase-js';
import { sqliteService } from '../src/services/sqliteService.js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🧪 Simulating GamesBrowser behavior...');

// Step 1: Load games like GamesBrowser does
const { data: games, error } = await supabase
  .from('games_database')
  .select('id, name, platform_name')
  .limit(5);

if (error) {
  console.error('Error loading games:', error);
  process.exit(1);
}

console.log('\n📊 Games loaded from Supabase games_database:');
games?.forEach(game => {
  console.log(`   ID: ${game.id}, Name: "${game.name}"`);
});

// Step 2: Get logos like GamesBrowser does
if (games) {
  console.log('\n🖼️  Getting logos via SQLite service...');
  const gameNames = games.map(game => game.name);

  try {
    const logoMap = await sqliteService.getLogosForGames(gameNames);

    console.log('\n🎯 Logo results:');
    games.forEach(game => {
      const hasLogo = logoMap[game.name];
      console.log(`   "${game.name}": ${hasLogo ? '✅ Logo found' : '❌ No logo'}`);
    });

    console.log(`\n📊 Found ${Object.keys(logoMap).length} out of ${games.length} logos`);
  } catch (error) {
    console.error('Error getting logos:', error);
  }
}

console.log('\n💡 This simulates the exact behavior of /games page!');