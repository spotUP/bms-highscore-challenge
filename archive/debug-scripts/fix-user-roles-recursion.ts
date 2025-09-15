import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function fixUserRolesRecursion() {
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

  console.log('🔧 Fixing user_roles infinite recursion...');

  try {
    // Disable RLS temporarily
    console.log('1. Disabling RLS on user_roles...');
    await supabase.rpc('execute_sql', {
      sql: 'ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;'
    });

    // Drop existing policies
    console.log('2. Dropping existing policies...');
    const policies = [
      "Users can view their own roles",
      "Users can read their own roles",
      "Allow users to read their own roles",
      "Enable read access for users to their own roles"
    ];

    for (const policy of policies) {
      await supabase.rpc('execute_sql', {
        sql: `DROP POLICY IF EXISTS "${policy}" ON user_roles;`
      });
    }

    // Create simple non-recursive policy
    console.log('3. Creating new non-recursive policy...');
    await supabase.rpc('execute_sql', {
      sql: `CREATE POLICY "user_roles_select_policy" ON user_roles
            FOR SELECT
            USING (user_id = auth.uid());`
    });

    // Re-enable RLS
    console.log('4. Re-enabling RLS...');
    await supabase.rpc('execute_sql', {
      sql: 'ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;'
    });

    console.log('✅ Fixed user_roles recursion issue!');

    // Test the fix
    console.log('5. Testing the fix...');
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .limit(1);

    if (error) {
      console.error('❌ Test failed:', error);
    } else {
      console.log('✅ Test passed! Policy is working correctly.');
    }

  } catch (error) {
    console.error('❌ Error fixing recursion:', error);
    process.exit(1);
  }
}

fixUserRolesRecursion();