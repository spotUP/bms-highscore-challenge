#!/usr/bin/env tsx

// Test what the LaunchBox API returns for specific IDs

console.log('🔍 Testing LaunchBox API directly...');

// Test the fetch function from the scraper
async function fetchClearLogoByGameId(gameId: number, gameName: string): Promise<string | null> {
  try {
    const gamePageUrl = `https://gamesdb.launchbox-app.com/games/details/${gameId}`;

    console.log(`🌐 Fetching: ${gamePageUrl}`);
    console.log(`📋 Expected game: ${gameName}`);

    const gamePageResponse = await fetch(gamePageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!gamePageResponse.ok) {
      console.log(`❌ HTTP ${gamePageResponse.status}: ${gamePageResponse.statusText}`);
      return null;
    }

    const html = await gamePageResponse.text();

    // Extract the game title from the HTML
    const titleMatch = html.match(/<title>([^<]+)/);
    const pageTitle = titleMatch ? titleMatch[1].trim() : 'Unknown';
    console.log(`📄 Page title: "${pageTitle}"`);

    // Look for clear logo
    const clearLogoMatch = html.match(/src="([^"]*Clear[^"]*\.(?:png|jpg|jpeg|webp))"[^>]*alt="[^"]*Clear Logo[^"]*"/i);

    if (clearLogoMatch) {
      const logoUrl = clearLogoMatch[1];
      console.log(`🖼️  Found clear logo: ${logoUrl}`);

      // Check if the logo URL contains the game name or a similar name
      if (pageTitle.toLowerCase().includes(gameName.toLowerCase().split(':')[0].toLowerCase()) ||
          logoUrl.toLowerCase().includes(gameName.toLowerCase().split(':')[0].toLowerCase())) {
        console.log(`✅ Logo appears to match expected game`);
      } else {
        console.log(`🚨 WARNING: Logo might not match expected game!`);
        console.log(`   Expected: "${gameName}"`);
        console.log(`   Page shows: "${pageTitle}"`);
      }

      return logoUrl; // Would normally fetch and convert to base64
    } else {
      console.log(`❌ No clear logo found on page`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

// Test the problematic IDs
console.log('\n🧪 Testing Jade Empire (LaunchBox ID 32):');
await fetchClearLogoByGameId(32, 'Jade Empire: Special Edition');

console.log('\n🧪 Testing Killzone (LaunchBox ID 35):');
await fetchClearLogoByGameId(35, 'Killzone');

console.log('\n🧪 Testing Killzone 2 (LaunchBox ID 36):');
await fetchClearLogoByGameId(36, 'Killzone 2');

console.log('\n💡 This should reveal if LaunchBox is returning the wrong logos for these IDs!');