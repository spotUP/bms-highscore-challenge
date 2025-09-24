#!/usr/bin/env tsx

// Discover what games are actually at LaunchBox IDs 1-50 to understand the mapping

console.log('🔍 Discovering correct LaunchBox ID mappings...');

async function getGameAtId(id: number): Promise<string | null> {
  try {
    const url = `https://gamesdb.launchbox-app.com/games/details/${id}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) return null;

    const html = await response.text();
    const titleMatch = html.match(/<title>([^<]+) - LaunchBox Games Database</);

    return titleMatch ? titleMatch[1] : null;
  } catch (error) {
    return null;
  }
}

console.log('🎮 LaunchBox ID mapping (first 50):');

const knownGames: Array<{id: number, name: string}> = [];

for (let id = 1; id <= 50; id++) {
  const gameName = await getGameAtId(id);

  if (gameName) {
    console.log(`${id.toString().padStart(2)}: ${gameName}`);
    knownGames.push({ id, name: gameName });

    // Look for games we care about
    if (gameName.toLowerCase().includes('jade empire')) {
      console.log(`   🎯 Found Jade Empire at ID ${id}!`);
    }
    if (gameName.toLowerCase().includes('killzone')) {
      console.log(`   🎯 Found Killzone at ID ${id}!`);
    }
    if (gameName.toLowerCase().includes('grand theft auto v')) {
      console.log(`   🎯 Found GTA V at ID ${id}!`);
    }
  } else {
    console.log(`${id.toString().padStart(2)}: [Not found]`);
  }

  // Small delay
  await new Promise(resolve => setTimeout(resolve, 200));
}

console.log(`\n📊 Found ${knownGames.length} valid games in IDs 1-50`);

// Now let's see if any of these match games in our Supabase with wrong LaunchBox IDs
console.log('\n🔍 Checking if any of these games exist in Supabase with different LaunchBox IDs...');

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

for (const game of knownGames.slice(0, 10)) { // Check first 10 to avoid API limits
  const { data } = await supabase
    .from('games_database')
    .select('id, name, launchbox_id, platform_name')
    .ilike('name', `%${game.name}%`)
    .limit(1);

  if (data && data.length > 0) {
    const supabaseGame = data[0];
    if (supabaseGame.launchbox_id !== game.id) {
      console.log(`🚨 MISMATCH: "${game.name}"`);
      console.log(`   LaunchBox actual ID: ${game.id}`);
      console.log(`   Supabase claims ID: ${supabaseGame.launchbox_id}`);
      console.log(`   Platform: ${supabaseGame.platform_name}`);
    } else {
      console.log(`✅ MATCH: "${game.name}" - ID ${game.id} is correct`);
    }
  }
}