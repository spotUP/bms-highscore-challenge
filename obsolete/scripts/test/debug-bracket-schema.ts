import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function debugBracketSchema() {
  console.log('🔍 Debugging bracket tables schema...');

  // Check the column information for bracket_players table
  console.log('\n📋 bracket_players table structure:');
  const { data: playersSchema, error: playersError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'bracket_players'
      ORDER BY ordinal_position;
    `
  });

  if (playersError) {
    console.error('❌ Error fetching bracket_players schema:', playersError);
  } else {
    console.table(playersSchema);
  }

  // Check the column information for bracket_matches table
  console.log('\n⚔️ bracket_matches table structure:');
  const { data: matchesSchema, error: matchesError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'bracket_matches'
      ORDER BY ordinal_position;
    `
  });

  if (matchesError) {
    console.error('❌ Error fetching bracket_matches schema:', matchesError);
  } else {
    console.table(matchesSchema);
  }

  // Check foreign key constraints on bracket_matches
  console.log('\n🔗 Foreign key constraints on bracket_matches:');
  const { data: constraints, error: constraintsError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE
        tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'bracket_matches';
    `
  });

  if (constraintsError) {
    console.error('❌ Error fetching constraints:', constraintsError);
  } else {
    console.table(constraints);
  }
}

debugBracketSchema().catch(console.error);