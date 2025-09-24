#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import sqlite3 from 'sqlite3';
import { existsSync } from 'fs';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkLogoDatabaseState() {
  console.log('🔍 Checking logo database state across all sources...\n');

  // Check Supabase games_database logo columns
  console.log('📊 Supabase games_database logo fields:');
  try {
    const { count: totalGames, error: totalError } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    const { count: logoBase64Count, error: logoBase64Error } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true })
      .not('logo_base64', 'is', null)
      .neq('logo_base64', '');

    if (logoBase64Error) throw logoBase64Error;

    const { count: logoUrlCount, error: logoUrlError } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true })
      .not('logo_url', 'is', null)
      .neq('logo_url', '');

    if (logoUrlError) throw logoUrlError;

    console.log(`   Total games: ${totalGames}`);
    console.log(`   Games with logo_base64: ${logoBase64Count} (${((logoBase64Count / totalGames) * 100).toFixed(1)}%)`);
    console.log(`   Games with logo_url: ${logoUrlCount} (${((logoUrlCount / totalGames) * 100).toFixed(1)}%)`);

  } catch (error) {
    console.error('❌ Error checking Supabase:', error);
  }

  // Check SQLite databases
  console.log('\n💾 SQLite logo databases:');

  const sqliteFiles = [
    'production-turbo-logos.db',
    'logo-scraper.db',
    'logos.db'
  ];

  for (const dbFile of sqliteFiles) {
    if (existsSync(dbFile)) {
      console.log(`\n   📁 ${dbFile}:`);

      const db = new sqlite3.Database(dbFile);

      try {
        // Get table info
        const tables = await new Promise<any[]>((resolve, reject) => {
          db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });

        console.log(`      Tables: ${tables.map(t => t.name).join(', ')}`);

        // Check games table if it exists
        if (tables.some(t => t.name === 'games')) {
          const totalCount = await new Promise<number>((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM games", (err, row: any) => {
              if (err) reject(err);
              else resolve(row.count);
            });
          });

          const logoCount = await new Promise<number>((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM games WHERE logo_base64 IS NOT NULL AND logo_base64 != ''", (err, row: any) => {
              if (err) reject(err);
              else resolve(row.count);
            });
          });

          console.log(`      Total records: ${totalCount}`);
          console.log(`      Records with logos: ${logoCount} (${((logoCount / totalCount) * 100).toFixed(1)}%)`);
        }

      } catch (error) {
        console.log(`      ❌ Error reading database: ${error}`);
      }

      db.close();
    } else {
      console.log(`   ❌ ${dbFile}: Not found`);
    }
  }

  // Check progress files
  console.log('\n📄 Progress files:');

  const progressFiles = [
    'production-turbo-progress.json',
    'hybrid-checkpoint-1.json',
    'hybrid-checkpoint-2.json',
    'public/production-scraper-progress.json'
  ];

  for (const file of progressFiles) {
    if (existsSync(file)) {
      try {
        const fs = await import('fs');
        const content = JSON.parse(fs.readFileSync(file, 'utf8'));
        console.log(`   ✅ ${file}:`);
        if (content['0']) {
          const progress = content['0'];
          console.log(`      Processed: ${progress.processedGames || 0}`);
          console.log(`      Successful: ${progress.successfulLogos || 0}`);
          console.log(`      Failed: ${progress.failedLogos || 0}`);
          console.log(`      Status: ${progress.status || 'unknown'}`);
          console.log(`      Last update: ${progress.lastUpdate || 'unknown'}`);
        }
      } catch (error) {
        console.log(`   ❌ ${file}: Error reading - ${error}`);
      }
    } else {
      console.log(`   ❌ ${file}: Not found`);
    }
  }

  console.log('\n🔍 Analysis complete!');
}

checkLogoDatabaseState().then(() => process.exit(0));