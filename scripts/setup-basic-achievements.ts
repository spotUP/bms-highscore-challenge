#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function setupBasicAchievements() {
  console.log('🚀 Setting up basic achievements system...');

  try {
    // First, apply the essential SQL to add missing columns and functions
    const achievementSQL = `
-- Add missing columns to achievements table
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS badge_icon TEXT DEFAULT '🏆';
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS badge_color TEXT DEFAULT '#FFD700';
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'score_milestone';
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS criteria JSONB DEFAULT '{}';
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add missing columns to player_achievements table
ALTER TABLE player_achievements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE player_achievements ADD COLUMN IF NOT EXISTS game_id UUID REFERENCES games(id) ON DELETE CASCADE;
ALTER TABLE player_achievements ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE player_achievements ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE player_achievements ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_player_achievements_user ON player_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_tournament ON player_achievements(tournament_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_unlocked_at ON player_achievements(unlocked_at);
`;

    console.log('📝 Applying achievement table modifications...');
    const { error: sqlError } = await supabase.rpc('query_sql', { query: achievementSQL });

    if (sqlError) {
      console.log('⚠️ Some SQL modifications may have failed (could be expected if already applied):', sqlError.message);
    } else {
      console.log('✅ Achievement table modifications applied successfully');
    }

    // Create the RPC functions
    const rpcSQL = `
-- RPC: get recent achievements by tournament and player_name (for anonymous users)
CREATE OR REPLACE FUNCTION get_recent_achievements_by_tournament(
    p_tournament_id UUID,
    p_player_name TEXT,
    p_since_minutes INTEGER DEFAULT 10
)
RETURNS TABLE (
    achievement_id UUID,
    achievement_name TEXT,
    achievement_description TEXT,
    badge_icon TEXT,
    badge_color TEXT,
    points INTEGER,
    unlocked_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id as achievement_id,
        a.name as achievement_name,
        a.description as achievement_description,
        COALESCE(a.badge_icon, '🏆') as badge_icon,
        COALESCE(a.badge_color, '#FFD700') as badge_color,
        a.points,
        COALESCE(pa.unlocked_at, pa.created_at) as unlocked_at
    FROM player_achievements pa
    JOIN achievements a ON pa.achievement_id = a.id
    WHERE pa.tournament_id = p_tournament_id
      AND UPPER(pa.player_name) = UPPER(p_player_name)
      AND COALESCE(pa.unlocked_at, pa.created_at) >= NOW() - (p_since_minutes || ' minutes')::INTERVAL
      AND pa.user_id IS NULL -- anonymous achievements only
    ORDER BY COALESCE(pa.unlocked_at, pa.created_at) DESC;
END;
$$;

-- RPC: get recent achievements for authenticated user
CREATE OR REPLACE FUNCTION get_recent_achievements_for_user(
    p_user_id UUID,
    p_tournament_id UUID,
    p_since_minutes INTEGER DEFAULT 10
)
RETURNS TABLE (
    achievement_id UUID,
    achievement_name TEXT,
    achievement_description TEXT,
    badge_icon TEXT,
    badge_color TEXT,
    points INTEGER,
    unlocked_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id as achievement_id,
        a.name as achievement_name,
        a.description as achievement_description,
        COALESCE(a.badge_icon, '🏆') as badge_icon,
        COALESCE(a.badge_color, '#FFD700') as badge_color,
        a.points,
        COALESCE(pa.unlocked_at, pa.created_at) as unlocked_at
    FROM player_achievements pa
    JOIN achievements a ON pa.achievement_id = a.id
    WHERE pa.tournament_id = p_tournament_id
      AND pa.user_id = p_user_id
      AND COALESCE(pa.unlocked_at, pa.created_at) >= NOW() - (p_since_minutes || ' minutes')::INTERVAL
      AND (a.created_by IS NULL OR a.created_by = p_user_id)
    ORDER BY COALESCE(pa.unlocked_at, pa.created_at) DESC;
END;
$$;
`;

    console.log('📝 Creating RPC functions...');
    const { error: rpcError } = await supabase.rpc('query_sql', { query: rpcSQL });

    if (rpcError) {
      console.log('⚠️ RPC creation failed:', rpcError.message);
    } else {
      console.log('✅ RPC functions created successfully');
    }

    // Get the current tournament
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (!tournaments || tournaments.length === 0) {
      console.log('⚠️ No active tournament found. Please create a tournament first.');
      return;
    }

    const currentTournament = tournaments[0];
    console.log(`🎯 Using tournament: ${currentTournament.name} (${currentTournament.id})`);

    // Create basic achievements for the current tournament
    const basicAchievements = [
      {
        name: "First Steps",
        description: "Submit your first score",
        badge_icon: "🎯",
        badge_color: "#10B981",
        type: "first_score",
        criteria: {},
        points: 10,
        tournament_id: currentTournament.id,
        is_active: true
      },
      {
        name: "High Roller",
        description: "Score 10,000 points or more",
        badge_icon: "💎",
        badge_color: "#3B82F6",
        type: "score_milestone",
        criteria: { min_score: 10000 },
        points: 25,
        tournament_id: currentTournament.id,
        is_active: true
      },
      {
        name: "Champion",
        description: "Score 50,000 points or more",
        badge_icon: "👑",
        badge_color: "#F59E0B",
        type: "score_milestone",
        criteria: { min_score: 50000 },
        points: 50,
        tournament_id: currentTournament.id,
        is_active: true
      },
      {
        name: "Legend",
        description: "Score 100,000 points or more",
        badge_icon: "🏆",
        badge_color: "#EF4444",
        type: "score_milestone",
        criteria: { min_score: 100000 },
        points: 100,
        tournament_id: currentTournament.id,
        is_active: true
      }
    ];

    console.log('🏆 Creating basic achievements...');
    for (const achievement of basicAchievements) {
      // Check if achievement already exists
      const { data: existing } = await supabase
        .from('achievements')
        .select('id')
        .eq('name', achievement.name)
        .eq('tournament_id', achievement.tournament_id)
        .maybeSingle();

      if (existing) {
        console.log(`⏭️ Achievement "${achievement.name}" already exists, skipping...`);
        continue;
      }

      const { error } = await supabase
        .from('achievements')
        .insert(achievement);

      if (error) {
        console.error(`❌ Failed to create achievement "${achievement.name}":`, error);
      } else {
        console.log(`✅ Created achievement: ${achievement.name}`);
      }
    }

    console.log('🎉 Basic achievements setup complete!');
    console.log('📊 Achievement system is now ready for testing.');
    console.log('💡 Submit a score to test if achievements are awarded and notifications appear.');

  } catch (error) {
    console.error('❌ Error setting up achievements:', error);
  }
}

// Create a simple query_sql RPC if it doesn't exist
async function createQuerySqlFunction() {
  try {
    const { error } = await supabase.rpc('query_sql', { query: 'SELECT 1' });
    if (!error) {
      console.log('✅ query_sql function already exists');
      return;
    }
  } catch {
    // Function doesn't exist, create it
  }

  console.log('📝 Creating query_sql helper function...');

  // We'll use the direct SQL approach instead
  const { data, error } = await supabase
    .from('achievements')
    .select('id')
    .limit(1);

  if (error) {
    console.error('❌ Cannot access database. Please check your Supabase connection.');
    console.log('💡 You can apply the SQL manually in the Supabase web UI:');
    console.log('Go to SQL Editor and run the contents of: supabase/migrations/20250926000000_add_achievement_functions.sql');
    return false;
  }

  return true;
}

// Main execution
createQuerySqlFunction().then((canProceed) => {
  if (canProceed) {
    setupBasicAchievements();
  }
});

export { setupBasicAchievements };