#!/usr/bin/env npx tsx

// Quick test to see RAWG videos for Super Mario Bros
const RAWG_API_KEY = process.env.VITE_RAWG_API_KEY;

async function testRAWGVideos() {
  if (!RAWG_API_KEY) {
    console.log('❌ RAWG API key not found');
    return;
  }

  const gameNames = [
    'Super Mario Bros'
  ];

  for (const gameName of gameNames) {
  console.log(`🎬 Testing RAWG videos for "${gameName}"...`);

  try {
    // First, get the game slug
    const searchResponse = await fetch(
      `https://api.rawg.io/api/games?search=${encodeURIComponent(gameName)}&key=${RAWG_API_KEY}`
    );

    if (!searchResponse.ok) {
      console.log('❌ Search request failed');
      return;
    }

    const searchData = await searchResponse.json();
    if (!searchData.results?.length) {
      console.log('❌ No games found');
      return;
    }

    const game = searchData.results[0];
    console.log(`✅ Found game: ${game.name} (slug: ${game.slug})`);

    // Get videos for this game
    const videoResponse = await fetch(
      `https://api.rawg.io/api/games/${game.slug}/movies?key=${RAWG_API_KEY}`
    );

    if (!videoResponse.ok) {
      console.log('❌ Video request failed');
      return;
    }

    const videoData = await videoResponse.json();

    console.log('📄 Raw API response:', JSON.stringify(videoData, null, 2));

    if (!videoData.results?.length) {
      console.log('⚠️ No videos found for this game');

      // Let's also try checking if there are other video-related fields
      console.log('🔍 Checking full game details for other video fields...');

      const gameResponse = await fetch(
        `https://api.rawg.io/api/games/${game.slug}?key=${RAWG_API_KEY}`
      );

      if (gameResponse.ok) {
        const gameData = await gameResponse.json();
        console.log('🎮 Game details response:', JSON.stringify(gameData, null, 2));
      }

      return;
    }

    console.log(`🎥 Found ${videoData.results.length} videos:`);

    videoData.results.forEach((video: any, index: number) => {
      console.log(`\n${index + 1}. ${video.name || 'Unnamed Video'}`);
      console.log(`   ID: ${video.id}`);
      console.log(`   Preview: ${video.preview || 'No preview'}`);
      console.log(`   Max Quality: ${video.data?.max || 'Not available'}`);
      console.log(`   480p: ${video.data?.['480'] || 'Not available'}`);

      // Check if it's a YouTube video
      const videoUrl = video.data?.max || video.data?.['480'] || '';
      const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
      console.log(`   Type: ${isYouTube ? 'YouTube' : 'Direct Video'}`);
    });

  } catch (error) {
    console.error(`❌ Error for ${gameName}:`, error);
  }

  console.log('---\n');
  }
}

testRAWGVideos().then(() => process.exit(0));