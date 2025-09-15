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

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function addUserAsTournamentAdmin() {
  console.log('👑 Adding user as tournament admin...\n');

  const tournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d';
  const userId = '0f0672de-6b1a-49e1-8857-41fef18dc6f8';

  // First, check if user already exists in tournament_members
  console.log('🔍 Checking existing tournament membership...');
  const { data: existingMember, error: checkError } = await supabase
    .from('tournament_members')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    console.error('❌ Error checking membership:', checkError);
    return;
  }

  if (existingMember) {
    console.log('✅ User is already a tournament member');
    console.log('Current role:', existingMember.role);

    if (existingMember.role === 'owner' || existingMember.role === 'admin') {
      console.log('✅ User already has admin privileges');
      return;
    }

    // Update to admin
    console.log('🔄 Updating user role to admin...');
    const { error: updateError } = await supabase
      .from('tournament_members')
      .update({ role: 'admin' })
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error updating role:', updateError);
    } else {
      console.log('✅ User role updated to admin');
    }
  } else {
    // Add as new admin member
    console.log('➕ Adding user as new admin member...');
    const { error: insertError } = await supabase
      .from('tournament_members')
      .insert({
        tournament_id: tournamentId,
        user_id: userId,
        role: 'admin',
        joined_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('❌ Error adding member:', insertError);
    } else {
      console.log('✅ User added as tournament admin');
    }
  }

  // Also ensure they have global admin role
  console.log('🌍 Checking global admin role...');
  const { data: globalRole, error: globalError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .single();

  if (globalError && globalError.code !== 'PGRST116') {
    console.error('❌ Error checking global role:', globalError);
    return;
  }

  if (!globalRole) {
    console.log('➕ Adding global admin role...');
    const { error: globalInsertError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'admin',
        created_at: new Date().toISOString()
      });

    if (globalInsertError) {
      console.error('❌ Error adding global role:', globalInsertError);
    } else {
      console.log('✅ Global admin role added');
    }
  } else {
    console.log('✅ User already has global admin role');
  }

  console.log('\n🎉 User permissions updated! Please refresh the page to see changes.');
}

addUserAsTournamentAdmin().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});