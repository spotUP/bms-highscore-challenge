#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSupabasePlatforms() {
  try {
    console.log('🔍 Checking platforms in Supabase games_database...');

    const { data, error } = await supabase
      .from('games_database')
      .select('platform_name')
      .not('platform_name', 'is', null);

    if (error) {
      console.error('Error querying platforms:', error);
      return;
    }

    if (!data) {
      console.log('No data returned');
      return;
    }

    // Count platforms
    const platformCounts: Record<string, number> = {};
    data.forEach(row => {
      if (row.platform_name) {
        platformCounts[row.platform_name] = (platformCounts[row.platform_name] || 0) + 1;
      }
    });

    const sortedPlatforms = Object.entries(platformCounts)
      .sort((a, b) => b[1] - a[1]) // Sort by count, descending
      .slice(0, 30); // Top 30 platforms

    console.log(`📊 Found ${Object.keys(platformCounts).length} unique platforms in Supabase`);
    console.log(`📋 Total games: ${data.length}`);
    console.log('\n📋 Top 30 platforms by game count:');

    sortedPlatforms.forEach(([platform, count], index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${platform.padEnd(40)} (${count} games)`);
    });

  } catch (error) {
    console.error('Script error:', error);
  }
}

checkSupabasePlatforms().catch(console.error);