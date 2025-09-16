import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function fixAchievementTypes() {
  console.log('🔧 Fixing achievement types and criteria...\n');

  try {
    // Get current achievements
    console.log('1. Current achievement configuration:');
    const { data: currentAchievements, error: fetchError } = await supabase
      .from('achievements')
      .select('id, name, type, criteria, description')
      .eq('is_active', true)
      .order('name');

    if (fetchError) {
      console.log('❌ Error fetching achievements:', fetchError);
      return;
    }

    console.log('Current achievements:');
    currentAchievements?.forEach(a => {
      console.log(`   - ${a.name}: ${a.type}, Criteria: ${JSON.stringify(a.criteria)}`);
    });

    // Fix the achievement types and criteria
    console.log('\n2. Updating achievement configurations...');

    const updates = [
      {
        name: 'First Score',
        type: 'first_score',
        criteria: {} // No specific criteria needed for first score
      },
      {
        name: 'Century Club',
        type: 'score_milestone',
        criteria: { threshold: 100 }
      },
      {
        name: 'High Scorer',
        type: 'score_milestone',
        criteria: { threshold: 1000 }
      },
      {
        name: 'Score Hunter',
        type: 'score_milestone',
        criteria: { threshold: 10000 }
      },
      {
        name: 'Perfect Game',
        type: 'score_milestone',
        criteria: { threshold: 50000 }
      },
      {
        name: 'Score Legend',
        type: 'score_milestone',
        criteria: { threshold: 100000 }
      }
    ];

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('achievements')
        .update({
          type: update.type,
          criteria: update.criteria
        })
        .eq('name', update.name)
        .eq('is_active', true);

      if (updateError) {
        console.log(`❌ Error updating ${update.name}:`, updateError);
      } else {
        console.log(`✅ Updated ${update.name}: ${update.type} with criteria ${JSON.stringify(update.criteria)}`);
      }
    }

    console.log('\n3. Final achievement configuration:');
    const { data: finalAchievements, error: finalError } = await supabase
      .from('achievements')
      .select('id, name, type, criteria, description')
      .eq('is_active', true)
      .order('name');

    if (finalError) {
      console.log('❌ Error fetching final achievements:', finalError);
    } else {
      console.log('Updated achievements:');
      finalAchievements?.forEach(a => {
        console.log(`   - ${a.name}: ${a.type}, Criteria: ${JSON.stringify(a.criteria)}`);
      });
    }

  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixAchievementTypes().catch(console.error);