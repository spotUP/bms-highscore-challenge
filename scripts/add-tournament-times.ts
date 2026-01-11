import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addTournamentTimes() {
  console.log('🔄 Adding start_time and end_time columns to tournaments table...');

  try {
    // Add the columns using direct SQL execution
    const { data, error } = await supabase
      .from('tournaments')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Error checking tournaments table:', error);
      return;
    }

    console.log('✅ Tournaments table exists');

    // Since we can't use rpc('exec_sql'), let's try using the SQL editor approach
    // or modify the table through the schema

    console.log('⚠️  Please add the following columns manually in Supabase Dashboard:');
    console.log('');
    console.log('-- Go to Table Editor > tournaments table and add these columns:');
    console.log('start_time: timestamp with time zone (nullable)');
    console.log('end_time: timestamp with time zone (nullable)');
    console.log('');
    console.log('-- Or run this SQL in the SQL Editor:');
    console.log('ALTER TABLE public.tournaments');
    console.log('ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE,');
    console.log('ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;');
    console.log('');
    console.log('ALTER TABLE public.tournaments');
    console.log('ADD CONSTRAINT check_tournament_times');
    console.log('CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time);');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the migration
addTournamentTimes();