import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGamesDatabaseFields() {
  console.log('🔍 Checking actual fields in games_database table...\n');

  try {
    // Get one record to see all actual fields
    const { data: sample, error } = await supabase
      .from('games_database')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }

    if (sample && sample.length > 0) {
      console.log('✅ games_database table structure:');
      console.log('Available fields:');

      const fields = Object.keys(sample[0]);
      fields.forEach(field => {
        const value = sample[0][field];
        const type = typeof value;
        const preview = type === 'string' && value && value.length > 50
          ? value.substring(0, 50) + '...'
          : value;
        console.log(`   - ${field}: ${type} = ${preview}`);
      });

      console.log(`\nTotal fields: ${fields.length}`);
    } else {
      console.log('❌ No data found in games_database table');
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkGamesDatabaseFields().catch(console.error);