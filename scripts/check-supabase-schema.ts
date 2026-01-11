#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Supabase setup
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.log('🔍 Checking Supabase schema and data...');

// Get all tables
try {
  console.log('\n📋 Available tables:');
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');

  if (tablesError) {
    console.log('❌ Error getting tables:', tablesError.message);
  } else {
    tables?.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
  }
} catch (error) {
  console.log('⚠️  Could not query information schema');
}

// Check games table specifically
console.log('\n🎮 Games table inspection:');

// Get first few games to see structure
const { data: sampleGames, error: gamesError } = await supabase
  .from('games')
  .select('*')
  .limit(5);

if (gamesError) {
  console.log('❌ Error querying games table:', gamesError.message);
} else {
  console.log(`📊 Found ${sampleGames?.length} sample games`);
  if (sampleGames && sampleGames.length > 0) {
    console.log('🔍 Sample game structure:');
    console.log(JSON.stringify(sampleGames[0], null, 2));

    console.log('\n📋 Available columns:');
    Object.keys(sampleGames[0]).forEach(key => {
      console.log(`   - ${key}: ${typeof sampleGames[0][key]}`);
    });
  }
}

// Get total count
const { count, error: countError } = await supabase
  .from('games')
  .select('*', { count: 'exact', head: true });

if (countError) {
  console.log('❌ Error getting games count:', countError.message);
} else {
  console.log(`\n📊 Total games in Supabase: ${count}`);
}

// Check if there's a separate platforms table
console.log('\n🎯 Checking for platforms table:');
const { data: platforms, error: platformsError } = await supabase
  .from('platforms')
  .select('*')
  .limit(3);

if (platformsError) {
  console.log('❌ No platforms table or error:', platformsError.message);
} else {
  console.log(`📋 Found platforms table with ${platforms?.length} sample entries`);
  if (platforms && platforms.length > 0) {
    console.log('Platform structure:');
    console.log(JSON.stringify(platforms[0], null, 2));
  }
}

console.log('\n💡 This will help us understand how to properly sync the databases!');