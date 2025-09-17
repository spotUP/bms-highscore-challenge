import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wmjfhmhgxnokjfzflqru.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtamZobWhneG5va2pmemZscXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY1MDUyNzMsImV4cCI6MjA0MjA4MTI3M30.9Sj-a-xeJz-KD9TUKzpGjrV-fP7Y9wqWoGjZzXrKF1k';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRatings() {
  console.log('🔍 Debugging rating data...\n');

  // Get a larger sample to see the actual data
  const { data: sampleRatings } = await supabase
    .from('games_database')
    .select('name, platform_name, community_rating, community_rating_count')
    .not('community_rating', 'is', null)
    .limit(50);

  console.log('📋 Sample of games with ratings:');
  sampleRatings?.slice(0, 20).forEach((game, index) => {
    console.log(`${index + 1}. ${game.name}: ${game.community_rating} (${game.community_rating_count} votes)`);
  });

  // Check rating value distribution
  const ratingValues = {};
  sampleRatings?.forEach(game => {
    const rating = game.community_rating;
    ratingValues[rating] = (ratingValues[rating] || 0) + 1;
  });

  console.log('\n📊 Rating value distribution in sample:');
  Object.entries(ratingValues)
    .sort(([a], [b]) => parseFloat(b) - parseFloat(a))
    .forEach(([rating, count]) => {
      console.log(`${rating}: ${count} games`);
    });

  // Check if there are any games with substantial ratings
  const { data: substantialRatings } = await supabase
    .from('games_database')
    .select('name, platform_name, community_rating, community_rating_count')
    .not('community_rating', 'is', null)
    .gte('community_rating_count', 5)
    .order('community_rating_count', { ascending: false })
    .limit(20);

  console.log('\n🎯 Games with 5+ rating votes:');
  if (substantialRatings && substantialRatings.length > 0) {
    substantialRatings.forEach((game, index) => {
      console.log(`${index + 1}. ${game.name} (${game.platform_name}): ${game.community_rating}/5 (${game.community_rating_count} votes)`);
    });
  } else {
    console.log('❌ No games found with 5+ votes');
  }

  // Check for games with higher ratings
  const { data: highRatings } = await supabase
    .from('games_database')
    .select('name, platform_name, community_rating, community_rating_count')
    .gte('community_rating', 3.0)
    .order('community_rating', { ascending: false })
    .limit(20);

  console.log('\n⭐ Games with ratings >= 3.0:');
  if (highRatings && highRatings.length > 0) {
    highRatings.forEach((game, index) => {
      console.log(`${index + 1}. ${game.name} (${game.platform_name}): ${game.community_rating}/5 (${game.community_rating_count} votes)`);
    });
  } else {
    console.log('❌ No games found with ratings >= 3.0');
  }

  process.exit(0);
}

debugRatings().catch(console.error);