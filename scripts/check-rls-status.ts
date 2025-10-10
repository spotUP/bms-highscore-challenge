import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function checkRLSStatus() {
  console.log('🔍 Checking RLS status for critical tables...\n');

  const tablesToCheck = [
    'admin_users',
    'user_roles',
    'tournament_members',
    'games',
    'user_role_cache'
  ];

  try {
    // Query RLS status from information_schema
    const { data: rlsData, error: rlsError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT
          schemaname,
          tablename,
          rowsecurity as rls_enabled
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('admin_users', 'user_roles', 'tournament_members', 'games', 'user_role_cache')
        ORDER BY tablename;
      `
    });

    if (rlsError) {
      console.error('Error querying RLS status:', rlsError);
      // Fallback: try direct query
      console.log('Trying fallback query...');

      for (const table of tablesToCheck) {
        try {
          const { data, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', table);

          if (error) {
            console.log(`❌ Error checking ${table}: ${error.message}`);
          } else {
            console.log(`✅ Found table: ${table}`);
          }
        } catch (e) {
          console.log(`⚠️  Exception checking ${table}: ${e}`);
        }
      }
    } else {
      console.log('RLS Status Results:');
      console.table(rlsData);
    }

    // Check for policies
    console.log('\n📋 Checking RLS policies...\n');

    for (const table of tablesToCheck) {
      try {
        const { data: policies, error } = await supabase
          .from('pg_policies')
          .select('*')
          .eq('schemaname', 'public')
          .eq('tablename', table);

        if (error) {
          console.log(`❌ Error checking policies for ${table}: ${error.message}`);
        } else {
          console.log(`${table}: ${policies?.length || 0} policies`);
          if (policies && policies.length > 0) {
            policies.forEach(policy => {
              console.log(`  - ${policy.policyname} (${policy.cmd})`);
            });
          }
        }
      } catch (e) {
        console.log(`⚠️  Exception checking policies for ${table}: ${e}`);
      }
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

checkRLSStatus().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});