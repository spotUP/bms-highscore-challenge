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

async function debugBrackets() {
  console.log('🔍 Debugging Bracket System...\n');

  try {
    // 1. Check if bracket tables exist and have data
    console.log('📋 Checking bracket_tournaments table...');
    const { data: tournaments, error: tError } = await supabase
      .from('bracket_tournaments')
      .select('*')
      .limit(5);

    if (tError) {
      console.error('❌ Error fetching tournaments:', tError.message);
    } else {
      console.log(`✅ Found ${tournaments?.length || 0} tournaments`);
      if (tournaments && tournaments.length > 0) {
        console.log('Sample tournament:', {
          id: tournaments[0].id,
          name: tournaments[0].name,
          created_by: tournaments[0].created_by
        });
      }
    }

    // 2. Check bracket_players table
    console.log('\n👥 Checking bracket_players table...');
    const { data: players, error: pError } = await supabase
      .from('bracket_players')
      .select('*')
      .limit(5);

    if (pError) {
      console.error('❌ Error fetching players:', pError.message);
    } else {
      console.log(`✅ Found ${players?.length || 0} players`);
      if (players && players.length > 0) {
        console.log('Sample player:', {
          id: players[0].id,
          name: players[0].name,
          tournament_id: players[0].tournament_id
        });
      }
    }

    // 3. Test inserting a player
    console.log('\n🧪 Testing player insertion...');
    const testTournament = tournaments?.[0];
    if (testTournament) {
      const { error: insertError } = await supabase
        .from('bracket_players')
        .insert([{
          tournament_id: testTournament.id,
          name: 'TEST_PLAYER_DEBUG'
        }]);

      if (insertError) {
        console.log('❌ Could not insert test player:', insertError.message);
        console.log('   Error details:', insertError);
      } else {
        console.log('✅ Successfully inserted test player');

        // Clean up
        await supabase
          .from('bracket_players')
          .delete()
          .eq('name', 'TEST_PLAYER_DEBUG');
        console.log('✅ Cleaned up test player');
      }
    } else {
      console.log('⚠️ No tournaments found, cannot test player insertion');
    }

    // 4. Check current user and permissions
    console.log('\n👤 Checking current user...');
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.log('❌ Not authenticated:', userError.message);
    } else if (userData.user) {
      console.log('✅ Authenticated as:', userData.user.id);
      console.log('   Email:', userData.user.email);
    } else {
      console.log('❌ No user data');
    }

    // 5. Check if current user owns any tournaments
    if (userData.user && tournaments && tournaments.length > 0) {
      const ownedTournaments = tournaments.filter(t => t.created_by === userData.user!.id);
      console.log(`\n🏆 User owns ${ownedTournaments.length} tournaments`);

      if (ownedTournaments.length > 0) {
        const ownedTournament = ownedTournaments[0];
        console.log('Testing with owned tournament:', ownedTournament.name);

        const { error: ownedInsertError } = await supabase
          .from('bracket_players')
          .insert([{
            tournament_id: ownedTournament.id,
            name: 'TEST_OWNED_PLAYER'
          }]);

        if (ownedInsertError) {
          console.log('❌ Could not insert player to owned tournament:', ownedInsertError.message);
        } else {
          console.log('✅ Successfully inserted player to owned tournament');
          // Clean up
          await supabase
            .from('bracket_players')
            .delete()
            .eq('name', 'TEST_OWNED_PLAYER');
        }
      }
    }

  } catch (error) {
    console.error('Error during debugging:', error);
  }
}

debugBrackets().then(() => {
  console.log('\n✨ Bracket system debugging complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});