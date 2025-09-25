#!/usr/bin/env tsx

// Remove Nintendo DS and Nintendo Wii from Supabase games_database table

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function removeNintendoPlatforms() {
  console.log('🗑️ Removing Nintendo DS and Nintendo Wii from Supabase games_database...');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration:');
    console.error('   VITE_SUPABASE_URL');
    console.error('   SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Remove Nintendo DS
  console.log('🗑️ Removing Nintendo DS games...');
  const { error: dsError, count: dsCount } = await supabase
    .from('games_database')
    .delete()
    .eq('platform_name', 'Nintendo DS');

  if (dsError) {
    console.error('❌ Error removing Nintendo DS:', dsError);
  } else {
    console.log(`✅ Removed ${dsCount || 0} Nintendo DS games`);
  }

  // Remove Nintendo Wii
  console.log('🗑️ Removing Nintendo Wii games...');
  const { error: wiiError, count: wiiCount } = await supabase
    .from('games_database')
    .delete()
    .eq('platform_name', 'Nintendo Wii');

  if (wiiError) {
    console.error('❌ Error removing Nintendo Wii:', wiiError);
  } else {
    console.log(`✅ Removed ${wiiCount || 0} Nintendo Wii games`);
  }

  console.log('🎉 Nintendo platform removal completed!');
}

removeNintendoPlatforms().catch(console.error);