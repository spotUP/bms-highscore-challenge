import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wmjfhmhgxnokjfzflqru.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtamZobWhneG5va2pmemZscXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY1MDUyNzMsImV4cCI6MjA0MjA4MTI3M30.9Sj-a-xeJz-KD9TUKzpGjrV-fP7Y9wqWoGjZzXrKF1k';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRatings() {
  console.log('🎮 Checking game rating data...\n');

  // Check total games
  const { count: totalGames } = await supabase
    .from('games_database')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total games in database: ${totalGames?.toLocaleString()}`);

  // Check games with community ratings
  const { count: gamesWithRatings } = await supabase
    .from('games_database')
    .select('*', { count: 'exact', head: true })
    .not('community_rating', 'is', null);

  console.log(`⭐ Games with community ratings: ${gamesWithRatings?.toLocaleString()}`);

  if (gamesWithRatings > 0) {
    const percentage = ((gamesWithRatings / totalGames) * 100).toFixed(1);
    console.log(`📈 Percentage with ratings: ${percentage}%`);

    // Get sample of rated games
    const { data: sampleGames } = await supabase
      .from('games_database')
      .select('name, platform_name, community_rating, community_rating_count')
      .not('community_rating', 'is', null)
      .order('community_rating', { ascending: false })
      .limit(10);

    console.log('\n🏆 Top 10 highest rated games:');
    sampleGames?.forEach((game, index) => {
      console.log(`${index + 1}. ${game.name} (${game.platform_name}): ${game.community_rating}/5 (${game.community_rating_count} votes)`);
    });

    // Rating distribution
    const { data: ratingStats } = await supabase
      .from('games_database')
      .select('community_rating')
      .not('community_rating', 'is', null);

    if (ratingStats && ratingStats.length > 0) {
      const ratings = ratingStats.map(g => g.community_rating);
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      const min = Math.min(...ratings);
      const max = Math.max(...ratings);

      console.log('\n📊 Rating statistics:');
      console.log(`Average rating: ${avg.toFixed(2)}/5`);
      console.log(`Range: ${min} - ${max}`);

      // Rating buckets
      const buckets = {
        '4.5-5.0': 0,
        '4.0-4.4': 0,
        '3.5-3.9': 0,
        '3.0-3.4': 0,
        '2.5-2.9': 0,
        '2.0-2.4': 0,
        '1.5-1.9': 0,
        '1.0-1.4': 0,
        '0.5-0.9': 0,
        '0.0-0.4': 0
      };

      ratings.forEach(rating => {
        if (rating >= 4.5) buckets['4.5-5.0']++;
        else if (rating >= 4.0) buckets['4.0-4.4']++;
        else if (rating >= 3.5) buckets['3.5-3.9']++;
        else if (rating >= 3.0) buckets['3.0-3.4']++;
        else if (rating >= 2.5) buckets['2.5-2.9']++;
        else if (rating >= 2.0) buckets['2.0-2.4']++;
        else if (rating >= 1.5) buckets['1.5-1.9']++;
        else if (rating >= 1.0) buckets['1.0-1.4']++;
        else if (rating >= 0.5) buckets['0.5-0.9']++;
        else buckets['0.0-0.4']++;
      });

      console.log('\n📈 Rating distribution:');
      Object.entries(buckets).forEach(([bucket, count]) => {
        const percentage = ((count / ratings.length) * 100).toFixed(1);
        console.log(`${bucket}: ${count.toLocaleString()} games (${percentage}%)`);
      });
    }
  } else {
    console.log('❌ No community ratings found in database');
  }

  // Check for other rating sources we could add
  console.log('\n🚀 Additional rating sources we could integrate:');
  console.log('• RAWG API - Modern games ratings and reviews');
  console.log('• IGDB API - Comprehensive game database with ratings');
  console.log('• Metacritic API - Professional review scores');
  console.log('• Steam API - User reviews and scores');
  console.log('• MobyGames API - Classic and retro game ratings');

  process.exit(0);
}

checkRatings().catch(console.error);