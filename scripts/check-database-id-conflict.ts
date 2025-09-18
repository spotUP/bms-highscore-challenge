#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tnsgrwntmnzpaifmutqh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuc2dyd250bW56cGFpZm11dHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjYwNzc1MzQsImV4cCI6MjA0MTY1MzUzNH0.hSOVymBCUjXCqTzqPcaJJqn2ps-E2cjdoYI0f9QE9mo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConflict() {
  console.log('Checking what games use database_id 12244 and 12690...');

  const { data: conflict, error: conflictError } = await supabase
    .from('games_database')
    .select('id, name, database_id')
    .eq('database_id', 12244);

  const { data: rtype, error: rtypeError } = await supabase
    .from('games_database')
    .select('id, name, database_id')
    .eq('database_id', 12690);

  if (conflictError || rtypeError) {
    console.error('Error:', conflictError || rtypeError);
    return;
  }

  console.log('Game with database_id 12244:', conflict);
  console.log('Game with database_id 12690:', rtype);
}

checkConflict();