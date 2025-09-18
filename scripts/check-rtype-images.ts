#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tnsgrwntmnzpaifmutqh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuc2dyd250bW56cGFpZm11dHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjYwNzc1MzQsImV4cCI6MjA0MTY1MzUzNH0.hSOVymBCUjXCqTzqPcaJJqn2ps-E2cjdoYI0f9QE9mo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRTypeLeoImages() {
  console.log('Checking R-Type Leo image data...');

  const { data, error } = await supabase
    .from('games_database')
    .select('id, name, cover_url, screenshot_url, logo_url, video_url, database_id')
    .eq('name', 'R-Type Leo')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data) {
    console.log('Game ID:', data.id);
    console.log('Database ID:', data.database_id);
    console.log('Name:', data.name);
    console.log('Cover URL:', data.cover_url || 'null');
    console.log('Screenshot URL:', data.screenshot_url || 'null');
    console.log('Logo URL:', data.logo_url || 'null');
    console.log('Video URL:', data.video_url || 'null');

    // Check if we can construct LaunchBox image URLs
    if (data.database_id) {
      const imageTypes = [
        { type: 'clearlogo', url: `https://images.launchbox-app.com/clearlogo/${data.database_id}-01.png` },
        { type: 'box-3d', url: `https://images.launchbox-app.com/box-3d/${data.database_id}-01.png` },
        { type: 'boxfront', url: `https://images.launchbox-app.com/boxfront/${data.database_id}-01.png` },
        { type: 'screenshot', url: `https://images.launchbox-app.com/screenshot/${data.database_id}-01.png` },
        { type: 'banner', url: `https://images.launchbox-app.com/banner/${data.database_id}-01.png` },
      ];

      console.log('');
      console.log('Checking LaunchBox images:');
      for (const { type, url } of imageTypes) {
        try {
          const response = await fetch(url, { method: 'HEAD' });
          console.log(`${type}: ${response.ok ? '✅ EXISTS' : '❌ missing'}`);
          if (response.ok) {
            console.log(`  URL: ${url}`);
          }
        } catch (e) {
          console.log(`${type}: ❌ error`);
        }
      }
    }

    // Check if images exist
    if (!data.cover_url && !data.screenshot_url) {
      console.log('');
      console.log('⚠️  No stored images - will fall back to RAWG API');
      console.log('This means RAWG will search for: "' + data.name + '"');
    }
  }
}

checkRTypeLeoImages();