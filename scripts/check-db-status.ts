import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseStatus() {
  try {
    const { count: total } = await supabase.from('games_database').select('*', { count: 'exact', head: true });
    const { count: withDbId } = await supabase.from('games_database').select('*', { count: 'exact', head: true }).not('database_id', 'is', null);
    const { count: withLogos } = await supabase.from('games_database').select('*', { count: 'exact', head: true }).not('logo_url', 'is', null);

    const dbIdCoverage = withDbId ? ((withDbId / total) * 100).toFixed(2) : '0.00';
    const logoCoverage = withLogos ? ((withLogos / total) * 100).toFixed(2) : '0.00';

    console.log('=== LaunchBox Database Analysis ===');
    console.log(`Total games: ${total?.toLocaleString() || 0}`);
    console.log(`With database_id: ${(withDbId || 0).toLocaleString()} (${dbIdCoverage}%)`);
    console.log(`With logos: ${(withLogos || 0).toLocaleString()} (${logoCoverage}%)`);

    // Sample games with database_id
    const { data: sampleWithIds } = await supabase
      .from('games_database')
      .select('name, database_id, logo_url')
      .not('database_id', 'is', null)
      .limit(5);

    console.log('\nSample games with database_id:');
    sampleWithIds?.forEach(game => {
      console.log(`  - ${game.name} (ID: ${game.database_id})`);
    });

    // Check platforms table
    const { count: platformCount } = await supabase.from('platforms').select('*', { count: 'exact', head: true });
    console.log(`\nPlatforms imported: ${platformCount || 0}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

checkDatabaseStatus();