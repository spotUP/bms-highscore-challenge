#!/usr/bin/env npx tsx

import { supabase } from '../src/integrations/supabase/client';

async function findGamesWithYouTube() {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('name, platform_name, video_url')
      .not('video_url', 'is', null)
      .ilike('video_url', '%youtube%')
      .limit(10);

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('Games with YouTube videos:');
    console.log('==========================');

    data?.forEach(game => {
      console.log(`📺 ${game.name} (${game.platform_name})`);
      console.log(`   ${game.video_url}`);
      console.log('');
    });

  } catch (err) {
    console.error('Failed to query:', err);
  }
}

findGamesWithYouTube().then(() => process.exit(0));