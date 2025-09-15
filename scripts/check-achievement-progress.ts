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

async function checkAchievementProgress() {
  console.log('🔍 Checking achievement progress after clear operation...\n');

  const tournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d';

  // Check achievement definitions (should still exist)
  console.log('1. Achievement definitions in achievements table:');
  const { data: achievements, error: achievementsError } = await supabase
    .from('achievements')
    .select('id, name')
    .eq('tournament_id', tournamentId);

  if (achievementsError) {
    console.error('❌ Error:', achievementsError);
  } else {
    console.log(`✅ Found ${achievements?.length || 0} achievement definitions:`);
    achievements?.forEach(a => console.log(`   - ${a.name}`));
  }

  // Check player achievement progress (should be cleared)
  console.log('\n2. Player achievement progress in player_achievements table:');
  const { data: playerAchievements, error: playerError } = await supabase
    .from('player_achievements')
    .select('player_name, achievement_id, achievements(name)')
    .eq('tournament_id', tournamentId);

  if (playerError) {
    console.error('❌ Error:', playerError);
  } else {
    console.log(`✅ Found ${playerAchievements?.length || 0} player achievement records:`);
    playerAchievements?.forEach(pa => {
      console.log(`   - ${pa.player_name}: ${(pa.achievements as any)?.name}`);
    });
  }

  console.log('\n📊 Summary:');
  console.log(`- Achievement definitions: ${achievements?.length || 0}`);
  console.log(`- Player progress records: ${playerAchievements?.length || 0}`);

  if ((achievements?.length || 0) > 0 && (playerAchievements?.length || 0) === 0) {
    console.log('✅ Clear All Progress worked correctly - achievements exist but no player progress');
  } else if ((achievements?.length || 0) === 0) {
    console.log('⚠️  All achievements were deleted (Clear All Achievements was used)');
  } else {
    console.log('⚠️  Player progress still exists - Clear All Progress may not have worked');
  }
}

checkAchievementProgress().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});