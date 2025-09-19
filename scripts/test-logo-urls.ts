// Test LaunchBox clear logo URL patterns
async function testLogoUrls() {
  console.log('🧪 Testing LaunchBox clear logo URL patterns...\n');

  // Test URLs for Pac-Man (popular game, likely to have logos)
  const testUrls = [
    'https://images.launchbox-app.com/clearlogo/10675-01.png',
    'https://images.launchbox-app.com/clearlogo/10675-02.png',
    'https://images.launchbox-app.com/clearlogo/10675-03.png',
    'https://images.launchbox-app.com/clearlogo/10675.png',
    'https://images.launchbox-app.com/10675-clearlogo.png',
    'https://images.launchbox-app.com/games/10675-clearlogo.png',

    // Alternative pattern testing
    'https://images.launchbox-app.com/clearlogo-10675.png',
    'https://images.launchbox-app.com/clear-logo/10675-01.png',
  ];

  for (const url of testUrls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      console.log(`${response.ok ? '✅' : '❌'} ${url} -> ${response.status}`);
    } catch (error) {
      console.log(`❌ ${url} -> Error: ${error.message}`);
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n🔍 Now testing a different game ID...');

  // Test with a different database ID
  const altUrls = [
    'https://images.launchbox-app.com/clearlogo/11000-01.png',
    'https://images.launchbox-app.com/clearlogo/12000-01.png',
    'https://images.launchbox-app.com/clearlogo/15000-01.png',
  ];

  for (const url of altUrls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      console.log(`${response.ok ? '✅' : '❌'} ${url} -> ${response.status}`);
    } catch (error) {
      console.log(`❌ ${url} -> Error: ${error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

testLogoUrls();