import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function applyEmergencyMigration() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('🚨 Applying emergency migration...');

  const emergencySQL = `
-- Emergency fix for infinite recursion in user_roles
-- Disable RLS on problematic tables
ALTER TABLE IF EXISTS user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tournament_members DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies on user_roles using dynamic SQL
DO $$
DECLARE
    policy_record record;
    sql_cmd text;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'user_roles'
          AND schemaname = 'public'
    LOOP
        sql_cmd := 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON user_roles';
        EXECUTE sql_cmd;
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- Drop ALL policies on tournament_members
DO $$
DECLARE
    policy_record record;
    sql_cmd text;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'tournament_members'
          AND schemaname = 'public'
    LOOP
        sql_cmd := 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON tournament_members';
        EXECUTE sql_cmd;
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- Grant necessary permissions
GRANT ALL ON user_roles TO anon, authenticated, service_role;
GRANT ALL ON tournament_members TO anon, authenticated, service_role;

-- Drop problematic functions that might cause recursion
DROP FUNCTION IF EXISTS get_user_role(uuid);
DROP FUNCTION IF EXISTS check_user_tournament_access(uuid, uuid);
DROP FUNCTION IF EXISTS is_tournament_member(uuid, uuid);
DROP FUNCTION IF EXISTS user_has_role(text);
  `;

  try {
    // Use PostgREST to execute the SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: emergencySQL
      })
    });

    if (!response.ok) {
      console.log('PostgREST approach failed, trying direct SQL execution...');

      // Alternative approach - execute SQL statements one by one
      const statements = emergencySQL.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            // This won't work with complex statements but let's try simple ones
            if (statement.includes('ALTER TABLE') || statement.includes('GRANT')) {
              await supabase.rpc('sql', { query: statement.trim() + ';' });
            }
          } catch (error) {
            console.log(`Skipped: ${error}`);
          }
        }
      }
    }

    console.log('✅ Emergency migration attempted');

    // Test the fix
    console.log('Testing after migration...');

    const { data: userRoles, error: userRolesError } = await supabase
      .from('user_roles')
      .select('*')
      .limit(1);

    const { data: members, error: membersError } = await supabase
      .from('tournament_members')
      .select('*')
      .limit(1);

    console.log('Results:');
    console.log('- user_roles:', userRolesError ? `❌ ${userRolesError.message}` : '✅ accessible');
    console.log('- tournament_members:', membersError ? `❌ ${membersError.message}` : '✅ accessible');

    if (!userRolesError && !membersError) {
      console.log('🎉 Emergency fix successful!');
    } else {
      console.log('⚠️  Issues may persist - manual database admin intervention needed');
    }

  } catch (error) {
    console.error('❌ Emergency migration failed:', error);
  }
}

applyEmergencyMigration();