#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import 'dotenv/config';

// Supabase setup
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.log('🔍 Verifying SQLite database IDs match Supabase IDs...');

// Open SQLite databases
const indexDb = new Database('public/games-index.db');

// Get sample of games from SQLite
console.log('📋 Getting sample games from SQLite index...');
const sqliteGames = indexDb.prepare(`
  SELECT id, name, platform_name
  FROM games
  ORDER BY RANDOM()
  LIMIT 50
`).all() as Array<{id: number, name: string, platform_name: string}>;

console.log(`📊 Selected ${sqliteGames.length} random games from SQLite`);

let matchCount = 0;
let mismatchCount = 0;
let notFoundCount = 0;
let errors: Array<{id: number, name: string, error: string}> = [];

for (let i = 0; i < sqliteGames.length; i++) {
  const sqliteGame = sqliteGames[i];

  try {
    console.log(`\n🔍 [${i + 1}/${sqliteGames.length}] Checking: "${sqliteGame.name}" (SQLite ID: ${sqliteGame.id})`);

    // Query Supabase for this game by ID
    const { data: supabaseGameById, error: byIdError } = await supabase
      .from('games')
      .select('id, name, platform_name')
      .eq('id', sqliteGame.id)
      .single();

    if (byIdError) {
      if (byIdError.code === 'PGRST116') {
        console.log(`❌ Game ID ${sqliteGame.id} not found in Supabase`);
        notFoundCount++;

        // Try to find by name and platform
        const { data: supabaseGameByName, error: byNameError } = await supabase
          .from('games')
          .select('id, name, platform_name')
          .eq('name', sqliteGame.name)
          .eq('platform_name', sqliteGame.platform_name)
          .single();

        if (!byNameError && supabaseGameByName) {
          console.log(`🔄 Found same game with different ID in Supabase: ${supabaseGameByName.id}`);
          errors.push({
            id: sqliteGame.id,
            name: sqliteGame.name,
            error: `SQLite ID ${sqliteGame.id} vs Supabase ID ${supabaseGameByName.id}`
          });
        }
      } else {
        console.log(`⚠️  Supabase error:`, byIdError.message);
        errors.push({
          id: sqliteGame.id,
          name: sqliteGame.name,
          error: `Supabase error: ${byIdError.message}`
        });
      }
      continue;
    }

    // Compare the data
    if (supabaseGameById.name === sqliteGame.name && supabaseGameById.platform_name === sqliteGame.platform_name) {
      console.log(`✅ Perfect match! Names and platforms identical`);
      matchCount++;
    } else {
      console.log(`⚠️  ID matches but data differs:`);
      console.log(`   SQLite: "${sqliteGame.name}" on ${sqliteGame.platform_name}`);
      console.log(`   Supabase: "${supabaseGameById.name}" on ${supabaseGameById.platform_name}`);
      mismatchCount++;
      errors.push({
        id: sqliteGame.id,
        name: sqliteGame.name,
        error: 'Data mismatch between SQLite and Supabase'
      });
    }

  } catch (error) {
    console.log(`❌ Error checking game ${sqliteGame.id}:`, error);
    errors.push({
      id: sqliteGame.id,
      name: sqliteGame.name,
      error: `Exception: ${error}`
    });
  }

  // Small delay to be nice to Supabase
  await new Promise(resolve => setTimeout(resolve, 100));
}

// Additional check: Get total counts
console.log('\n📊 Getting total game counts...');

const sqliteCount = indexDb.prepare('SELECT COUNT(*) as count FROM games').get() as any;
console.log(`SQLite total games: ${sqliteCount.count}`);

const { count: supabaseCount, error: countError } = await supabase
  .from('games')
  .select('*', { count: 'exact', head: true });

if (!countError) {
  console.log(`Supabase total games: ${supabaseCount}`);
} else {
  console.log(`Error getting Supabase count: ${countError.message}`);
}

// Close SQLite database
indexDb.close();

// Summary report
console.log('\n' + '='.repeat(60));
console.log('🎯 DATABASE ID VERIFICATION REPORT');
console.log('='.repeat(60));
console.log(`✅ Perfect matches: ${matchCount}/${sqliteGames.length} (${Math.round(matchCount/sqliteGames.length*100)}%)`);
console.log(`⚠️  Data mismatches: ${mismatchCount}/${sqliteGames.length}`);
console.log(`❌ Not found in Supabase: ${notFoundCount}/${sqliteGames.length}`);

if (sqliteCount && supabaseCount) {
  console.log(`\n📊 Total games comparison:`);
  console.log(`   SQLite: ${sqliteCount.count.toLocaleString()}`);
  console.log(`   Supabase: ${supabaseCount.toLocaleString()}`);
  if (sqliteCount.count !== supabaseCount) {
    console.log(`   ⚠️  Difference: ${Math.abs(sqliteCount.count - supabaseCount).toLocaleString()}`);
  } else {
    console.log(`   ✅ Counts match perfectly!`);
  }
}

if (errors.length > 0) {
  console.log(`\n❌ Errors found (${errors.length}):`);
  errors.slice(0, 10).forEach(error => {
    console.log(`   ID ${error.id} (${error.name}): ${error.error}`);
  });
  if (errors.length > 10) {
    console.log(`   ... and ${errors.length - 10} more errors`);
  }
}

console.log('\n💡 Recommendations:');
if (matchCount === sqliteGames.length) {
  console.log('✅ All IDs match perfectly! Your databases are in sync.');
} else if (matchCount / sqliteGames.length > 0.9) {
  console.log('⚠️  Most IDs match, but some discrepancies exist. Consider investigating further.');
} else {
  console.log('❌ Significant ID mismatches detected. Database sync issues need attention.');
}

process.exit(matchCount === sqliteGames.length ? 0 : 1);