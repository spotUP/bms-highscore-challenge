#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkPlatformsTable() {
  try {
    console.log('🔍 Checking platforms table...');

    const { data: platformsData, error: platformsError } = await supabase
      .from('platforms')
      .select('*')
      .order('name');

    if (platformsError) {
      console.error('Error querying platforms table:', platformsError);
      return;
    }

    console.log(`📊 Found ${platformsData?.length || 0} platforms in platforms table:`);
    platformsData?.forEach((platform, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${platform.name} (category: ${platform.category || 'null'})`);
    });

    console.log('\n🔍 Now checking how many games match these platforms...');

    // Get approved platform names
    const approvedPlatformNames = platformsData?.map(p => p.name) || [];

    const { data: gamesData, error: gamesError } = await supabase
      .from('games_database')
      .select('platform_name')
      .in('platform_name', approvedPlatformNames);

    if (gamesError) {
      console.error('Error querying games_database:', gamesError);
      return;
    }

    const matchingGameCounts: Record<string, number> = {};
    gamesData?.forEach(game => {
      if (game.platform_name) {
        matchingGameCounts[game.platform_name] = (matchingGameCounts[game.platform_name] || 0) + 1;
      }
    });

    console.log('\n📋 Games per approved platform:');
    Object.entries(matchingGameCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([platform, count]) => {
        console.log(`   ${platform}: ${count} games`);
      });

    console.log(`\n📊 Total games matching approved platforms: ${gamesData?.length || 0}`);
    console.log(`📊 Total games in database: ${(await supabase.from('games_database').select('id', { count: 'exact' })).count || 0}`);

  } catch (error) {
    console.error('Script error:', error);
  }
}

checkPlatformsTable().catch(console.error);