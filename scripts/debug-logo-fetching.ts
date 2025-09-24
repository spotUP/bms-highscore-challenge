#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Copy the fetchClearLogoByGameId function from the hybrid scraper
async function fetchClearLogoByGameId(gameId: number, gameName: string): Promise<string | null> {
  try {
    console.log(`🔍 Fetching logo for ${gameName} with ID ${gameId}...`);

    await new Promise(resolve => setTimeout(resolve, 150)); // Rate limiting

    const gamePageUrl = `https://gamesdb.launchbox-app.com/games/details/${gameId}`;
    console.log(`📄 Game page URL: ${gamePageUrl}`);

    const gamePageResponse = await fetch(gamePageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(8000)
    });

    console.log(`📡 Response status: ${gamePageResponse.status}`);

    if (!gamePageResponse.ok) {
      console.log(`❌ Game page request failed: ${gamePageResponse.status}`);
      return null;
    }

    const gamePageHtml = await gamePageResponse.text();
    console.log(`📝 HTML length: ${gamePageHtml.length} characters`);

    // Check if we got a valid game page
    if (gamePageHtml.includes('Game not found') || gamePageHtml.includes('404')) {
      console.log(`❌ Game not found on LaunchBox`);
      return null;
    }

    // Look for any mention of "Clear Logo" in the HTML
    const clearLogoMentions = gamePageHtml.match(/Clear Logo/gi);
    console.log(`🔍 "Clear Logo" mentions found: ${clearLogoMentions ? clearLogoMentions.length : 0}`);

    // Extract the "Clear Logo" section and find images within it
    const clearLogoSectionMatch = gamePageHtml.match(/Clear Logo<\/h3>([\s\S]*?)(?=<h3|$)/i);

    if (!clearLogoSectionMatch) {
      console.log(`❌ No "Clear Logo" section found`);

      // Let's check what sections are available
      const sectionMatches = gamePageHtml.match(/<h3[^>]*>([^<]+)<\/h3>/gi);
      if (sectionMatches) {
        console.log(`📋 Available sections:`, sectionMatches.slice(0, 10));
      }

      return null;
    }

    console.log(`✅ Found "Clear Logo" section`);
    const clearLogoSection = clearLogoSectionMatch[1];
    console.log(`📝 Clear Logo section length: ${clearLogoSection.length} characters`);

    const imageMatches = [...clearLogoSection.matchAll(/<img[^>]*src="([^"]*\.(?:png|jpg|jpeg))"/gi)];
    console.log(`🖼️  Image matches found: ${imageMatches.length}`);

    if (imageMatches.length === 0) {
      console.log(`❌ No images found in Clear Logo section`);

      // Let's look for any img tags in the section
      const allImgMatches = clearLogoSection.match(/<img[^>]*>/gi);
      if (allImgMatches) {
        console.log(`🔍 All img tags in section:`, allImgMatches.slice(0, 3));
      }

      return null;
    }

    // Take the first image (typically the best quality)
    let logoUrl = imageMatches[0][1];
    console.log(`🎯 Found logo URL: ${logoUrl}`);

    // Ensure it's a full URL
    if (logoUrl && !logoUrl.startsWith('http')) {
      logoUrl = logoUrl.startsWith('//') ? `https:${logoUrl}` : `https://gamesdb.launchbox-app.com${logoUrl}`;
      console.log(`🔗 Converted to full URL: ${logoUrl}`);
    }

    // Download and convert the logo to base64
    console.log(`⬇️  Downloading logo...`);
    const logoResponse = await fetch(logoUrl, {
      signal: AbortSignal.timeout(6000)
    });

    console.log(`📡 Logo download status: ${logoResponse.status}`);

    if (!logoResponse.ok) {
      console.log(`❌ Logo download failed: ${logoResponse.status}`);
      return null;
    }

    const logoBuffer = await logoResponse.arrayBuffer();
    const mimeType = logoResponse.headers.get('content-type') || 'image/png';
    const logoBase64 = Buffer.from(logoBuffer).toString('base64');

    console.log(`✅ Logo converted to base64, size: ${logoBase64.length} characters`);
    console.log(`📋 MIME type: ${mimeType}`);

    return `data:${mimeType};base64,${logoBase64}`;

  } catch (error) {
    console.log(`❌ Error fetching logo for ${gameName}: ${error}`);
    return null;
  }
}

async function debugLogoFetching() {
  console.log('🔧 Debug Logo Fetching');
  console.log('Testing logo fetching with known games...\n');

  // Test with some known games that should have logos
  const testGames = [
    { id: 140, name: 'Super Mario Bros.', launchboxId: 140 },  // Original LaunchBox ID
    { id: 50140, name: 'Super Mario Bros.', launchboxId: 50140 },  // With offset
    { id: 1, name: 'Pac-Man', launchboxId: 1 },
    { id: 50001, name: 'Pac-Man', launchboxId: 50001 }
  ];

  for (const game of testGames) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${game.name} with LaunchBox ID: ${game.launchboxId}`);
    console.log(`${'='.repeat(60)}`);

    const result = await fetchClearLogoByGameId(game.launchboxId, game.name);

    if (result) {
      console.log(`🎉 SUCCESS! Logo found for ${game.name}`);
      console.log(`📏 Base64 data length: ${result.length}`);
    } else {
      console.log(`💔 FAILED! No logo found for ${game.name}`);
    }

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Now test with some games from our actual database
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing with real games from database...`);
  console.log(`${'='.repeat(60)}`);

  const { data: dbGames, error } = await supabase
    .from('games_database')
    .select('id, name, platform_name, launchbox_id, database_id')
    .limit(5);

  if (error) {
    console.error('❌ Error fetching games from database:', error);
    return;
  }

  if (!dbGames || dbGames.length === 0) {
    console.log('❌ No games found in database');
    return;
  }

  for (const game of dbGames) {
    console.log(`\n${'-'.repeat(40)}`);
    console.log(`Game: ${game.name} (${game.platform_name})`);
    console.log(`DB ID: ${game.id}, LaunchBox ID: ${game.launchbox_id}, Database ID: ${game.database_id}`);

    // Try with launchbox_id first, then database_id, then id
    const idsToTry = [game.launchbox_id, game.database_id, game.id].filter(id => id != null);

    for (const searchId of idsToTry) {
      console.log(`\n🔍 Trying with ID: ${searchId}`);
      const result = await fetchClearLogoByGameId(searchId, game.name);

      if (result) {
        console.log(`🎉 SUCCESS! Logo found with ID ${searchId}`);
        break;
      } else {
        console.log(`💔 No logo found with ID ${searchId}`);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n🏁 Debug complete!');
}

debugLogoFetching().then(() => process.exit(0));