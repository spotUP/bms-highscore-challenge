#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function addTimestampColumn() {
  console.log('🔧 Adding logo_scraped_at timestamp column...');

  try {
    // Try to add the column - this will fail if it already exists
    const { error } = await supabase.rpc('exec_sql', {
      query: 'ALTER TABLE games_database ADD COLUMN logo_scraped_at TIMESTAMPTZ;'
    });

    if (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Column already exists');
      } else {
        console.error('❌ Error adding column:', error);
      }
    } else {
      console.log('✅ Added logo_scraped_at column successfully');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addTimestampColumn().catch(console.error);