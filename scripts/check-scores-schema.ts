import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkScoresSchema() {
  console.log('🔍 Checking scores table schema...');

  try {
    // Use the psql equivalent to check table structure
    const { data, error } = await adminClient
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'scores')
      .eq('table_schema', 'public');

    if (error) {
      console.error('❌ Error checking schema:', error);
      return;
    }

    console.log('📋 Scores table columns:');
    data.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check if user_id column exists
    const hasUserId = data.some(col => col.column_name === 'user_id');
    console.log(`\n🔍 user_id column exists: ${hasUserId ? '✅ YES' : '❌ NO'}`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkScoresSchema();