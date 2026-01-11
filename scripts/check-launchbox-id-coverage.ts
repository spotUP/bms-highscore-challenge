import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLaunchBoxCoverage() {
  console.log('🔍 Checking LaunchBox ID coverage in Supabase...\n');

  try {
    // Get total count of all games
    const { count: totalGames, error: totalError } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('❌ Error getting total games:', totalError);
      return;
    }

    // Get count of games with LaunchBox IDs (not null)
    const { count: gamesWithLaunchBoxId, error: withIdError } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true })
      .not('launchbox_id', 'is', null);

    if (withIdError) {
      console.error('❌ Error getting games with LaunchBox ID:', withIdError);
      return;
    }

    // Get count of games without LaunchBox IDs (null)
    const { count: gamesWithoutLaunchBoxId, error: withoutIdError } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true })
      .is('launchbox_id', null);

    if (withoutIdError) {
      console.error('❌ Error getting games without LaunchBox ID:', withoutIdError);
      return;
    }

    console.log('📊 LaunchBox ID Coverage Analysis:');
    console.log(`   Total Games in Database: ${totalGames?.toLocaleString()}`);
    console.log(`   Games WITH LaunchBox ID: ${gamesWithLaunchBoxId?.toLocaleString()}`);
    console.log(`   Games WITHOUT LaunchBox ID: ${gamesWithoutLaunchBoxId?.toLocaleString()}`);
    console.log(`   Coverage Percentage: ${((gamesWithLaunchBoxId || 0) / (totalGames || 1) * 100).toFixed(1)}%`);

    console.log('\n🎯 This explains why the hybrid scraper only processes ~45K games:');
    console.log('   The scraper requires LaunchBox IDs to fetch logos from LaunchBox GameDB');
    console.log(`   Only ${((gamesWithLaunchBoxId || 0) / (totalGames || 1) * 100).toFixed(1)}% of games have LaunchBox IDs`);

    // Sample some games without LaunchBox IDs to see what they are
    console.log('\n🔍 Sample of games WITHOUT LaunchBox IDs:');
    const { data: sampleGames, error: sampleError } = await supabase
      .from('games_database')
      .select('id, name, platform_name')
      .is('launchbox_id', null)
      .limit(10);

    if (!sampleError && sampleGames) {
      sampleGames.forEach(game => {
        console.log(`   ID ${game.id}: "${game.name}" (${game.platform_name})`);
      });
    }

    // Check some platform distribution for games without LaunchBox IDs
    console.log('\n📱 Platform distribution for games WITHOUT LaunchBox IDs:');
    const { data: platformStats, error: platformError } = await supabase
      .from('games_database')
      .select('platform_name')
      .is('launchbox_id', null);

    if (!platformError && platformStats) {
      const platformCounts: { [key: string]: number } = {};
      platformStats.forEach(game => {
        platformCounts[game.platform_name] = (platformCounts[game.platform_name] || 0) + 1;
      });

      const sortedPlatforms = Object.entries(platformCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

      sortedPlatforms.forEach(([platform, count]) => {
        console.log(`   ${platform}: ${count.toLocaleString()} games`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkLaunchBoxCoverage();