import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixAchievements() {
  console.log('🔧 Fixing achievement system...\n');

  try {
    // Read the migration file
    const migrationPath = resolve(__dirname, '..', 'supabase', 'migrations', '20250915000000_fix_achievement_system.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(/;\s*$/m)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim() + ';');

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments
      if (statement.startsWith('--') || statement.trim() === ';') {
        continue;
      }

      // Extract a brief description
      const firstLine = statement.split('\n')[0].substring(0, 60);
      console.log(`[${i + 1}/${statements.length}] Executing: ${firstLine}...`);

      try {
        // Use raw SQL execution through a function (if available)
        const { error } = await supabase.rpc('exec_sql' as any, { sql: statement });

        if (error) {
          // Try alternative approach - direct execution might not be available
          console.log(`   ⚠️ exec_sql not available, statement skipped: ${error.message}`);
        } else {
          console.log(`   ✅ Success`);
        }
      } catch (err: any) {
        console.log(`   ⚠️ Error: ${err.message}`);
      }
    }

    // Test if the new function exists
    console.log('\n🧪 Testing new achievement function...');
    const { error: testError } = await supabase.rpc('check_and_award_achievements_v2' as any, {
      p_score_id: '00000000-0000-0000-0000-000000000000',
      p_player_name: 'TEST',
      p_game_id: '00000000-0000-0000-0000-000000000000',
      p_score: 0,
      p_tournament_id: '00000000-0000-0000-0000-000000000000',
      p_user_id: null
    });

    if (testError) {
      console.log('❌ New function not created:', testError.message);
      console.log('\n⚠️ Manual intervention required. Please run the migration SQL directly in Supabase dashboard.');
    } else {
      console.log('✅ New achievement function is working!');
    }

    // Check player achievements again
    const { data: playerAchievements, error: paError } = await supabase
      .from('player_achievements')
      .select('*')
      .limit(10);

    if (!paError) {
      console.log(`\n📊 Player achievements after fix: ${playerAchievements?.length || 0} found`);
    }

  } catch (error) {
    console.error('Error during fix:', error);
  }
}

fixAchievements().then(() => {
  console.log('\n✨ Achievement fix attempt complete');
  console.log('\nNext steps:');
  console.log('1. Go to Supabase dashboard > SQL Editor');
  console.log('2. Copy the contents of supabase/migrations/20250915000000_fix_achievement_system.sql');
  console.log('3. Run it directly in the SQL editor');
  console.log('4. Submit a new score to test if achievements are awarded');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});