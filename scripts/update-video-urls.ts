#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import * as readline from 'readline';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface GameVideo {
  databaseId: string;
  videoUrl: string;
}

async function updateVideoUrls() {
  try {
    console.log('🎬 Extracting video URLs from LaunchBox XML...\n');

    const videoMap = new Map<string, string>();
    let currentGame: { databaseId?: string } = {};

    console.log('📖 Processing XML line by line...');

    const fileStream = createReadStream('Metadata.xml');
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineCount = 0;
    for await (const line of rl) {
      lineCount++;

      if (lineCount % 100000 === 0) {
        console.log(`📈 Processed ${lineCount} lines...`);
      }

      // Extract DatabaseID
      const databaseIdMatch = line.match(/<DatabaseID>(\d+)<\/DatabaseID>/);
      if (databaseIdMatch) {
        currentGame.databaseId = databaseIdMatch[1];
      }

      // Extract VideoURL and associate with current game
      const videoUrlMatch = line.match(/<VideoURL>(.*?)<\/VideoURL>/);
      if (videoUrlMatch && currentGame.databaseId) {
        videoMap.set(currentGame.databaseId, videoUrlMatch[1]);
        currentGame = {}; // Reset after capturing video
      }
    }

    console.log(`\n✅ Extraction completed!`);
    console.log(`📊 Found ${videoMap.size} games with video URLs`);

    // Update database in batches
    const BATCH_SIZE = 100;
    const entries = Array.from(videoMap.entries());
    let updated = 0;

    console.log('\n📥 Updating database with video URLs...');

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      for (const [databaseId, videoUrl] of batch) {
        try {
          const { error } = await supabase
            .from('games_database')
            .update({ video_url: videoUrl })
            .eq('id', parseInt(databaseId));

          if (!error) {
            updated++;
          }
        } catch (e) {
          // Skip errors, continue with next
        }
      }

      const progress = ((updated / videoMap.size) * 100).toFixed(1);
      console.log(`📈 Update progress: ${updated}/${videoMap.size} games updated (${progress}%)`);
    }

    // Verify the update
    const { count, error: countError } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true })
      .not('video_url', 'is', null);

    console.log(`\n🎉 Video URL update completed!`);
    console.log(`📊 Games with videos in database: ${count || 0}`);
    console.log(`🎯 Successfully updated: ${updated} games`);

  } catch (error) {
    console.error('Update error:', error);
  }
}

updateVideoUrls().catch(console.error);