import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Default achievement templates
const defaultAchievements = [
  {
    name: "First Steps",
    description: "Submit your first score to any game",
    type: "first_score",
    badge_icon: "🎯",
    badge_color: "#4CAF50",
    criteria: {},
    points: 10
  },
  {
    name: "Century Club",
    description: "Score 100 or more points in any game",
    type: "score_milestone",
    badge_icon: "💯",
    badge_color: "#FF9800",
    criteria: { min_score: 100 },
    points: 25
  },
  {
    name: "High Scorer",
    description: "Score 1,000 or more points in any game",
    type: "score_milestone",
    badge_icon: "🎯",
    badge_color: "#2196F3",
    criteria: { min_score: 1000 },
    points: 50
  },
  {
    name: "Score Hunter",
    description: "Score 10,000 or more points in any game",
    type: "score_milestone",
    badge_icon: "🏹",
    badge_color: "#9C27B0",
    criteria: { min_score: 10000 },
    points: 100
  },
  {
    name: "Perfect Game",
    description: "Score 50,000 or more points in any game",
    type: "score_milestone",
    badge_icon: "💎",
    badge_color: "#E91E63",
    criteria: { min_score: 50000 },
    points: 250
  },
  {
    name: "Score Legend",
    description: "Score 100,000 or more points in any game",
    type: "score_milestone",
    badge_icon: "👑",
    badge_color: "#FFD700",
    criteria: { min_score: 100000 },
    points: 500
  },
  {
    name: "Game Explorer",
    description: "Submit scores to 3 different games",
    type: "game_master",
    badge_icon: "🗺️",
    badge_color: "#607D8B",
    criteria: { game_count: 3 },
    points: 75
  },
  {
    name: "Arcade Master",
    description: "Submit scores to 5 different games",
    type: "game_master",
    badge_icon: "🕹️",
    badge_color: "#795548",
    criteria: { game_count: 5 },
    points: 150
  },
  {
    name: "Dedicated Player",
    description: "Submit 10 scores total",
    type: "consistent_player",
    badge_icon: "🔥",
    badge_color: "#F44336",
    criteria: { min_scores: 10 },
    points: 100
  },
  {
    name: "Score Machine",
    description: "Submit 25 scores total",
    type: "consistent_player",
    badge_icon: "⚡",
    badge_color: "#FF5722",
    criteria: { min_scores: 25 },
    points: 200
  }
];

async function setupTournamentAchievements() {
  console.log('🏆 Setting up tournament achievements...');

  try {
    // First, get all tournaments
    console.log('📋 Fetching all tournaments...');
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name, slug, is_active, created_at');

    if (tournamentsError) {
      console.error('❌ Error fetching tournaments:', tournamentsError);
      return;
    }

    console.log(`✅ Found ${tournaments?.length || 0} tournaments`);

    // Check recent scores to see which tournament is being used
    console.log('\n🔍 Checking recent scores to identify active tournament...');
    const { data: recentScores, error: scoresError } = await supabase
      .from('scores')
      .select('tournament_id, player_name, score, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (scoresError) {
      console.error('❌ Error fetching recent scores:', scoresError);
    } else {
      console.log('Recent scores by tournament:');
      const tournamentCounts = new Map();
      recentScores?.forEach(score => {
        const tid = score.tournament_id || 'null';
        tournamentCounts.set(tid, (tournamentCounts.get(tid) || 0) + 1);
      });

      for (const [tournamentId, count] of tournamentCounts.entries()) {
        const tournament = tournaments?.find(t => t.id === tournamentId);
        console.log(`  - ${tournament?.name || 'Unknown'} (${tournamentId}): ${count} recent scores`);
      }
    }

    // For each tournament, check if it has achievements, and add them if not
    for (const tournament of tournaments || []) {
      console.log(`\n--- Processing ${tournament.name} ---`);

      // Check existing achievements
      const { data: existingAchievements, error: achError } = await supabase
        .from('achievements')
        .select('id, name')
        .eq('tournament_id', tournament.id)
        .eq('is_active', true);

      if (achError) {
        console.error(`❌ Error checking achievements for ${tournament.name}:`, achError);
        continue;
      }

      if (existingAchievements && existingAchievements.length > 0) {
        console.log(`✅ ${tournament.name} already has ${existingAchievements.length} achievements`);
        continue;
      }

      console.log(`🆕 Creating achievements for ${tournament.name}...`);

      // Add achievements to this tournament
      let successCount = 0;
      let errorCount = 0;

      for (const achievement of defaultAchievements) {
        try {
          const { error: createError } = await supabase
            .from('achievements')
            .insert({
              tournament_id: tournament.id,
              name: achievement.name,
              description: achievement.description,
              type: achievement.type,
              badge_icon: achievement.badge_icon,
              badge_color: achievement.badge_color,
              criteria: achievement.criteria,
              points: achievement.points,
              is_active: true
            });

          if (createError) {
            console.error(`❌ Error creating "${achievement.name}":`, createError);
            errorCount++;
          } else {
            console.log(`✅ Created "${achievement.name}"`);
            successCount++;
          }
        } catch (error) {
          console.error(`❌ Unexpected error creating "${achievement.name}":`, error);
          errorCount++;
        }
      }

      console.log(`📊 Tournament ${tournament.name}: ${successCount} achievements created, ${errorCount} errors`);
    }

    console.log('\n🎉 Achievement setup complete!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

setupTournamentAchievements().catch(console.error);