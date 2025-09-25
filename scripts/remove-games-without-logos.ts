#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function removeGamesWithoutLogos() {
  try {
    console.log('🚀 Removing games without available logos from Supabase...\n');

    // Read the list of available logos
    console.log('📖 Reading available logos list...');
    const logoListData = await fs.readFile('available-logos-list.json', 'utf8');
    const availableLogos: string[] = JSON.parse(logoListData);

    console.log(`📊 Found ${availableLogos.length} games with available logos`);

    // Get current count in database
    const { count: totalCount, error: countError } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting games:', countError);
      return;
    }

    console.log(`📊 Current games in database: ${totalCount}`);

    // Delete games that don't have logos available
    console.log('\n🗑️  Removing games without available logos...');
    
    const { error: deleteError } = await supabase
      .from('games_database')
      .delete()
      .not('name', 'in', `(${availableLogos.map(name => `"${name.replace(/"/g, '""')}"`).join(',')})`);

    if (deleteError) {
      console.error('Error removing games without logos:', deleteError);
      return;
    }

    // Verify final count
    const { count: finalCount, error: finalCountError } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true });

    if (finalCountError) {
      console.error('Error counting final games:', finalCountError);
      return;
    }

    console.log(`\n🎉 Cleanup completed successfully!`);
    console.log(`📊 Games before cleanup: ${totalCount}`);
    console.log(`📊 Games after cleanup: ${finalCount}`);
    console.log(`📊 Games removed: ${totalCount - finalCount}`);
    console.log(`📈 Logo coverage: 100% (all remaining games have clear logos)`);
    console.log(`🎯 Expected final count: ${availableLogos.length}`);
    console.log(`🎯 Match: ${finalCount === availableLogos.length ? '✅' : '❌'}`);

    // Show platform breakdown
    const { data: platformData, error: platformError } = await supabase
      .from('games_database')
      .select('platform_name')
      .not('platform_name', 'is', null);

    if (!platformError && platformData) {
      const platformCounts: Record<string, number> = {};
      platformData.forEach(game => {
        const platform = game.platform_name || 'Unknown';
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      });

      console.log('\n📋 Final games by platform:');
      Object.entries(platformCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([platform, count]) => {
          console.log(`   ${platform}: ${count} games`);
        });
    }

  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

removeGamesWithoutLogos().catch(console.error);
