#!/usr/bin/env tsx

// Test if the GTA V logo fix worked

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

console.log('🧪 Testing GTA V logo fix...');

// Test 1: Check SQLite databases
console.log('\n1️⃣ Checking SQLite databases...');

const indexDb = new Database('public/games-index.db');
const gtaIndex = indexDb.prepare('SELECT id, name, has_logo, logo_chunk FROM games WHERE id = ?').get(-29048);

if (gtaIndex) {
  console.log(`📋 GTA V in index: ${gtaIndex.name}`);
  console.log(`   Has logo: ${gtaIndex.has_logo ? 'Yes' : 'No'}`);
  console.log(`   Logo chunk: ${gtaIndex.logo_chunk || 'None'}`);

  if (gtaIndex.has_logo && gtaIndex.logo_chunk) {
    const chunkDb = new Database(`public/logos-${gtaIndex.logo_chunk}.db`);
    const gtaLogo = chunkDb.prepare('SELECT logo_base64 FROM logos WHERE game_id = ?').get(-29048);

    if (gtaLogo && gtaLogo.logo_base64) {
      console.log(`🚨 ERROR: GTA V still has logo in SQLite!`);
      console.log(`   Logo starts with: ${gtaLogo.logo_base64.substring(0, 50)}...`);
    } else {
      console.log(`✅ GTA V logo correctly removed from SQLite chunk ${gtaIndex.logo_chunk}`);
    }

    chunkDb.close();
  } else {
    console.log(`✅ GTA V correctly marked as having no logo`);
  }
} else {
  console.log('❌ GTA V not found in index database');
}

indexDb.close();

// Test 2: Check Supabase database
console.log('\n2️⃣ Checking Supabase database...');

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: gtaSupabase } = await supabase
  .from('games_database')
  .select('id, name, platform_name, logo_base64')
  .eq('id', -29048)
  .single();

if (gtaSupabase) {
  console.log(`📊 GTA V in Supabase: ${gtaSupabase.name} (${gtaSupabase.platform_name})`);

  if (gtaSupabase.logo_base64) {
    console.log(`🚨 ERROR: GTA V still has logo in Supabase!`);
    console.log(`   Logo starts with: ${gtaSupabase.logo_base64.substring(0, 50)}...`);
  } else {
    console.log(`✅ GTA V logo correctly removed from Supabase`);
  }
} else {
  console.log('❌ GTA V not found in Supabase database');
}

// Test 3: Simulate browser behavior
console.log('\n3️⃣ Simulating browser behavior...');
console.log('In the browser, the GamesBrowser component would:');

if (gtaIndex && !gtaIndex.has_logo && (!gtaSupabase || !gtaSupabase.logo_base64)) {
  console.log(`✅ Show no logo for GTA V (both SQLite and Supabase have no logo)`);
} else if (gtaIndex && gtaIndex.has_logo) {
  console.log(`⚠️ Would try to show SQLite logo (but we cleared it)`);
} else if (gtaSupabase && gtaSupabase.logo_base64) {
  console.log(`⚠️ Would show Supabase logo (but we cleared it)`);
} else {
  console.log(`✅ Show no logo for GTA V - FIXED!`);
}

console.log('\n🎯 Expected result in browser:');
console.log('GTA V Windows should now show either no logo or a placeholder, not the Cool World logo.');
console.log('Visit http://localhost:8080/games and search for "Grand Theft Auto V" to verify.');