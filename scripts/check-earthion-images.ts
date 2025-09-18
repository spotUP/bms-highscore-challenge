#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tnsgrwntmnzpaifmutqh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuc2dyd250bW56cGFpZm11dHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjYwNzc1MzQsImV4cCI6MjA0MTY1MzUzNH0.hSOVymBCUjXCqTzqPcaJJqn2ps-E2cjdoYI0f9QE9mo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEarthionImages() {
  console.log('Checking Earthion image data...');

  const { data, error } = await supabase
    .from('games_database')
    .select('id, name, cover_url, screenshot_url, logo_url, video_url, database_id')
    .ilike('name', '%earthion%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    data.forEach((game) => {
      console.log('Game ID:', game.id);
      console.log('Database ID:', game.database_id);
      console.log('Name:', game.name);
      console.log('Cover URL:', game.cover_url || 'null');
      console.log('Screenshot URL:', game.screenshot_url || 'null');
      console.log('Logo URL:', game.logo_url || 'null');
      console.log('Video URL:', game.video_url || 'null');

      // Check if we can construct LaunchBox image URLs
      if (game.database_id) {
        const imageTypes = [
          { type: 'clearlogo', url: `https://images.launchbox-app.com/clearlogo/${game.database_id}-01.png` },
          { type: 'box-3d', url: `https://images.launchbox-app.com/box-3d/${game.database_id}-01.png` },
          { type: 'boxfront', url: `https://images.launchbox-app.com/boxfront/${game.database_id}-01.png` },
          { type: 'screenshot', url: `https://images.launchbox-app.com/screenshot/${game.database_id}-01.png` },
          { type: 'banner', url: `https://images.launchbox-app.com/banner/${game.database_id}-01.png` },
        ];

        console.log('');
        console.log('Potential LaunchBox images:');
        imageTypes.forEach(({ type, url }) => {
          console.log(`${type}: ${url}`);
        });
      }

      console.log('---');
    });
  } else {
    console.log('No Earthion games found');
  }
}

checkEarthionImages();