#!/usr/bin/env node

async function testRAWGSearch() {
  const apiKey = process.env.VITE_RAWG_API_KEY;
  if (!apiKey) {
    console.log('No RAWG API key found');
    return;
  }

  const gameName = 'R-Type Leo';
  console.log('Testing RAWG search for:', gameName);

  try {
    const response = await fetch(
      `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(gameName)}&page_size=5`
    );

    if (!response.ok) {
      console.error('RAWG API error:', response.status);
      return;
    }

    const data = await response.json();
    console.log('RAWG results count:', data.results?.length || 0);

    if (data.results && data.results.length > 0) {
      data.results.forEach((game: any, index: number) => {
        console.log(`${index + 1}. ${game.name}`);
        console.log(`   Slug: ${game.slug}`);
        console.log(`   Has image: ${!!game.background_image}`);
        if (game.background_image) {
          console.log(`   Image: ${game.background_image}`);
        }
        console.log('');
      });
    } else {
      console.log('No results found');
    }

    // Test search for just "R-Type"
    console.log('\\n--- Testing search for just "R-Type" ---');
    const response2 = await fetch(
      `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent('R-Type')}&page_size=5`
    );

    if (response2.ok) {
      const data2 = await response2.json();
      console.log('R-Type results count:', data2.results?.length || 0);

      if (data2.results && data2.results.length > 0) {
        data2.results.forEach((game: any, index: number) => {
          console.log(`${index + 1}. ${game.name}`);
          console.log(`   Has image: ${!!game.background_image}`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testRAWGSearch();