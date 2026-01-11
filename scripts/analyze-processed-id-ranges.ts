import sqlite3 from 'sqlite3';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeIdRanges() {
  console.log('🔍 Analyzing processed vs unprocessed ID ranges...\n');

  // Check SQLite for processed games
  const db = new sqlite3.Database('production-turbo-logos.db');

  const sqliteStats = await new Promise<{ min: number, max: number, count: number }>((resolve) => {
    db.get('SELECT MIN(id) as min, MAX(id) as max, COUNT(*) as count FROM games', (err, row: any) => {
      if (err) {
        console.error('❌ Error querying SQLite:', err);
        resolve({ min: 0, max: 0, count: 0 });
      } else {
        resolve({ min: row.min || 0, max: row.max || 0, count: row.count || 0 });
      }
    });
  });

  console.log('📊 SQLite Analysis (Processed Games):');
  console.log(`   Total Processed: ${sqliteStats.count.toLocaleString()}`);
  console.log(`   ID Range: ${sqliteStats.min} to ${sqliteStats.max}`);

  // Get sample of processed IDs
  const sampleProcessed = await new Promise<any[]>((resolve) => {
    db.all('SELECT id, name, platform_name FROM games ORDER BY id LIMIT 10', (err, rows) => {
      if (err) {
        console.error('❌ Error getting sample:', err);
        resolve([]);
      } else {
        resolve(rows);
      }
    });
  });

  console.log('\n🎯 Sample of Processed Games (first 10):');
  sampleProcessed.forEach(game => {
    console.log(`   ID ${game.id}: "${game.name}" (${game.platform_name})`);
  });

  // Check Supabase for total range
  const { data: supabaseRange, error: rangeError } = await supabase
    .from('games_database')
    .select('id')
    .order('id', { ascending: true })
    .limit(1);

  const { data: supabaseMax, error: maxError } = await supabase
    .from('games_database')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);

  if (!rangeError && !maxError && supabaseRange && supabaseMax) {
    console.log('\n📊 Supabase Analysis (All Games):');
    console.log(`   Total Games: 169,625`);
    console.log(`   ID Range: ${supabaseRange[0].id} to ${supabaseMax[0].id}`);
  }

  // Check for gaps in processing
  console.log('\n🔍 Checking for gaps in processing...');

  // Find unprocessed games in different ID ranges
  const checkRanges = [
    { start: 1, end: 10000, name: '1-10K' },
    { start: 10001, end: 50000, name: '10K-50K' },
    { start: 50001, end: 100000, name: '50K-100K' },
    { start: 100001, end: 150000, name: '100K-150K' },
    { start: 150001, end: 200000, name: '150K-200K' },
    { start: 200001, end: 250000, name: '200K-250K' }
  ];

  for (const range of checkRanges) {
    // Get unprocessed count in this range
    const { count: unprocessedCount, error: unprocessedError } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true })
      .gte('id', range.start)
      .lte('id', range.end);

    if (!unprocessedError) {
      console.log(`   Range ${range.name}: ${(unprocessedCount || 0).toLocaleString()} total games`);
    }
  }

  // Check recent processed range
  const recentProcessed = await new Promise<any[]>((resolve) => {
    db.all('SELECT id, name, platform_name FROM games ORDER BY id DESC LIMIT 10', (err, rows) => {
      if (err) {
        console.error('❌ Error getting recent:', err);
        resolve([]);
      } else {
        resolve(rows);
      }
    });
  });

  console.log('\n🎯 Most Recently Processed Games (last 10):');
  recentProcessed.forEach(game => {
    console.log(`   ID ${game.id}: "${game.name}" (${game.platform_name})`);
  });

  // Check what the next unprocessed ID would be
  const { data: nextUnprocessed, error: nextError } = await supabase
    .from('games_database')
    .select('id, name, platform_name')
    .gt('id', sqliteStats.max)
    .order('id', { ascending: true })
    .limit(5);

  if (!nextError && nextUnprocessed) {
    console.log('\n➡️  Next Unprocessed Games:');
    nextUnprocessed.forEach(game => {
      console.log(`   ID ${game.id}: "${game.name}" (${game.platform_name})`);
    });
  }

  db.close();
}

analyzeIdRanges();