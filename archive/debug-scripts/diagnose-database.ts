import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function diagnoseDatabaseIssues() {
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

  console.log('🔍 Diagnosing database issues...');

  try {
    // Check if tables exist
    console.log('1. Checking table existence...');
    const { data: tables, error: tablesError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('user_roles', 'tournament_members', 'tournaments')
        ORDER BY table_name;
      `
    });

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
    } else {
      console.log('✅ Tables found:', tables);
    }

    // Check RLS status
    console.log('2. Checking RLS status...');
    const { data: rlsStatus, error: rlsError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT schemaname, tablename, rowsecurity, hasrls
        FROM pg_tables t
        LEFT JOIN pg_class c ON c.relname = t.tablename
        WHERE schemaname = 'public'
        AND tablename IN ('user_roles', 'tournament_members', 'tournaments');
      `
    });

    if (rlsError) {
      console.error('❌ Error checking RLS:', rlsError);
    } else {
      console.log('✅ RLS Status:', rlsStatus);
    }

    // Check policies
    console.log('3. Checking policies...');
    const { data: policies, error: policiesError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE tablename IN ('user_roles', 'tournament_members', 'tournaments')
        ORDER BY tablename, policyname;
      `
    });

    if (policiesError) {
      console.error('❌ Error checking policies:', policiesError);
    } else {
      console.log('✅ Policies found:', policies);
    }

    // Check functions that might cause recursion
    console.log('4. Checking functions...');
    const { data: functions, error: functionsError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT routine_name, routine_type, routine_definition
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND (routine_definition ILIKE '%user_roles%' OR routine_definition ILIKE '%tournament_members%')
        ORDER BY routine_name;
      `
    });

    if (functionsError) {
      console.error('❌ Error checking functions:', functionsError);
    } else {
      console.log('✅ Functions found:', functions);
    }

  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
}

diagnoseDatabaseIssues();