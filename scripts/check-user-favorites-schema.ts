#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkSchema() {
  console.log('🔍 Checking user_favorites table schema...');

  try {
    // First, try to get table info using Supabase's introspection
    const { data, error } = await supabase
      .from('user_favorites')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error querying user_favorites:', error);
      return;
    }

    console.log('✅ Table exists and is queryable');
    console.log('📋 Sample row structure:', data[0] || 'No data');

    // Try inserting a test record to see the exact error
    console.log('🧪 Testing insert with integer game_id...');
    const testInsert = {
      user_id: '0f0672de-6b1a-49e1-8857-41fef18dc6f8', // Your user ID
      game_id: -29101, // Integer
      game_name: 'Test Game'
    };

    const { error: insertError } = await supabase
      .from('user_favorites')
      .insert(testInsert);

    if (insertError) {
      console.error('❌ Insert error:', insertError);
    } else {
      console.log('✅ Insert successful, cleaning up...');
      // Clean up test record
      await supabase
        .from('user_favorites')
        .delete()
        .eq('game_name', 'Test Game');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSchema().then(() => process.exit(0));