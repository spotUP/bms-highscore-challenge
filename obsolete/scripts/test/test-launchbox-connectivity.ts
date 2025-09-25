#!/usr/bin/env npx tsx

// Simple test to check LaunchBox website connectivity
async function testConnectivity() {
  console.log('🧪 Testing LaunchBox website connectivity...\n');

  // Test basic connectivity with different URLs
  const testUrls = [
    'https://gamesdb.launchbox-app.com',
    'https://gamesdb.launchbox-app.com/games/details/140',  // Super Mario Bros
    'https://gamesdb.launchbox-app.com/games/details/1',    // Should be a simple game
  ];

  for (const url of testUrls) {
    console.log(`Testing: ${url}`);

    try {
      console.time('Response time');

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      console.timeEnd('Response time');
      console.log(`Status: ${response.status} ${response.statusText}`);
      console.log(`Content-Type: ${response.headers.get('content-type')}`);

      if (response.ok) {
        const text = await response.text();
        console.log(`Content length: ${text.length} characters`);

        // Check for some expected content
        if (text.includes('<html')) {
          console.log('✅ Got HTML response');
        } else {
          console.log('⚠️  Response is not HTML');
        }

        if (text.toLowerCase().includes('clear logo')) {
          console.log('✅ "Clear Logo" text found');
        } else {
          console.log('❌ "Clear Logo" text not found');
        }
      } else {
        console.log(`❌ HTTP error: ${response.status}`);
      }

    } catch (error) {
      console.log(`❌ Error: ${error}`);
    }

    console.log('');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between tests
  }

  // Try with a much longer timeout for just one URL
  console.log('Testing with 30-second timeout...');
  try {
    console.time('Long timeout test');
    const response = await fetch('https://gamesdb.launchbox-app.com/games/details/140', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    console.timeEnd('Long timeout test');
    console.log(`Status: ${response.status}`);

    if (response.ok) {
      console.log('✅ 30-second timeout test passed');
    } else {
      console.log('❌ 30-second timeout test failed');
    }
  } catch (error) {
    console.log(`❌ 30-second timeout test error: ${error}`);
  }

  console.log('\n🏁 Connectivity test complete');
}

testConnectivity().then(() => process.exit(0));