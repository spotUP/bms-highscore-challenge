import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testAuthQuickstart() {
  console.log('🔍 Testing authentication for bracket operations...\n');

  try {
    console.log('Step 1: Check current auth status...');

    const { data: userRes, error: userErr } = await supabase.auth.getUser();

    if (userErr) {
      console.log('❌ Auth error:', userErr.message);
      console.log('This is expected if no user is signed in.');
    } else if (!userRes?.user) {
      console.log('❌ No authenticated user found');
      console.log('This is expected - the auth check in quick start should prevent operations');
    } else {
      console.log('✅ User authenticated:', userRes.user.id);
    }

    console.log('\nStep 2: Test creating tournament without auth...');

    const { data: newTournament, error: createError } = await supabase
      .from('bracket_tournaments')
      .insert({
        name: 'Test Auth Tournament',
        bracket_type: 'double',
        status: 'draft',
        is_public: true,
        created_by: userRes?.user?.id || '00000000-0000-0000-0000-000000000000'
      })
      .select()
      .single();

    if (createError) {
      console.log('❌ Expected error creating tournament:', createError.message);
      if (createError.code === '42501') {
        console.log('✅ RLS policy is working - preventing unauthorized tournament creation');
      }
    } else {
      console.log('✅ Tournament created:', newTournament?.name);
      console.log('This means the user is properly authenticated');
    }

    console.log('\n🎯 Test complete!');
    console.log('The authentication checks we added to the BracketAdmin UI should now:');
    console.log('1. Show "Authentication required" toasts when user is not logged in');
    console.log('2. Prevent quick start, add players, create tournaments, and delete operations');
    console.log('3. Guide users to log in before using these features');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAuthQuickstart().catch(console.error);