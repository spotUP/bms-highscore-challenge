#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkGamesSchema() {
  console.log('🔍 Checking games_database table schema...');

  try {
    const { data, error } = await supabase
      .from('games_database')
      .select('id, name, platform_name')
      .limit(5);

    if (error) {
      console.error('❌ Error querying games_database:', error);
      return;
    }

    console.log('✅ games_database sample rows:');
    data?.forEach((row, idx) => {
      console.log(`${idx + 1}. ID: ${row.id} (type: ${typeof row.id}) - ${row.name} (${row.platform_name})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkGamesSchema().then(() => process.exit(0));