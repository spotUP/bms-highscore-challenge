import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function setupAchievements() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Required:');
    console.log('- VITE_SUPABASE_URL');
    console.log('- SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('🔧 Setting up achievement system...');

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Test 1: Check if achievement tables exist
    console.log('📋 Checking current achievement system status...');

    const { data: achievements, error: achError } = await supabase
      .from('achievements')
      .select('id, name')
      .limit(1);

    if (achError) {
      console.log('❌ Achievements table not found:', achError.message);
      console.log('🛠️ Please run the following SQL in your Supabase SQL Editor:');
      console.log('');
      console.log('-- Step 1: Create achievement types enum');
      console.log(`CREATE TYPE achievement_type AS ENUM (
  'first_score',
  'first_place',
  'score_milestone',
  'game_master',
  'streak_master',
  'competition_winner',
  'high_scorer',
  'consistent_player',
  'speed_demon',
  'perfectionist'
);`);
      console.log('');
      console.log('-- Step 2: Create achievements table');
      console.log(`CREATE TABLE achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  type achievement_type NOT NULL,
  badge_icon TEXT NOT NULL,
  badge_color TEXT NOT NULL,
  criteria JSONB NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, tournament_id, created_by)
);`);
      console.log('');
      console.log('-- Step 3: Create player_achievements table');
      console.log(`CREATE TABLE player_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  score INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);
      console.log('');
      console.log('-- Step 4: Enable RLS');
      console.log('ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;');
      console.log('ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;');
      console.log('');
      console.log('-- Step 5: Create RLS policies');
      console.log(`CREATE POLICY "Allow public read access to achievements" ON achievements
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to player achievements" ON player_achievements
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert of player achievements" ON player_achievements
  FOR INSERT WITH CHECK (true);`);

      return;
    } else {
      console.log('✅ Achievements table exists');
      console.log(`Found ${achievements?.length || 0} achievements`);
    }

    // Test 2: Check if we have any achievements for current tournament
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name')
      .limit(1);

    if (tournaments && tournaments.length > 0) {
      const tournamentId = tournaments[0].id;
      console.log(`📋 Checking achievements for tournament: ${tournaments[0].name}`);

      const { data: tournamentAchievements } = await supabase
        .from('achievements')
        .select('id, name, description')
        .eq('tournament_id', tournamentId);

      console.log(`Found ${tournamentAchievements?.length || 0} achievements for this tournament`);

      if (!tournamentAchievements || tournamentAchievements.length === 0) {
        console.log('🎯 Creating default achievements for tournament...');

        const defaultAchievements = [
          {
            name: 'First Score',
            description: 'Submit your first score to any game',
            type: 'first_score',
            badge_icon: '🎯',
            badge_color: '#10B981',
            criteria: { min_score: 1 },
            points: 10,
            tournament_id: tournamentId
          },
          {
            name: 'Century Club',
            description: 'Score 100 or more points in any game',
            type: 'score_milestone',
            badge_icon: '💯',
            badge_color: '#F59E0B',
            criteria: { min_score: 100 },
            points: 25,
            tournament_id: tournamentId
          },
          {
            name: 'High Scorer',
            description: 'Score 1,000 or more points in any game',
            type: 'high_scorer',
            badge_icon: '🏆',
            badge_color: '#EF4444',
            criteria: { min_score: 1000 },
            points: 50,
            tournament_id: tournamentId
          },
          {
            name: 'Score Hunter',
            description: 'Score 10,000 or more points in any game',
            type: 'score_milestone',
            badge_icon: '🎖️',
            badge_color: '#8B5CF6',
            criteria: { min_score: 10000 },
            points: 100,
            tournament_id: tournamentId
          },
          {
            name: 'Perfect Game',
            description: 'Score 50,000 or more points in any game',
            type: 'perfectionist',
            badge_icon: '⭐',
            badge_color: '#06B6D4',
            criteria: { min_score: 50000 },
            points: 250,
            tournament_id: tournamentId
          },
          {
            name: 'Score Legend',
            description: 'Score 100,000 or more points in any game',
            type: 'score_milestone',
            badge_icon: '👑',
            badge_color: '#F97316',
            criteria: { min_score: 100000 },
            points: 500,
            tournament_id: tournamentId
          }
        ];

        const { data: created, error: createError } = await supabase
          .from('achievements')
          .insert(defaultAchievements)
          .select();

        if (createError) {
          console.error('❌ Error creating achievements:', createError);
        } else {
          console.log(`✅ Created ${created?.length} default achievements`);
        }
      }
    }

    // Test 3: Check for RPC functions
    console.log('🔍 Checking RPC functions...');
    try {
      const { data, error } = await supabase.rpc('get_recent_achievements_by_tournament', {
        p_tournament_id: tournaments?.[0]?.id || 'test',
        p_player_name: 'TEST',
        p_since_minutes: 10
      });

      if (error) {
        console.log('❌ RPC function missing:', error.message);
        console.log('📝 Please create the RPC function in Supabase SQL Editor');
      } else {
        console.log('✅ RPC function exists and working');
      }
    } catch (e) {
      console.log('❌ RPC function error:', e);
    }

  } catch (error) {
    console.error('❌ Setup error:', error);
  }
}

setupAchievements();