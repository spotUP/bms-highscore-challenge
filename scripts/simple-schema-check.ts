#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkSchema() {
  console.log('🔍 Checking current database schema...');

  // Check what tables exist by trying to query them
  const tables = ['games', 'games_database', 'platforms'];

  for (const table of tables) {
    console.log(`\n📋 Checking table: ${table}`);

    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);

      if (error) {
        console.log(`❌ Table ${table} error:`, error.message);
      } else {
        console.log(`✅ Table ${table} exists`);
        if (data && data.length > 0) {
          console.log(`📊 Sample columns:`, Object.keys(data[0]));
        } else {
          console.log(`📊 Table ${table} is empty`);
        }

        // Get the count
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        console.log(`📈 Record count: ${count}`);
      }
    } catch (err) {
      console.log(`❌ Error checking ${table}:`, err);
    }
  }
}

checkSchema();