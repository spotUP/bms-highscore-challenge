#!/usr/bin/env tsx

import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

interface LaunchBoxGame {
  DatabaseID: string;
  Name: string;
  Platform: string;
  VideoURL?: string;
}

async function testVideoExtraction() {
  try {
    console.log('🔍 Testing video URL extraction from LaunchBox XML...\n');

    // Read and parse LaunchBox XML
    console.log('📖 Reading LaunchBox XML file...');
    const xmlData = fs.readFileSync('Metadata.xml', 'utf8');

    console.log('🔍 Parsing XML data...');
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: false,
      parseTrueNumberOnly: false,
    });

    const parsedData = parser.parse(xmlData);
    const games: LaunchBoxGame[] = parsedData.LaunchBox?.Game || [];

    console.log(`📊 Found ${games.length} total games in LaunchBox XML`);

    // Count games with video URLs
    const gamesWithVideos = games.filter(game => game.VideoURL);
    console.log(`🎬 Games with video URLs: ${gamesWithVideos.length}/${games.length} (${((gamesWithVideos.length/games.length)*100).toFixed(1)}%)`);

    // Show sample games with videos
    console.log('\n📽️ Sample games with video URLs:');
    gamesWithVideos.slice(0, 10).forEach(game => {
      console.log(`- ${game.Name} (${game.Platform})`);
      console.log(`  Video: ${game.VideoURL}`);
    });

    if (gamesWithVideos.length > 10) {
      console.log(`  ... and ${gamesWithVideos.length - 10} more games with videos`);
    }

    console.log(`\n✅ Video extraction test completed!`);
    console.log(`🎯 Ready to import ${gamesWithVideos.length} video URLs to database`);

  } catch (error) {
    console.error('Test error:', error);
  }
}

testVideoExtraction().catch(console.error);