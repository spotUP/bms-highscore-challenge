import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://tnsgrwntmnzpaifmutqh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuc2dyd250bW56cGFpZm11dHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTgyNjksImV4cCI6MjA3MDU3NDI2OX0.o-yVR7YDsJGJ9Yrvp-MFZGDnXcEVl1AKdx-73h-dHzM";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTests() {
  console.log('🧪 Running Database Tests...\n');

  try {
    // Test 1: Check if default tournament exists
    console.log('Test 1: Checking for Default Arcade Tournament...');
    const { data: defaultTournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, slug')
      .or('name.eq.Default Arcade Tournament,slug.eq.default-arcade');

    if (tournamentError) {
      console.log('❌ Error checking tournaments:', tournamentError.message);
    } else {
      if (defaultTournament && defaultTournament.length > 0) {
        console.log('⚠️  Default Arcade Tournament still exists:', defaultTournament);
      } else {
        console.log('✅ Default Arcade Tournament has been successfully removed!');
      }
    }

    // Test 2: Get current tournaments
    console.log('\nTest 2: Listing all current tournaments...');
    const { data: tournaments, error: listError } = await supabase
      .from('tournaments')
      .select('id, name, slug, created_at')
      .order('created_at', { ascending: false });

    if (listError) {
      console.log('❌ Error listing tournaments:', listError.message);
    } else {
      console.log(`Found ${tournaments?.length || 0} tournament(s):`);
      tournaments?.forEach(t => {
        console.log(`  - ${t.name} (${t.slug}) - Created: ${t.created_at}`);
      });
    }

    // Test 3: Check player stats table structure
    console.log('\nTest 3: Checking player_stats table...');
    const { data: playerStats, error: statsError } = await supabase
      .from('player_stats')
      .select('*')
      .limit(5);

    if (statsError) {
      console.log('❌ Error accessing player_stats:', statsError.message);
      console.log('   This might indicate RLS policy issues');
    } else {
      console.log(`✅ Player stats accessible! Found ${playerStats?.length || 0} records`);
      if (playerStats && playerStats.length > 0) {
        console.log('Sample record:', playerStats[0]);
      }
    }

    // Test 4: Check games table and scores table structure
    console.log('\nTest 4: Checking games table...');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, name, tournament_id')
      .limit(5);

    if (gamesError) {
      console.log('❌ Error accessing games table:', gamesError.message);
    } else {
      console.log(`✅ Games table accessible! Found ${games?.length || 0} games`);
      if (games && games.length > 0) {
        console.log('   Available games:');
        games.forEach(game => {
          console.log(`     - ${game.name} (ID: ${game.id})`);
        });
      }
    }

    console.log('\nTest 5: Checking scores table structure...');
    const { data: scoresSample, error: scoresError } = await supabase
      .from('scores')
      .select('*')
      .limit(1);

    if (scoresError) {
      console.log('❌ Error accessing scores table:', scoresError.message);
    } else {
      console.log('✅ Scores table accessible!');
      if (scoresSample && scoresSample.length > 0) {
        console.log('   Sample score record columns:', Object.keys(scoresSample[0]));
        console.log('   Sample record:', scoresSample[0]);
      } else {
        console.log('   Scores table is empty');
      }
    }

    // Test 6: Try to insert a test score (this will test RLS policies)
    console.log('\nTest 6: Testing score insertion (RLS policy test)...');
    const testTournament = tournaments?.[0];
    const testGame = games?.[0];

    if (testTournament && testGame) {
      console.log(`   Using tournament: ${testTournament.name}`);
      console.log(`   Using game: ${testGame.name} (ID: ${testGame.id})`);

      const { data: insertResult, error: insertError } = await supabase
        .from('scores')
        .insert({
          player_name: 'test_player_ai',
          game_id: testGame.id,
          score: 5000,
          tournament_id: testTournament.id
        })
        .select();

      if (insertError) {
        console.log('❌ Score insertion failed:', insertError.message);
        console.log('   This indicates RLS policy or schema issues');

        // Try to understand what columns are required
        console.log('   Trying to identify required columns...');
        const { error: schemaTestError } = await supabase
          .from('scores')
          .insert({
            player_name: 'test_player_ai',
            game_id: testGame.id
          })
          .select();

        if (schemaTestError) {
          console.log('   Minimal insert also failed:', schemaTestError.message);
        }
      } else {
        console.log('✅ Score insertion successful!');
        console.log('   Inserted:', insertResult);

        // Test if player_stats were automatically updated
        console.log('   Checking if player_stats were updated...');
        const { data: updatedStats } = await supabase
          .from('player_stats')
          .select('*')
          .eq('player_name', 'test_player_ai');

        if (updatedStats && updatedStats.length > 0) {
          console.log('   ✅ Player stats automatically updated:', updatedStats[0]);
        } else {
          console.log('   ⚠️  Player stats were not updated (trigger might not be working)');
        }

        // Clean up test data
        console.log('   Cleaning up test data...');
        await supabase
          .from('scores')
          .delete()
          .eq('player_name', 'test_player_ai');

        // Also clean up player_stats if it was created
        await supabase
          .from('player_stats')
          .delete()
          .eq('player_name', 'test_player_ai');
      }
    } else {
      if (!testTournament) console.log('⚠️  No tournaments available for score insertion test');
      if (!testGame) console.log('⚠️  No games available for score insertion test');
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

runTests().catch(console.error);
