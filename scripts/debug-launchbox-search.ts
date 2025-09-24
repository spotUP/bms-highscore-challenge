#!/usr/bin/env tsx

// Debug what happens when we search LaunchBox by name

console.log('🔍 Debugging LaunchBox search...');

async function testSearch(gameName: string) {
  console.log(`\n🎮 Testing search for: "${gameName}"`);

  try {
    const searchUrl = `https://gamesdb.launchbox-app.com/games/search?query=${encodeURIComponent(gameName)}`;
    console.log(`🌐 URL: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(10000)
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const html = await response.text();

      // Look for the page title
      const titleMatch = html.match(/<title>([^<]+)</);
      if (titleMatch) {
        console.log(`📄 Page title: "${titleMatch[1]}"`);
      }

      // Look for any game links in results
      const gameLinks = html.match(/href="\/games\/details\/\d+"[^>]*>[^<]+</g);

      if (gameLinks && gameLinks.length > 0) {
        console.log(`🎯 Found ${gameLinks.length} potential game links:`);
        gameLinks.slice(0, 3).forEach(link => {
          const match = link.match(/href="\/games\/details\/(\d+)"[^>]*>([^<]+)</);
          if (match) {
            console.log(`   ID ${match[1]}: "${match[2]}"`);
          }
        });
      } else {
        console.log(`❌ No game links found`);

        // Check if search returned any results at all
        if (html.includes('No games found') || html.includes('0 results')) {
          console.log(`   Search returned no results`);
        } else {
          console.log(`   Page content length: ${html.length} chars`);
          // Look for common elements that indicate a working page
          if (html.includes('LaunchBox')) {
            console.log(`   ✅ Page appears to be LaunchBox`);
          } else {
            console.log(`   ❌ Page might not be LaunchBox`);
          }
        }
      }
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

// Test with simple game names
await testSearch('Halo');
await testSearch('BioShock');
await testSearch('Crysis');

// Test what we know should work - the original LaunchBox approach
console.log(`\n🧪 Testing direct game page access:`);
try {
  const directUrl = 'https://gamesdb.launchbox-app.com/games/details/1'; // ID 1 should exist
  console.log(`🌐 Direct URL: ${directUrl}`);

  const response = await fetch(directUrl);
  console.log(`📊 Status: ${response.status} ${response.statusText}`);

  if (response.ok) {
    const html = await response.text();
    const titleMatch = html.match(/<title>([^<]+)</);
    if (titleMatch) {
      console.log(`📄 Game at ID 1: "${titleMatch[1]}"`);
    }
  }
} catch (error) {
  console.log(`❌ Direct access error: ${error.message}`);
}