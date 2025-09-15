import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function debugScoresTable() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  console.log('🔍 Debugging scores table...');

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // First, try to select from scores to see current data
    console.log('📋 Current scores in table:');
    const { data: scores, error: selectError } = await supabase
      .from('scores')
      .select('*')
      .limit(5);

    if (selectError) {
      console.error('❌ Can\'t read scores:', selectError.message);
    } else {
      console.log(`✅ Found ${scores?.length || 0} scores`);
      console.log('Sample score structure:', scores?.[0] || 'No scores yet');
    }

    // Try to get one game to use as a valid game_id
    console.log('\n🎮 Getting a valid game ID...');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, name')
      .limit(1);

    if (gamesError) {
      console.error('❌ Can\'t read games:', gamesError.message);
      return;
    }

    if (!games || games.length === 0) {
      console.log('ℹ️ No games found, creating a test game...');

      // Get tournament ID first
      const { data: tournaments, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('id')
        .limit(1);

      if (tournamentsError || !tournaments || tournaments.length === 0) {
        console.error('❌ No tournaments found');
        return;
      }

      const tournamentId = tournaments[0].id;

      // Create a test game
      const { data: newGame, error: createGameError } = await supabase
        .from('games')
        .insert({
          name: 'Test Game for Score Submission',
          tournament_id: tournamentId,
          include_in_challenge: true
        })
        .select()
        .single();

      if (createGameError) {
        console.error('❌ Can\'t create test game:', createGameError.message);
        return;
      }

      console.log('✅ Created test game:', newGame.name);
    }

    // Get fresh game data
    const { data: freshGames } = await supabase
      .from('games')
      .select('id, name, tournament_id')
      .limit(1);

    if (!freshGames || freshGames.length === 0) {
      console.error('❌ Still no games available');
      return;
    }

    const testGame = freshGames[0];
    console.log('🎯 Using game:', testGame.name, 'ID:', testGame.id);

    // Now try to submit a score
    console.log('\n📝 Testing score submission...');
    const { data: newScore, error: insertError } = await supabase
      .from('scores')
      .insert({
        player_name: 'Debug Test Player',
        score: 12345,
        game_id: testGame.id,
        tournament_id: testGame.tournament_id
      })
      .select();

    if (insertError) {
      console.error('❌ Score submission failed:', insertError.message);
      console.error('Error details:', insertError);

      // Check for constraint violations
      if (insertError.message.includes('check constraint')) {
        console.log('\n🔍 Checking table constraints...');
        console.log('This looks like a constraint issue. The player_name might have restrictions.');
        console.log('Try a different player name or check the database constraints.');
      }

    } else {
      console.log('✅ Score submitted successfully!');
      console.log('New score:', newScore);

      // Clean up
      if (newScore && newScore[0]) {
        await supabase
          .from('scores')
          .delete()
          .eq('id', newScore[0].id);
        console.log('🧹 Cleaned up test score');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

debugScoresTable();