#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tnsgrwntmnzpaifmutqh.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.log('Need service role key to update database');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateRTypeLeoId() {
  console.log('Updating R-Type Leo database_id from 12690 to 12244...');

  const { data, error } = await supabase
    .from('games_database')
    .update({ database_id: 12244 })
    .eq('name', 'R-Type Leo')
    .select();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Updated successfully:', data);
  }
}

updateRTypeLeoId();