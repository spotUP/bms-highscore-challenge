import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCurrentSchema() {
  console.log('🔍 Checking current database schema...\n');

  try {
    // Check available tables
    console.log('1. Available tables:');
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (tableError) {
      console.log('❌ Error fetching tables:', tableError);
    } else {
      console.log('✅ Tables found:');
      tables?.forEach(table => console.log(`   - ${table.table_name}`));
    }

    // Check scores table structure
    console.log('\n2. Scores table structure:');
    const { data: scoreColumns, error: scoreError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'scores')
      .order('ordinal_position');

    if (scoreError) {
      console.log('❌ Error fetching scores columns:', scoreError);
    } else {
      console.log('✅ Scores table columns:');
      scoreColumns?.forEach(col =>
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
      );
    }

    // Check achievements table structure
    console.log('\n3. Achievements table structure:');
    const { data: achColumns, error: achError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'achievements')
      .order('ordinal_position');

    if (achError) {
      console.log('❌ Error fetching achievements columns:', achError);
    } else {
      console.log('✅ Achievements table columns:');
      achColumns?.forEach(col =>
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
      );
    }

    // Check player_achievements table structure
    console.log('\n4. Player achievements table structure:');
    const { data: playerAchColumns, error: playerAchError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'player_achievements')
      .order('ordinal_position');

    if (playerAchError) {
      console.log('❌ Error fetching player_achievements columns:', playerAchError);
    } else {
      console.log('✅ Player achievements table columns:');
      playerAchColumns?.forEach(col =>
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
      );
    }

    // Check functions
    console.log('\n5. Available functions:');
    const { data: functions, error: funcError } = await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_type')
      .eq('routine_schema', 'public')
      .order('routine_name');

    if (funcError) {
      console.log('❌ Error fetching functions:', funcError);
    } else {
      console.log('✅ Functions found:');
      functions?.forEach(func =>
        console.log(`   - ${func.routine_name}: ${func.routine_type}`)
      );
    }

    // Check triggers
    console.log('\n6. Available triggers:');
    const { data: triggers, error: trigError } = await supabase
      .from('information_schema.triggers')
      .select('trigger_name, event_object_table, action_timing, event_manipulation')
      .eq('trigger_schema', 'public')
      .order('trigger_name');

    if (trigError) {
      console.log('❌ Error fetching triggers:', trigError);
    } else if (triggers && triggers.length > 0) {
      console.log('✅ Triggers found:');
      triggers?.forEach(trigger =>
        console.log(`   - ${trigger.trigger_name} on ${trigger.event_object_table} (${trigger.action_timing} ${trigger.event_manipulation})`)
      );
    } else {
      console.log('❌ No triggers found');
    }

  } catch (error) {
    console.error('❌ Schema check failed:', error);
  }
}

checkCurrentSchema().catch(console.error);