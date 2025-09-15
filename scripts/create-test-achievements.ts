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

async function createTestAchievements() {
  console.log('🎯 Creating test player achievements...\n');

  const tournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d';

  // Get first achievement ID
  const { data: achievements, error: achError } = await supabase
    .from('achievements')
    .select('id, name')
    .eq('tournament_id', tournamentId)
    .limit(2);

  if (achError || !achievements || achievements.length === 0) {
    console.error('❌ No achievements found:', achError);
    return;
  }

  console.log(`✅ Found ${achievements.length} achievements to award`);

  // Create test player achievements
  const testData = [
    {
      player_name: 'TESTUSER',
      achievement_id: achievements[0].id,
      tournament_id: tournamentId,
      earned_at: new Date().toISOString()
    },
    {
      player_name: 'PLAYER2',
      achievement_id: achievements[0].id,
      tournament_id: tournamentId,
      earned_at: new Date().toISOString()
    }
  ];

  if (achievements.length > 1) {
    testData.push({
      player_name: 'TESTUSER',
      achievement_id: achievements[1].id,
      tournament_id: tournamentId,
      earned_at: new Date().toISOString()
    });
  }

  console.log('\n🏆 Creating player achievement records...');
  const { error } = await supabase
    .from('player_achievements')
    .insert(testData);

  if (error) {
    console.error('❌ Error creating test achievements:', error);
  } else {
    console.log(`✅ Created ${testData.length} test player achievements`);
    console.log('📊 Test data created:');
    testData.forEach(data => {
      const achievement = achievements.find(a => a.id === data.achievement_id);
      console.log(`   - ${data.player_name}: ${achievement?.name}`);
    });
  }

  // Verify creation
  const { data: verification, error: verifyError } = await supabase
    .from('player_achievements')
    .select('player_name, achievements(name)')
    .eq('tournament_id', tournamentId);

  if (!verifyError) {
    console.log(`\n✅ Verification: ${verification?.length || 0} total player achievements exist`);
  }
}

createTestAchievements().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});