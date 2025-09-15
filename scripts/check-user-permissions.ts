import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserPermissions() {
  console.log('🔍 Checking user permissions for button visibility...\n');

  const tournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d';
  const userId = '0f0672de-6b1a-49e1-8857-41fef18dc6f8';

  // Check tournament details
  console.log('1. Tournament details:');
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tournamentError) {
    console.error('❌ Tournament Error:', tournamentError);
  } else {
    console.log(`✅ Tournament: ${tournament.name}`);
    console.log(`   Created by: ${tournament.created_by || 'null'}`);
    console.log(`   User is creator: ${tournament.created_by === userId}`);
  }

  // Check user roles
  console.log('\n2. User roles:');
  const { data: userRoles, error: rolesError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId);

  if (rolesError) {
    console.error('❌ User Roles Error:', rolesError);
  } else {
    console.log(`✅ User has ${userRoles.length} role(s):`);
    userRoles.forEach(role => {
      console.log(`   - ${role.role}`);
    });
  }

  // Check tournament membership
  console.log('\n3. Tournament membership:');
  const { data: membership, error: membershipError } = await supabase
    .from('tournament_members')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId);

  if (membershipError) {
    console.error('❌ Membership Error:', membershipError);
  } else {
    console.log(`✅ User has ${membership.length} membership(s):`);
    membership.forEach(member => {
      console.log(`   - Role: ${member.role}, Status: ${member.status}`);
    });
  }

  // Determine button visibility logic
  console.log('\n4. Button visibility logic:');
  const isCreator = tournament && tournament.created_by === userId;
  const hasAdmin = userRoles.some(role => role.role === 'admin');
  const hasOwnerMembership = membership.some(m => m.role === 'owner');

  const shouldSeeButtons = isCreator || hasAdmin || hasOwnerMembership;

  console.log(`   Is tournament creator: ${isCreator}`);
  console.log(`   Has admin role: ${hasAdmin}`);
  console.log(`   Has owner membership: ${hasOwnerMembership}`);
  console.log(`   Should see buttons: ${shouldSeeButtons}`);

  if (!shouldSeeButtons) {
    console.log('\n⚠️  ISSUE: User should not see the buttons with current permissions');
    console.log('   The buttons are only visible to tournament creators or admins');
  } else {
    console.log('\n✅ User should see the buttons!');
  }
}

checkUserPermissions().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});