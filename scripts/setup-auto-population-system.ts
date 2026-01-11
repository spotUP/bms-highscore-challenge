import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Default achievement templates
const defaultAchievementTemplates = [
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

async function setupAutoPopulationSystem() {
  console.log('🔧 Setting up auto-population system for new tournaments...');

  try {
    // Step 1: Create template achievements (tournament_id = NULL)
    console.log('📋 Creating template achievements...');

    let templatesCreated = 0;
    let templatesSkipped = 0;

    for (const template of defaultAchievementTemplates) {
      try {
        const { error } = await supabase
          .from('achievements')
          .insert({
            tournament_id: null, // This makes it a template
            name: template.name,
            description: template.description,
            type: template.type,
            badge_icon: template.badge_icon,
            badge_color: template.badge_color,
            criteria: template.criteria,
            points: template.points,
            is_active: true
          });

        if (error) {
          if (error.code === '23505') { // Unique constraint violation
            console.log(`⏭️ Template "${template.name}" already exists`);
            templatesSkipped++;
          } else {
            console.error(`❌ Error creating template "${template.name}":`, error);
          }
        } else {
          console.log(`✅ Created template "${template.name}"`);
          templatesCreated++;
        }
      } catch (error) {
        console.error(`❌ Unexpected error creating template "${template.name}":`, error);
      }
    }

    console.log(`\n📊 Template Results: ${templatesCreated} created, ${templatesSkipped} already existed`);

    // Step 2: Create or update the auto-population function and trigger
    console.log('\n⚙️ Setting up auto-population function...');

    const functionSQL = `
-- Function to populate default (template) achievements for a tournament
CREATE OR REPLACE FUNCTION populate_default_achievements(p_tournament_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Insert copies of template achievements (where tournament_id IS NULL) into this tournament
  INSERT INTO achievements (name, description, type, badge_icon, badge_color, criteria, points, is_active, tournament_id)
  SELECT a.name, a.description, a.type, a.badge_icon, a.badge_color, a.criteria, a.points, a.is_active, p_tournament_id
  FROM achievements a
  WHERE a.tournament_id IS NULL
  ON CONFLICT (tournament_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    const { error: functionError } = await supabase.rpc('sql', { query: functionSQL });

    if (functionError) {
      console.error('❌ Error creating function:', functionError);
    } else {
      console.log('✅ Created populate_default_achievements function');
    }

    // Step 3: Create the trigger
    console.log('\n🎯 Setting up tournament creation trigger...');

    const triggerSQL = `
-- Trigger function to auto-populate achievements when a new tournament is created
CREATE OR REPLACE FUNCTION trigger_on_tournament_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM populate_default_achievements(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_tournament_created_populate_achievements ON tournaments;

-- Create the trigger
CREATE TRIGGER on_tournament_created_populate_achievements
AFTER INSERT ON tournaments
FOR EACH ROW
EXECUTE FUNCTION trigger_on_tournament_created();
    `;

    const { error: triggerError } = await supabase.rpc('sql', { query: triggerSQL });

    if (triggerError) {
      console.error('❌ Error creating trigger:', triggerError);
    } else {
      console.log('✅ Created tournament creation trigger');
    }

    // Step 4: Test the system by creating a test tournament (if we want to)
    console.log('\n🧪 Testing auto-population system...');

    const testTournamentName = `Test Auto-Population ${Date.now()}`;
    const { data: testTournament, error: createError } = await supabase
      .from('tournaments')
      .insert({
        name: testTournamentName,
        slug: `test-auto-pop-${Date.now()}`,
        description: 'Test tournament for auto-population system',
        is_active: false, // Make it inactive so it doesn't show up in UI
        is_public: false,
        scores_locked: true // Lock it so no scores can be submitted
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating test tournament:', createError);
    } else {
      console.log(`✅ Created test tournament: ${testTournament.name}`);

      // Check if achievements were auto-populated
      const { data: autoAchievements, error: achError } = await supabase
        .from('achievements')
        .select('id, name')
        .eq('tournament_id', testTournament.id);

      if (achError) {
        console.error('❌ Error checking auto-populated achievements:', achError);
      } else {
        console.log(`🎯 Auto-populated ${autoAchievements?.length || 0} achievements!`);

        if (autoAchievements && autoAchievements.length > 0) {
          console.log('✅ Auto-population system is working correctly!');

          // Clean up test tournament
          await supabase
            .from('tournaments')
            .delete()
            .eq('id', testTournament.id);
          console.log('🧹 Cleaned up test tournament');
        } else {
          console.log('❌ Auto-population system is not working properly');
        }
      }
    }

    console.log('\n🎉 Auto-population system setup complete!');
    console.log('💡 New tournaments will automatically receive default achievements');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

setupAutoPopulationSystem().catch(console.error);