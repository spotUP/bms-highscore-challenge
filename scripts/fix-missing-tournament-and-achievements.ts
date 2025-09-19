import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required for this operation');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const missingTournamentId = 'b04f7a32-21e0-4087-b4d1-ff3ea4b9a8a6';

const achievementTemplates = [
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
  },
  {
    name: "Asteroid Hunter",
    description: "Score 25,000+ points in Asteroids",
    type: "score_milestone",
    badge_icon: "🚀",
    badge_color: "#3F51B5",
    criteria: { min_score: 25000, specific_game: "Asteroids" },
    points: 150
  },
  {
    name: "Space Ace",
    description: "Score 75,000+ points in any space-themed game",
    type: "score_milestone",
    badge_icon: "👨‍🚀",
    badge_color: "#673AB7",
    criteria: { min_score: 75000 },
    points: 300
  },
  {
    name: "Retro Gamer",
    description: "Play 10 different classic arcade games",
    type: "game_master",
    badge_icon: "👾",
    badge_color: "#FF4081",
    criteria: { game_count: 10 },
    points: 250
  },
  {
    name: "High Score Hero",
    description: "Achieve a top-3 score on any leaderboard",
    type: "first_place",
    badge_icon: "🏆",
    badge_color: "#FFD700",
    criteria: { max_rank: 3 },
    points: 400
  },
  {
    name: "Marathon Player",
    description: "Submit 50 scores total",
    type: "consistent_player",
    badge_icon: "🏃‍♂️",
    badge_color: "#4CAF50",
    criteria: { min_scores: 50 },
    points: 350
  }
];

async function fixMissingTournamentAndAchievements() {
  console.log('🔧 Fixing missing tournament and achievements...');

  try {
    // Step 1: Check if tournament exists
    console.log('📋 Checking tournament status...');
    const { data: existingTournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, slug, is_active')
      .eq('id', missingTournamentId)
      .single();

    if (tournamentError && tournamentError.code === 'PGRST116') {
      console.log('🆕 Tournament missing, creating it...');

      // Create the missing tournament
      const { data: newTournament, error: createError } = await supabase
        .from('tournaments')
        .insert({
          id: missingTournamentId,
          name: 'Favorites',
          slug: 'favorites',
          description: 'Your favorite arcade games collection',
          is_active: true,
          is_public: true,
          scores_locked: false
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating tournament:', createError);
        return;
      }

      console.log(`✅ Created tournament: ${newTournament.name}`);
    } else if (tournamentError) {
      console.error('❌ Error checking tournament:', tournamentError);
      return;
    } else {
      console.log(`✅ Tournament exists: ${existingTournament.name}`);
    }

    // Step 2: Check existing achievements
    console.log('🔍 Checking existing achievements...');
    const { data: existingAchievements, error: achError } = await supabase
      .from('achievements')
      .select('id, name')
      .eq('tournament_id', missingTournamentId)
      .eq('is_active', true);

    if (achError) {
      console.error('❌ Error checking achievements:', achError);
      return;
    }

    if (existingAchievements && existingAchievements.length > 0) {
      console.log(`✅ Tournament already has ${existingAchievements.length} achievements`);
      existingAchievements.forEach(ach => console.log(`  - ${ach.name}`));
      return;
    }

    console.log('🆕 No achievements found, creating them...');

    // Step 3: Add achievements
    let successCount = 0;
    let errorCount = 0;

    for (const achievement of achievementTemplates) {
      try {
        const { error: createError } = await supabase
          .from('achievements')
          .insert({
            tournament_id: missingTournamentId,
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
          console.log(`✅ Created "${achievement.name}" (${achievement.points} pts)`);
          successCount++;
        }

        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Unexpected error creating "${achievement.name}":`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 Results: ${successCount} achievements created, ${errorCount} errors`);

    if (successCount > 0) {
      console.log('\n🎉 Success! Achievements have been added to the Favorites tournament.');
      console.log('🔄 Try submitting another score to test the achievement system!');

      // Step 4: Check if any existing scores should trigger achievements
      console.log('\n🔍 Checking if existing scores should trigger achievements...');
      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('player_name, score, created_at')
        .eq('tournament_id', missingTournamentId)
        .order('created_at', { ascending: false });

      if (scoresError) {
        console.error('❌ Error checking scores:', scoresError);
      } else if (scores && scores.length > 0) {
        console.log(`📈 Found ${scores.length} existing scores in this tournament`);
        console.log('💡 Consider running the achievement recalculation to award retroactive achievements');

        // Show top scores
        scores.slice(0, 5).forEach((score, i) => {
          console.log(`  ${i + 1}. ${score.player_name}: ${score.score.toLocaleString()}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixMissingTournamentAndAchievements().catch(console.error);