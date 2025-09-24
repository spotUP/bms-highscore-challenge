import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSingleLogo() {
  console.log('🔍 Testing single logo fetch...\n');

  // Get a specific game that was failing
  const { data: game, error } = await supabase
    .from('games_database')
    .select('id, name, platform_name, launchbox_id')
    .eq('id', 40377) // Super Mario Bros. 2
    .single();

  if (error || !game) {
    console.error('❌ Error getting game:', error);
    return;
  }

  console.log(`🎮 Testing game: ${game.name} (ID: ${game.id})`);
  console.log(`   Platform: ${game.platform_name}`);
  console.log(`   LaunchBox ID: ${game.launchbox_id}`);

  // Try to fetch the logo using the same logic as the hybrid scraper
  const launchboxUrl = `https://gamesdb.launchbox-app.com/games/details/${game.launchbox_id}-${game.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  console.log(`   LaunchBox URL: ${launchboxUrl}`);

  try {
    console.log('\n🌐 Fetching page...');
    const response = await fetch(launchboxUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const pageContent = await response.text();
    console.log(`✅ Page fetched successfully (${pageContent.length} characters)`);

    // Look for clear logo images (same logic as hybrid scraper)
    const clearLogoRegex = /<img[^>]*src="([^"]*ClearLogo[^"]*)"[^>]*>/gi;
    const logoMatches = [...pageContent.matchAll(clearLogoRegex)];

    console.log(`\n🔍 Found ${logoMatches.length} clear logo matches:`);
    logoMatches.forEach((match, i) => {
      console.log(`   ${i + 1}. ${match[1]}`);
    });

    if (logoMatches.length > 0) {
      const logoUrl = logoMatches[0][1];
      console.log(`\n🎯 Testing logo download: ${logoUrl}`);

      try {
        const logoResponse = await fetch(logoUrl, {
          signal: AbortSignal.timeout(10000)
        });

        if (logoResponse.ok) {
          const logoBuffer = await logoResponse.arrayBuffer();
          const mimeType = logoResponse.headers.get('content-type') || 'image/png';
          console.log(`✅ Logo downloaded successfully: ${logoBuffer.byteLength} bytes, ${mimeType}`);
        } else {
          console.log(`❌ Logo download failed: HTTP ${logoResponse.status}`);
        }
      } catch (logoError) {
        console.log(`❌ Logo download error: ${logoError}`);
      }
    } else {
      console.log('❌ No clear logos found on page');

      // Let's look for any images on the page
      const allImageRegex = /<img[^>]*src="([^"]*)"[^>]*>/gi;
      const allImages = [...pageContent.matchAll(allImageRegex)];
      console.log(`\n📷 Found ${allImages.length} total images on page:`);
      allImages.slice(0, 10).forEach((match, i) => {
        console.log(`   ${i + 1}. ${match[1]}`);
      });
    }

  } catch (error) {
    console.log(`❌ Error fetching page: ${error}`);
  }
}

testSingleLogo();