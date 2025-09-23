#!/usr/bin/env tsx

import 'dotenv/config';

async function debugSearchUrl() {
  console.log('🔍 Debugging LaunchBox search URL...\n');

  const testCases = [
    { name: 'Super Mario Bros', platform: 'Nintendo Entertainment System' },
    { name: 'Pac-Man', platform: 'Arcade' },
    { name: 'Tetris', platform: 'Nintendo Game Boy' }
  ];

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name} (${testCase.platform})`);

    // Try different URL formats
    const urlFormats = [
      `https://gamesdb.launchbox-app.com/games/search/${encodeURIComponent(testCase.name)}`,
      `https://gamesdb.launchbox-app.com/games/search?query=${encodeURIComponent(testCase.name)}`,
      `https://gamesdb.launchbox-app.com/games/search?query=${encodeURIComponent(testCase.name + ' ' + testCase.platform)}`,
      `https://gamesdb.launchbox-app.com/search?query=${encodeURIComponent(testCase.name)}`
    ];

    for (let i = 0; i < urlFormats.length; i++) {
      const url = urlFormats[i];
      console.log(`  URL ${i + 1}: ${url}`);

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          signal: AbortSignal.timeout(10000)
        });

        console.log(`    Status: ${response.status} ${response.statusText}`);

        if (response.ok) {
          const html = await response.text();
          console.log(`    HTML length: ${html.length} characters`);

          // Check if we can find game links
          const gamePagePattern = /href="[^"]*\/games\/details\/\d+"/g;
          const gameLinks = [...html.matchAll(gamePagePattern)];
          console.log(`    Game detail links found: ${gameLinks.length}`);

          if (gameLinks.length > 0) {
            console.log(`    First link: ${gameLinks[0][0]}`);
          }

          // Check if this looks like a search results page
          if (html.includes('search') || html.includes('results') || html.includes('games/details')) {
            console.log(`    ✅ Looks like valid search results`);
          } else {
            console.log(`    ❌ Doesn't look like search results`);
          }
        }

        console.log('');

        // If we found a working URL, no need to test others for this game
        if (response.ok) {
          const html = await response.text();
          const gamePagePattern = /href="[^"]*\/games\/details\/\d+"/g;
          const gameLinks = [...html.matchAll(gamePagePattern)];
          if (gameLinks.length > 0) {
            break;
          }
        }

      } catch (error) {
        console.log(`    ❌ Error: ${error}`);
        console.log('');
      }
    }

    console.log('\n---\n');
  }
}

debugSearchUrl().catch(console.error);