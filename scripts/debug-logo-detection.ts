#!/usr/bin/env tsx

// Debug why logo detection isn't working on LaunchBox pages

async function debugLogoDetection(launchboxId: number, gameName: string) {
  console.log(`🔍 Debugging logo detection for ${gameName} (LaunchBox ID: ${launchboxId})`);

  try {
    const gamePageUrl = `https://gamesdb.launchbox-app.com/games/details/${launchboxId}`;
    console.log(`🌐 URL: ${gamePageUrl}`);

    const response = await fetch(gamePageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const html = await response.text();

    // Check page title
    const titleMatch = html.match(/<title>([^<]+)/);
    if (titleMatch) {
      console.log(`📄 Page title: "${titleMatch[1]}"`);
    }

    // Look for ANY images that might be logos
    console.log('\n🖼️  Looking for images...');

    // Try different logo patterns
    const patterns = [
      /src="([^"]*Clear[^"]*\.(?:png|jpg|jpeg|webp))"/gi,
      /src="([^"]*Logo[^"]*\.(?:png|jpg|jpeg|webp))"/gi,
      /src="([^"]*logo[^"]*\.(?:png|jpg|jpeg|webp))"/gi,
      /src="([^"]*)"\s*[^>]*alt="[^"]*Clear Logo[^"]*"/gi,
      /src="([^"]*)"\s*[^>]*alt="[^"]*Logo[^"]*"/gi
    ];

    let foundAny = false;
    for (const pattern of patterns) {
      const matches = [...html.matchAll(pattern)];
      if (matches.length > 0) {
        console.log(`✅ Pattern found ${matches.length} matches:`);
        matches.slice(0, 3).forEach(match => {
          console.log(`   ${match[1]}`);
        });
        foundAny = true;
      }
    }

    if (!foundAny) {
      console.log(`❌ No logo patterns found`);

      // Look for any image references to understand the page structure
      const allImages = html.match(/src="([^"]*\.(?:png|jpg|jpeg|webp))"/gi);
      if (allImages) {
        console.log(`📋 Found ${allImages.length} total images, first few:`);
        allImages.slice(0, 5).forEach(img => console.log(`   ${img}`));
      } else {
        console.log(`❌ No images found at all`);
      }

      // Check if page has any content
      console.log(`📊 Page length: ${html.length} characters`);
      if (html.includes('LaunchBox')) {
        console.log(`✅ Page appears to be LaunchBox`);
      } else {
        console.log(`❌ Page might not be LaunchBox`);
      }
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

// Test with a few games
await debugLogoDetection(1, 'Halo: Combat Evolved');
await debugLogoDetection(10, 'BioShock');
await debugLogoDetection(29, 'Jade Empire: Special Edition');