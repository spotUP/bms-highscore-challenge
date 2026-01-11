#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import xml2js from 'xml2js';
import fs from 'fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyIdMapping() {
  console.log('🔍 Verifying LaunchBox XML ID mapping with database...\n');

  // Check if XML file exists
  const xmlPath = '/tmp/Metadata.xml';
  if (!fs.existsSync(xmlPath)) {
    console.log('📥 LaunchBox XML not found, downloading...');

    // Download the XML file first
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      await execAsync('curl -o /tmp/LaunchBox_Metadata.zip https://gamesdb.launchbox-app.com/Metadata.zip');
      await execAsync('cd /tmp && unzip -o LaunchBox_Metadata.zip');
      console.log('✅ Downloaded LaunchBox metadata');
    } catch (error) {
      console.error('❌ Failed to download LaunchBox metadata:', error);
      return;
    }
  }

  try {
    // Parse XML
    console.log('📖 Reading LaunchBox XML...');
    const xmlData = fs.readFileSync(xmlPath, 'utf-8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlData);

    const launchBoxGames = result.LaunchBox.Game || [];
    console.log(`✅ Found ${launchBoxGames.length} games in LaunchBox XML\n`);

    // Test specific known games to verify offset
    const testCases = [
      { name: 'Super Mario Bros.', platform: 'Nintendo Entertainment System' },
      { name: 'Super Mario Bros. 3', platform: 'Nintendo Entertainment System' },
      { name: 'Super Mario World', platform: 'Super Nintendo Entertainment System' },
      { name: 'The Legend of Zelda', platform: 'Nintendo Entertainment System' },
      { name: 'Pac-Man', platform: 'Arcade' }
    ];

    console.log('🎯 Testing known games to verify ID mapping:\n');

    for (const testCase of testCases) {
      // Find in our database
      const { data: dbGame, error: dbError } = await supabase
        .from('games_database')
        .select('id, name, platform_name')
        .ilike('name', testCase.name)
        .ilike('platform_name', `%${testCase.platform}%`)
        .limit(1)
        .single();

      if (dbError || !dbGame) {
        console.log(`⚠️ ${testCase.name} not found in database`);
        continue;
      }

      // Find in XML (handle both string and array formats)
      const xmlGame = launchBoxGames.find(game => {
        const gameName = Array.isArray(game.Name) ? game.Name[0] : game.Name;
        const gamePlatform = Array.isArray(game.Platform) ? game.Platform[0] : game.Platform;

        return gameName && gamePlatform &&
               gameName.toLowerCase().includes(testCase.name.toLowerCase()) &&
               gamePlatform.includes(testCase.platform);
      });

      if (!xmlGame) {
        console.log(`⚠️ ${testCase.name} not found in XML`);
        continue;
      }

      const dbId = dbGame.id;
      const xmlIdRaw = Array.isArray(xmlGame.DatabaseID) ? xmlGame.DatabaseID[0] : xmlGame.DatabaseID;
      const xmlId = parseInt(xmlIdRaw);
      const offset = xmlId - dbId;

      const videoUrl = Array.isArray(xmlGame.VideoURL) ? xmlGame.VideoURL[0] : xmlGame.VideoURL;

      console.log(`📍 ${testCase.name}:`);
      console.log(`   Database ID: ${dbId}`);
      console.log(`   XML ID: ${xmlId}`);
      console.log(`   Offset: ${offset}`);
      console.log(`   Video URL: ${videoUrl || 'NOT FOUND'}`);
      console.log('');
    }

    // Check if we can find any games with video URLs
    console.log('🎬 Looking for games with video URLs in XML...\n');
    let videoCount = 0;
    const gamesWithVideos = [];

    for (let i = 0; i < Math.min(100, launchBoxGames.length); i++) {
      const game = launchBoxGames[i];
      const videoUrl = Array.isArray(game.VideoURL) ? game.VideoURL[0] : game.VideoURL;

      if (videoUrl && videoUrl.trim()) {
        videoCount++;
        const gameName = Array.isArray(game.Name) ? game.Name[0] : game.Name;
        const xmlIdRaw = Array.isArray(game.DatabaseID) ? game.DatabaseID[0] : game.DatabaseID;
        const platform = Array.isArray(game.Platform) ? game.Platform[0] : game.Platform;

        gamesWithVideos.push({
          name: gameName,
          xmlId: parseInt(xmlIdRaw),
          videoUrl: videoUrl,
          platform: platform
        });

        if (gamesWithVideos.length <= 5) {
          console.log(`🎬 ${gameName} (XML ID: ${xmlIdRaw})`);
          console.log(`   Video: ${videoUrl}`);
          console.log(`   Platform: ${platform}`);
          console.log('');
        }
      }
    }

    console.log(`📊 Found ${videoCount} games with videos in first 100 XML entries`);
    console.log(`📈 Estimated total games with videos: ${Math.round((videoCount / 100) * launchBoxGames.length)}`);

    // Test the offset theory with one game
    if (gamesWithVideos.length > 0) {
      const testGame = gamesWithVideos[0];
      const potentialDbId = testGame.xmlId - 50000; // Test common offset

      console.log(`\n🧪 Testing offset theory with ${testGame.name}:`);
      console.log(`   XML ID: ${testGame.xmlId}`);
      console.log(`   Predicted DB ID (XML - 50000): ${potentialDbId}`);

      const { data: testDbGame, error: testError } = await supabase
        .from('games_database')
        .select('id, name, platform_name')
        .eq('id', potentialDbId)
        .single();

      if (testDbGame) {
        console.log(`✅ Found matching game: ${testDbGame.name} (${testDbGame.platform_name})`);
        const nameMatch = testDbGame.name.toLowerCase().includes(testGame.name.toLowerCase()) ||
                          testGame.name.toLowerCase().includes(testDbGame.name.toLowerCase());
        console.log(`   Name similarity: ${nameMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
      } else {
        console.log(`❌ No game found with ID ${potentialDbId}`);
      }
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyIdMapping().then(() => process.exit(0));