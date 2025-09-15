import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function checkAchievementSchema() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  console.log('🔍 Checking achievement table schema...');

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Query the information schema to see what columns exist
    const { data, error } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'achievements'
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });

    if (error) {
      console.error('❌ Error querying schema:', error);
      return;
    }

    console.log('📋 Current achievements table schema:');
    console.table(data);

    // Also check player_achievements table
    const { data: paData, error: paError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'player_achievements'
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });

    if (!paError && paData) {
      console.log('\n📋 Current player_achievements table schema:');
      console.table(paData);
    }

    // Check if achievement_type enum exists
    const { data: enumData, error: enumError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT enumlabel
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'achievement_type'
          ORDER BY enumsortorder;
        `
      });

    if (!enumError && enumData) {
      console.log('\n📋 Achievement type enum values:');
      console.log(enumData.map(e => e.enumlabel));
    } else {
      console.log('\n❌ Achievement type enum not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAchievementSchema();