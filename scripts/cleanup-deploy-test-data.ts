import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('   - VITE_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function cleanupTestData() {
  console.log('🧹 Cleaning up deploy test data...\n');

  // Clean up achievements with DEPLOY test names
  const { data: deletedAchievements, error: achError } = await supabase
    .from('player_achievements')
    .delete()
    .or('player_name.like.DEPLOY%,player_name.like.SEC_DEPLOY_%')
    .select();

  if (achError) {
    console.error('❌ Error cleaning achievements:', achError);
  } else {
    console.log(`✅ Deleted ${deletedAchievements?.length || 0} achievement records`);
  }

  // Also clean any scores that might have been missed
  const { data: deletedScores, error: scoreError } = await supabase
    .from('scores')
    .delete()
    .or('player_name.like.DEPLOY%,player_name.like.SEC_DEPLOY_%')
    .select();

  if (scoreError) {
    console.error('❌ Error cleaning scores:', scoreError);
  } else {
    console.log(`✅ Deleted ${deletedScores?.length || 0} score records`);
  }

  // Clean up tournaments
  const { data: deletedTournaments, error: tournamentError } = await supabase
    .from('tournaments')
    .delete()
    .like('name', 'DEPLOY_%')
    .select();

  if (tournamentError) {
    console.error('❌ Error cleaning tournaments:', tournamentError);
  } else {
    console.log(`✅ Deleted ${deletedTournaments?.length || 0} tournament records`);
  }

  // Clean up bracket tournaments
  const { data: deletedBracketTournaments, error: bracketError } = await supabase
    .from('bracket_tournaments')
    .delete()
    .like('name', 'DEPLOY_%')
    .select();

  if (bracketError) {
    console.error('❌ Error cleaning bracket tournaments:', bracketError);
  } else {
    console.log(`✅ Deleted ${deletedBracketTournaments?.length || 0} bracket tournament records`);
  }

  console.log('\n🎉 Cleanup completed!');
}

cleanupTestData()
  .then(() => {
    console.log('✨ Deploy test data cleanup finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  });