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

async function debugAchievementLoading() {
  console.log('🔍 Debugging achievement loading logic...\n');

  const tournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d';
  const userId = '0f0672de-6b1a-49e1-8857-41fef18dc6f8';

  // Check tournament details
  console.log('1. Checking tournament details...');
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tournamentError) {
    console.error('❌ Tournament Error:', tournamentError);
  } else {
    console.log('✅ Tournament found:', {
      id: tournament.id,
      name: tournament.name,
      created_by: tournament.created_by,
      userIsTournamentCreator: tournament.created_by === userId
    });
  }

  // Check user roles
  console.log('\n2. Checking user roles...');
  const { data: userRoles, error: rolesError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId);

  if (rolesError) {
    console.error('❌ User Roles Error:', rolesError);
  } else {
    console.log('✅ User roles:', userRoles);
  }

  // Check tournament members
  console.log('\n3. Checking tournament membership...');
  const { data: membership, error: membershipError } = await supabase
    .from('tournament_members')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId);

  if (membershipError) {
    console.error('❌ Membership Error:', membershipError);
  } else {
    console.log('✅ User membership:', membership);
  }

  // Test the loading logic that would be used in the component
  console.log('\n4. Testing achievement loading logic...');

  const isTournamentCreator = tournament && tournament.created_by === userId;
  console.log('Is tournament creator:', isTournamentCreator);

  if (isTournamentCreator) {
    console.log('Loading achievements as tournament creator...');
    const { data: creatorData, error: creatorError } = await supabase
      .from('achievements')
      .select('id,name,description,type,badge_icon,badge_color,criteria,points,is_active,created_at,updated_at,tournament_id,created_by')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });

    if (creatorError) {
      console.error('❌ Creator query error:', creatorError);
    } else {
      console.log(`✅ Creator query returned ${creatorData?.length || 0} achievements`);
    }
  } else if (userId) {
    console.log('Loading achievements as regular user...');
    const { data: userData, error: userError } = await supabase
      .from('achievements')
      .select('id,name,description,type,badge_icon,badge_color,criteria,points,is_active,created_at,updated_at,tournament_id,created_by')
      .eq('tournament_id', tournamentId)
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (userError) {
      console.error('❌ User query error:', userError);
    } else {
      console.log(`✅ User query returned ${userData?.length || 0} achievements`);
    }
  } else {
    console.log('Loading achievements via RPC fallback...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_tournament_achievements', {
      p_tournament_id: tournamentId
    });

    if (rpcError) {
      console.error('❌ RPC error:', rpcError);
    } else {
      console.log(`✅ RPC returned ${rpcData?.length || 0} achievements`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`- Tournament ID: ${tournamentId}`);
  console.log(`- User ID: ${userId}`);
  console.log(`- Is Tournament Creator: ${isTournamentCreator}`);
  console.log(`- Has User Roles: ${userRoles?.length > 0}`);
  console.log(`- Has Tournament Membership: ${membership?.length > 0}`);
}

debugAchievementLoading().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});