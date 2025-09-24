#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function fixSuperMarioVideo() {
  console.log('🔄 Fixing Super Mario Bros video URL...');
  console.log('From: https://www.youtube.com/watch?v=rWp6KsHhjl0');
  console.log('To: https://www.youtube.com/watch?v=cWOkHQXw0JQ');
  console.log('');

  try {
    // First check current value
    const { data: current, error: selectError } = await supabase
      .from('games_database')
      .select('id, name, platform_name, video_url')
      .eq('id', -49860)
      .single();

    if (selectError) {
      console.log('❌ Error checking current value:', selectError);
      return;
    }

    console.log('Current record:');
    console.log('  ID:', current.id);
    console.log('  Name:', current.name);
    console.log('  Platform:', current.platform_name);
    console.log('  Current video URL:', current.video_url);
    console.log('');

    // Now update
    const { data, error } = await supabase
      .from('games_database')
      .update({
        video_url: 'https://www.youtube.com/watch?v=cWOkHQXw0JQ'
      })
      .eq('id', -49860)
      .select('id, name, platform_name, video_url');

    if (error) {
      console.log('❌ Update error:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Successfully updated Super Mario Bros video!');
      console.log('Updated record:');
      console.log('  ID:', data[0].id);
      console.log('  Name:', data[0].name);
      console.log('  Platform:', data[0].platform_name);
      console.log('  New video URL:', data[0].video_url);
      console.log('');
      console.log('🎬 The Super Mario Bros video should now work in the GameDetailsModal!');
    } else {
      console.log('⚠️ No records were updated');
    }
  } catch (error) {
    console.error('❌ Update failed:', error);
  }
}

fixSuperMarioVideo().then(() => process.exit(0));