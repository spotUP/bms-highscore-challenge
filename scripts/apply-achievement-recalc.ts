import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Environment check:');
console.log('URL exists:', !!supabaseUrl);
console.log('Service key exists:', !!serviceRoleKey);
console.log('Anon key exists:', !!anonKey);

const useServiceRole = serviceRoleKey && serviceRoleKey !== '';
const key = useServiceRole ? serviceRoleKey : anonKey;

if (!supabaseUrl || !key) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

console.log(`🔑 Using ${useServiceRole ? 'SERVICE ROLE' : 'ANON'} key`);
const supabase = createClient(supabaseUrl, key);

async function applyAchievementRecalc() {
  console.log('🔧 Applying achievement recalculation functions...');

  try {
    // Read the SQL file
    const sqlPath = resolve(__dirname, '..', 'APPLY_ACHIEVEMENT_RECALC.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    const { error } = await supabase.rpc('execute_sql', { sql_text: sql });

    if (error) {
      console.error('❌ Error applying achievement recalculation:', error);
      process.exit(1);
    }

    console.log('✅ Achievement recalculation functions applied successfully!');
    console.log('');
    console.log('📝 New functions available:');
    console.log('  - recalculate_achievements_after_deletion(player_name, tournament_id)');
    console.log('  - recalculate_all_achievements_for_tournament(tournament_id)');
    console.log('');
    console.log('🎯 Trigger added:');
    console.log('  - achievement_recalc_on_delete_trigger (runs automatically on score deletion)');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

applyAchievementRecalc();