import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wmjfhmhgxnokjfzflqru.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtamZobWhneG5va2pmemZscXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY1MDUyNzMsImV4cCI6MjA0MjA4MTI3M30.9Sj-a-xeJz-KD9TUKzpGjrV-fP7Y9wqWoGjZzXrKF1k';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRAWGIntegration() {
  console.log('🎯 Testing RAWG API Integration...\n');

  // Get RAWG API key from environment
  const rawgApiKey = process.env.VITE_RAWG_API_KEY;

  if (!rawgApiKey) {
    console.log('❌ RAWG API key not found in environment variables');
    console.log('Make sure VITE_RAWG_API_KEY is set in your .env file');
    return;
  }

  console.log('✅ RAWG API key found in environment');

  // Test RAWG API directly
  console.log('\n🔍 Testing direct RAWG API call...');

  try {
    const testGame = 'Super Mario World';
    const searchQuery = encodeURIComponent(testGame);
    const response = await fetch(
      `https://api.rawg.io/api/games?key=${rawgApiKey}&search=${searchQuery}&page_size=3`
    );

    if (!response.ok) {
      console.log(`❌ RAWG API error: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    console.log('✅ RAWG API connection successful!');
    console.log(`📊 Found ${data.count} total games matching "${testGame}"`);

    if (data.results && data.results.length > 0) {
      console.log('\n🎮 Top 3 RAWG results:');
      data.results.forEach((game, index) => {
        console.log(`${index + 1}. ${game.name}`);
        console.log(`   Rating: ${game.rating}/5 (${game.ratings_count} ratings)`);
        console.log(`   Released: ${game.released || 'Unknown'}`);
        console.log(`   Platforms: ${game.platforms?.slice(0, 3).map(p => p.platform.name).join(', ')}`);
        console.log(`   URL: https://rawg.io/games/${game.slug}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error testing RAWG API:', error.message);
    return;
  }

  // Test with some popular games from our database
  console.log('\n🎮 Testing with games from our database...');

  const { data: testGames } = await supabase
    .from('games_database')
    .select('name, platform_name, community_rating, community_rating_count')
    .not('community_rating', 'is', null)
    .in('name', ['Super Mario World', 'The Legend of Zelda', 'Pac-Man', 'Tetris', 'Street Fighter II'])
    .limit(5);

  if (testGames && testGames.length > 0) {
    for (const game of testGames) {
      console.log(`\n🔍 Testing: ${game.name} (${game.platform_name})`);
      console.log(`   LaunchBox: ${game.community_rating}/5 (${game.community_rating_count} votes)`);

      try {
        const searchQuery = encodeURIComponent(game.name);
        const response = await fetch(
          `https://api.rawg.io/api/games?key=${rawgApiKey}&search=${searchQuery}&page_size=1`
        );

        if (response.ok) {
          const data = await response.json();
          const rawgGame = data.results?.[0];

          if (rawgGame && rawgGame.rating > 0) {
            console.log(`   RAWG: ${rawgGame.rating}/5 (${rawgGame.ratings_count} ratings)`);

            // Calculate simple average
            const launchboxNormalized = game.community_rating;
            const rawgNormalized = rawgGame.rating;
            const average = ((launchboxNormalized + rawgNormalized) / 2).toFixed(1);

            console.log(`   🎯 Combined Average: ${average}/5`);
            console.log(`   💪 Enhanced rating available!`);
          } else {
            console.log(`   ❌ No RAWG rating found`);
          }
        } else {
          console.log(`   ❌ RAWG API error: ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  console.log('\n🎉 RAWG integration test complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Visit /games page to see enhanced ratings in action');
  console.log('2. Click "More Info" on any game card to see rating sources');
  console.log('3. Look for confidence indicators (High/Medium/Low)');
  console.log('4. Enhanced ratings will show for games found in both databases');

  process.exit(0);
}

testRAWGIntegration().catch(console.error);