import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function fixRLSDirect() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Required:');
    console.log('- VITE_SUPABASE_URL');
    console.log('- SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('🔧 Fixing RLS policies with service role...');

  // Use service role which should bypass RLS
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  });

  try {
    // Test 1: Try direct insertion with service role
    console.log('🧪 Testing direct score insertion with service role...');

    const testScore = {
      player_name: 'TEST',
      score: 12345,
      game_id: '95caf0d5-f28f-4dc0-b56d-695adf0aadc8', // Known game ID from previous tests
      tournament_id: 'bce0d5e5-2a88-45e2-b84d-86d73dd20dd5' // Known tournament ID
    };

    const { data: insertResult, error: insertError } = await supabase
      .from('scores')
      .insert(testScore)
      .select();

    if (insertError) {
      console.error('❌ Service role insertion failed:', insertError);

      // If service role fails, RLS is preventing even service role access
      console.log('🔧 Attempting to disable RLS temporarily...');

      // Try to check current policies
      console.log('📋 Checking current policies...');

      const { data: policies, error: policyError } = await supabase
        .rpc('exec_sql', {
          sql: `
            SELECT
              schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
            FROM pg_policies
            WHERE tablename = 'scores';
          `
        });

      if (policyError) {
        console.log('⚠️ Could not fetch policies via RPC');

        // Manual approach: provide SQL commands to run in dashboard
        console.log('\n📋 MANUAL FIXES REQUIRED:');
        console.log('Please run these commands in your Supabase SQL Editor:');
        console.log('');
        console.log('-- Step 1: Drop all existing RLS policies on scores table');
        console.log('DROP POLICY IF EXISTS "Enable read access for all users" ON scores;');
        console.log('DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON scores;');
        console.log('DROP POLICY IF EXISTS "Users can insert their own scores" ON scores;');
        console.log('DROP POLICY IF EXISTS "scores_select_policy" ON scores;');
        console.log('DROP POLICY IF EXISTS "scores_insert_policy" ON scores;');
        console.log('DROP POLICY IF EXISTS "scores_update_policy" ON scores;');
        console.log('DROP POLICY IF EXISTS "scores_delete_policy" ON scores;');
        console.log('');
        console.log('-- Step 2: Create permissive policies');
        console.log('CREATE POLICY "public_scores_select" ON scores FOR SELECT USING (true);');
        console.log('CREATE POLICY "public_scores_insert" ON scores FOR INSERT WITH CHECK (true);');
        console.log('CREATE POLICY "public_scores_update" ON scores FOR UPDATE USING (true) WITH CHECK (true);');
        console.log('CREATE POLICY "public_scores_delete" ON scores FOR DELETE USING (true);');
        console.log('');
        console.log('-- Step 3: Ensure RLS is enabled but permissive');
        console.log('ALTER TABLE scores ENABLE ROW LEVEL SECURITY;');
        console.log('');
        console.log('-- Step 4: Grant permissions');
        console.log('GRANT ALL ON scores TO anon;');
        console.log('GRANT ALL ON scores TO authenticated;');
        console.log('GRANT ALL ON scores TO service_role;');

      } else {
        console.log('📋 Current policies:', policies);
      }

    } else {
      console.log('✅ Service role insertion successful!');
      console.log('Inserted score:', insertResult);

      // Clean up test score
      if (insertResult && insertResult[0]) {
        await supabase
          .from('scores')
          .delete()
          .eq('id', insertResult[0].id);
        console.log('🧹 Cleaned up test score');
      }

      // Test with anonymous client (like the browser)
      console.log('\n🧪 Testing with anonymous client (browser simulation)...');

      const anonSupabase = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY!);

      const { data: anonResult, error: anonError } = await anonSupabase
        .from('scores')
        .insert({
          player_name: 'ANON',
          score: 999,
          game_id: '95caf0d5-f28f-4dc0-b56d-695adf0aadc8',
          tournament_id: 'bce0d5e5-2a88-45e2-b84d-86d73dd20dd5'
        });

      if (anonError) {
        console.error('❌ Anonymous insertion still failing:', anonError);
        console.log('RLS policies are still too restrictive for anonymous users');
      } else {
        console.log('✅ Anonymous insertion works!');
        console.log('🎉 Score submission should now work in the browser!');

        // Clean up
        if (anonResult && anonResult[0]) {
          await supabase
            .from('scores')
            .delete()
            .eq('id', anonResult[0].id);
        }
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixRLSDirect();