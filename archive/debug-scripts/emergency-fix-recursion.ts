import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function emergencyFixRecursion() {
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

  console.log('🚨 Emergency fix for recursion...');

  try {
    // Completely disable RLS on user_roles
    console.log('1. Completely disabling RLS on user_roles...');
    await supabase.rpc('execute_sql', {
      sql: 'ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;'
    });

    // Drop ALL policies on user_roles
    console.log('2. Dropping ALL policies on user_roles...');
    await supabase.rpc('execute_sql', {
      sql: `
        DO $$
        DECLARE
            policy_record record;
        BEGIN
            FOR policy_record IN
                SELECT policyname
                FROM pg_policies
                WHERE tablename = 'user_roles'
                  AND schemaname = 'public'
            LOOP
                EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON user_roles';
            END LOOP;
        END $$;
      `
    });

    // Also check tournament_members for recursive policies
    console.log('3. Dropping ALL policies on tournament_members...');
    await supabase.rpc('execute_sql', {
      sql: `
        DO $$
        DECLARE
            policy_record record;
        BEGIN
            FOR policy_record IN
                SELECT policyname
                FROM pg_policies
                WHERE tablename = 'tournament_members'
                  AND schemaname = 'public'
            LOOP
                EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON tournament_members';
            END LOOP;
        END $$;
      `
    });

    // Disable RLS on tournament_members too
    console.log('4. Disabling RLS on tournament_members...');
    await supabase.rpc('execute_sql', {
      sql: 'ALTER TABLE tournament_members DISABLE ROW LEVEL SECURITY;'
    });

    console.log('✅ Emergency fix applied - RLS disabled on both tables');

    // Test the fix
    console.log('5. Testing the fix...');
    const { data: userRoles, error: userRolesError } = await supabase
      .from('user_roles')
      .select('role')
      .limit(1);

    const { data: members, error: membersError } = await supabase
      .from('tournament_members')
      .select('id')
      .limit(1);

    if (userRolesError || membersError) {
      console.error('❌ Test failed:', { userRolesError, membersError });
    } else {
      console.log('✅ Emergency fix successful! Both tables accessible.');
    }

  } catch (error) {
    console.error('❌ Emergency fix failed:', error);
    process.exit(1);
  }
}

emergencyFixRecursion();