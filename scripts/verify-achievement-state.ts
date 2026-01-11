import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run(label: string, sql: string) {
  console.log(`\n=== ${label} ===`);
  const { data, error } = await supabase.rpc('execute_sql', { query: sql });
  if (error) {
    console.error('Error:', error);
  } else {
    // The execute_sql function may return rows serialized as JSON/text depending on implementation
    console.log('Result:', data);
  }
}

async function main() {
  await run('Player Achievements Tournament Trigger', `
    SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS def
    FROM pg_trigger 
    WHERE tgrelid = 'player_achievements'::regclass 
      AND NOT tgisinternal
      AND tgname = 'trg_set_player_achievements_tournament_id';
  `);

  await run('Scores Achievement Trigger (INSERT-only)', `
    SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS def
    FROM pg_trigger
    WHERE tgrelid = 'scores'::regclass
      AND tgname = 'achievement_check_trigger';
  `);

  await run('Remaining NULL tournament_id in player_achievements', `
    SELECT COUNT(*) AS remaining_nulls
    FROM player_achievements
    WHERE tournament_id IS NULL;
  `);

  await run('Unique constraint on (player_name, achievement_id)', `
    SELECT conname
    FROM pg_constraint
    WHERE conname = 'player_achievements_player_name_achievement_id_key';
  `);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
