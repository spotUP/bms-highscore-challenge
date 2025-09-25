#!/usr/bin/env tsx

// Check Supabase database size and table information

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function checkDatabaseSize() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📊 Checking Supabase database size and usage...\n');

  try {
    // Get table sizes using pg_stat_user_tables
    const { data: tableStats, error: statsError } = await supabase
      .rpc('get_table_sizes');

    if (statsError) {
      console.log('⚠️ Could not get table sizes directly, checking individual tables...\n');

      // Check main tables individually
      const tables = [
        'games_database',
        'platforms',
        'tournaments',
        'submissions',
        'users'
      ];

      for (const table of tables) {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (!error) {
          console.log(`📋 ${table}: ${count?.toLocaleString()} rows`);
        } else {
          console.log(`❌ ${table}: Error - ${error.message}`);
        }
      }
    } else {
      console.log('📊 Table sizes:');
      tableStats?.forEach((table: any) => {
        console.log(`  ${table.table_name}: ${table.size}`);
      });
    }

    // Check games_database specifically since it's our largest table
    console.log('\n🎮 Games Database Details:');
    const { count: gamesCount, error: gamesError } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true });

    if (!gamesError) {
      console.log(`  Total games: ${gamesCount?.toLocaleString()}`);

      // Check average row size by getting a sample
      const { data: sampleGames, error: sampleError } = await supabase
        .from('games_database')
        .select('*')
        .limit(100);

      if (!sampleError && sampleGames) {
        const avgRowSizeBytes = JSON.stringify(sampleGames).length / sampleGames.length;
        const estimatedTotalSizeKB = Math.round((gamesCount || 0) * avgRowSizeBytes / 1024);
        const estimatedTotalSizeMB = Math.round(estimatedTotalSizeKB / 1024);

        console.log(`  Estimated avg row size: ~${Math.round(avgRowSizeBytes)} bytes`);
        console.log(`  Estimated total size: ~${estimatedTotalSizeMB.toLocaleString()}MB`);
      }
    }

    // Check platforms table
    console.log('\n🕹️ Platforms:');
    const { count: platformsCount, error: platformsError } = await supabase
      .from('platforms')
      .select('*', { count: 'exact', head: true });

    if (!platformsError) {
      console.log(`  Total platforms: ${platformsCount?.toLocaleString()}`);
    }

    console.log('\n💾 Supabase Free Tier Limits:');
    console.log('  Database size: 500MB maximum');
    console.log('  Rows: No specific limit');
    console.log('  API requests: 50,000/month');
    console.log('  Bandwidth: 2GB/month');

  } catch (error) {
    console.error('❌ Error checking database:', error);
  }
}

checkDatabaseSize().catch(console.error);