import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGamesSchema() {
  console.log('🔍 Checking games_database table schema...');

  // Try to fetch a few games to see what columns exist
  const { data: sampleGames, error } = await supabase
    .from('games_database')
    .select('*')
    .limit(3);

  if (error) {
    console.error('❌ Error fetching sample games:', error);
    return;
  }

  if (sampleGames && sampleGames.length > 0) {
    console.log('✅ Sample games data structure:');
    console.log('Available columns:', Object.keys(sampleGames[0]));
    console.log('\n📋 Sample data:');
    sampleGames.forEach((game, index) => {
      console.log(`Game ${index + 1}:`, game);
    });
  } else {
    console.log('❌ No games found in database');
  }
}

checkGamesSchema().catch(console.error);