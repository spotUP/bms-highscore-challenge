import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyAutoPopulationFunctions() {
  console.log('🔧 Applying auto-population functions and triggers...');

  try {
    // Step 1: Create the populate function
    console.log('⚙️ Creating populate_default_achievements function...');

    const functionSQL = `
CREATE OR REPLACE FUNCTION populate_default_achievements(p_tournament_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO achievements (name, description, type, badge_icon, badge_color, criteria, points, is_active, tournament_id)
  SELECT a.name, a.description, a.type, a.badge_icon, a.badge_color, a.criteria, a.points, a.is_active, p_tournament_id
  FROM achievements a
  WHERE a.tournament_id IS NULL
  ON CONFLICT (tournament_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // Execute function creation using direct SQL
    const { error: functionError } = await supabase
      .from('sql')
      .insert({ query: functionSQL });

    if (functionError) {
      // Try a different approach by executing the SQL directly
      console.log('Trying alternative approach to create function...');

      // Split the function into smaller parts and execute
      const createFunctionQuery = `
        CREATE OR REPLACE FUNCTION populate_default_achievements(p_tournament_id UUID)
        RETURNS VOID AS $func$
        BEGIN
          INSERT INTO achievements (name, description, type, badge_icon, badge_color, criteria, points, is_active, tournament_id)
          SELECT a.name, a.description, a.type, a.badge_icon, a.badge_color, a.criteria, a.points, a.is_active, p_tournament_id
          FROM achievements a
          WHERE a.tournament_id IS NULL
          ON CONFLICT (tournament_id, name) DO NOTHING;
        END;
        $func$ LANGUAGE plpgsql SECURITY DEFINER;
      `;

      // Test with a manual function creation through Supabase client
      const { data: testResult, error: testError } = await supabase
        .from('achievements')
        .select('count')
        .is('tournament_id', null)
        .limit(1);

      if (!testError) {
        console.log('✅ Database connection working, proceeding with function test...');

        // Test if we can call populate function manually
        try {
          const { data: populateResult, error: populateError } = await supabase
            .rpc('populate_default_achievements', {
              p_tournament_id: 'b04f7a32-21e0-4087-b4d1-ff3ea4b9a8a6' // Favorites tournament ID
            });

          if (populateError) {
            console.log('❌ Function does not exist yet, need to create it manually');
            console.log('📝 SQL to apply manually in Supabase dashboard:');
            console.log('');
            console.log(createFunctionQuery);
            console.log('');

            // Create trigger SQL
            const triggerSQL = `
CREATE OR REPLACE FUNCTION trigger_on_tournament_created()
RETURNS TRIGGER AS $trig$
BEGIN
  PERFORM populate_default_achievements(NEW.id);
  RETURN NEW;
END;
$trig$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_tournament_created_populate_achievements ON tournaments;

CREATE TRIGGER on_tournament_created_populate_achievements
AFTER INSERT ON tournaments
FOR EACH ROW
EXECUTE FUNCTION trigger_on_tournament_created();
            `;

            console.log('🎯 Trigger SQL to apply manually:');
            console.log('');
            console.log(triggerSQL);
            console.log('');

            console.log('💡 Please apply these SQL statements in the Supabase SQL editor to complete setup');
          } else {
            console.log('✅ Function already exists and working!');
          }
        } catch (error) {
          console.log('❌ Function test failed:', error);
        }
      } else {
        console.error('❌ Database connection issue:', testError);
      }
    } else {
      console.log('✅ Function created successfully');
    }

    console.log('\n🧪 Testing current auto-population setup...');

    // Test by manually calling populate function for existing tournaments
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name');

    if (tournaments) {
      for (const tournament of tournaments) {
        try {
          await supabase.rpc('populate_default_achievements', {
            p_tournament_id: tournament.id
          });
          console.log(`✅ Populated achievements for ${tournament.name}`);
        } catch (error) {
          console.log(`⚠️ Could not populate ${tournament.name}: Function may not exist yet`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

applyAutoPopulationFunctions().catch(console.error);