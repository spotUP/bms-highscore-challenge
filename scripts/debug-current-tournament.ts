import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function debugCurrentTournament() {
  const tournamentId = 'cc0e2d27-3af1-4094-8560-79a5a918a107';

  console.log('🔍 Debugging tournament:', tournamentId);

  // Get tournament info
  const { data: tournament } = await supabase
    .from('bracket_tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  console.log('Tournament:', tournament);

  // Get all matches
  const { data: matches } = await supabase
    .from('bracket_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round')
    .order('position');

  console.log('\n📋 All matches:');
  matches?.forEach(match => {
    const status = match.winner_participant_id ? '✅' : '⏳';
    console.log(`${status} R${match.round}P${match.position}: ${match.participant1_id || 'empty'} vs ${match.participant2_id || 'empty'} → ${match.winner_participant_id || 'no winner'}`);
  });

  // Group by round
  const byRound = matches?.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {} as Record<number, any[]>) || {};

  console.log('\n🏆 Matches by round:');
  Object.entries(byRound).forEach(([round, roundMatches]) => {
    const roundNum = parseInt(round);
    const roundType = roundNum < 100 ? 'Winners' : roundNum < 1000 ? `Losers L${roundNum - 99}` : 'Grand Final';
    console.log(`\n${roundType} (Round ${round}):`);
    roundMatches.forEach(match => {
      const status = match.winner_participant_id ? '✅' : '⏳';
      console.log(`  ${status} P${match.position}: ${match.participant1_id || 'empty'} vs ${match.participant2_id || 'empty'} → ${match.winner_participant_id || 'pending'}`);
    });
  });

  // Check Grand Final specifically
  const grandFinal = matches?.find(m => m.round === 1000);
  console.log('\n🥇 Grand Final status:');
  console.log('  Match:', grandFinal);
  console.log('  Participant 1:', grandFinal?.participant1_id || 'MISSING');
  console.log('  Participant 2:', grandFinal?.participant2_id || 'MISSING');
  console.log('  Winner:', grandFinal?.winner_participant_id || 'pending');
}

debugCurrentTournament().catch(console.error);