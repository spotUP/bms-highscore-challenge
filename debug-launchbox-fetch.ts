#!/usr/bin/env tsx

// Debug script to test LaunchBox fetching
async function testLaunchBoxFetch(gameId: number, gameName: string) {
  try {
    console.log(`🔍 Testing LaunchBox fetch for ${gameName} (ID: ${gameId})`);

    const gamePageUrl = `https://gamesdb.launchbox-app.com/games/details/${gameId}`;
    console.log(`📍 URL: ${gamePageUrl}`);

    const response = await fetch(gamePageUrl);
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.log('❌ Response not OK');
      return;
    }

    const html = await response.text();
    console.log(`📄 HTML length: ${html.length} characters`);

    // Look for all img tags
    const allImgMatches = html.match(/<img[^>]*>/gi);
    console.log(`🖼️  Found ${allImgMatches?.length || 0} img tags total`);

    if (allImgMatches) {
      console.log('\n🔍 All img tags found:');
      allImgMatches.forEach((img, index) => {
        console.log(`  ${index + 1}: ${img}`);
      });
    }

    // Test current regex pattern
    const clearLogoMatch = html.match(/<img[^>]+class="[^"]*boxart[^"]*"[^>]+src="([^"]+clear-logo[^"]+)"/i);
    console.log(`\n🎯 Current regex result: ${clearLogoMatch ? 'MATCH FOUND' : 'NO MATCH'}`);
    if (clearLogoMatch) {
      console.log(`   Logo URL: ${clearLogoMatch[1]}`);
    }

    // Look for any URLs containing "logo" or "clear"
    const logoUrlMatches = html.match(/https?:\/\/[^"\s]+(?:logo|clear)[^"\s]*/gi);
    console.log(`\n🔍 URLs containing 'logo' or 'clear': ${logoUrlMatches?.length || 0}`);
    if (logoUrlMatches) {
      logoUrlMatches.forEach((url, index) => {
        console.log(`  ${index + 1}: ${url}`);
      });
    }

    // Look for any image URLs from gamesdb-images.launchbox.gg
    const launchboxImageMatches = html.match(/https?:\/\/gamesdb-images\.launchbox\.gg[^"\s]*/gi);
    console.log(`\n🔍 LaunchBox image URLs: ${launchboxImageMatches?.length || 0}`);
    if (launchboxImageMatches) {
      launchboxImageMatches.forEach((url, index) => {
        console.log(`  ${index + 1}: ${url}`);
      });
    }

    // Save a sample of the HTML for manual inspection
    const htmlSample = html.substring(0, 2000);
    console.log(`\n📝 HTML Sample (first 2000 chars):`);
    console.log(htmlSample);

  } catch (error) {
    console.error(`❌ Error: ${error}`);
  }
}

// Test with Super Mario Bros NES
testLaunchBoxFetch(-49860, "Super Mario Bros.").catch(console.error);