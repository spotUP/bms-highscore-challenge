#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkPlatforms() {
  // Get platforms for games currently being processed
  const gameIds = [403903, 98608, 397286, 98559]; // Current games from progress

  const { data, error } = await supabase
    .from('games_database')
    .select('id, name, platform_name')
    .in('id', gameIds);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Current games and their platforms:');
  data?.forEach(game => {
    console.log(`- ${game.name} (ID: ${game.id}) - Platform: ${game.platform_name || 'Unknown'}`);
  });

  // Also get a sample of platform distribution in recent ID ranges
  const { data: platforms, error: platError } = await supabase
    .from('games_database')
    .select('platform_name')
    .gte('id', 80000)
    .lte('id', 410000)
    .limit(1000);

  if (!platError && platforms) {
    const platformCounts: Record<string, number> = {};
    platforms.forEach(p => {
      const platform = p.platform_name || 'Unknown';
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });

    console.log('\nPlatform distribution in ID range 80k-410k (sample):');
    Object.entries(platformCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .forEach(([platform, count]) => {
        console.log(`- ${platform}: ${count} games`);
      });
  }
}

checkPlatforms().catch(console.error);