#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface FailedGame {
  launchboxId: number;
  name: string;
  error: string;
  updateData: any;
}

async function retryFailedGames() {
  try {
    const failedGamesFile = 'failed-games-enrichment.json';

    // Check if failed games file exists
    if (!fs.existsSync(failedGamesFile)) {
      console.log('✅ No failed games file found. All enrichment was successful!');
      return;
    }

    // Load failed games
    const failedGamesData = fs.readFileSync(failedGamesFile, 'utf8');
    const failedGames: FailedGame[] = JSON.parse(failedGamesData);

    console.log(`🔄 Retrying ${failedGames.length} failed games...\\n`);

    let retrySuccessful = 0;
    let retryFailed = 0;
    const stillFailing: FailedGame[] = [];

    for (const game of failedGames) {
      try {
        console.log(`🔄 Retrying: ${game.name} (ID: ${game.launchboxId})`);

        const { error: updateError } = await supabase
          .from('games_database')
          .update(game.updateData)
          .eq('launchbox_id', game.launchboxId);

        if (updateError) {
          console.log(`   ❌ Still failing: ${updateError.message}`);
          stillFailing.push({
            ...game,
            error: updateError.message // Update with new error
          });
          retryFailed++;
        } else {
          console.log(`   ✅ Success!`);
          retrySuccessful++;
        }

        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.log(`   ❌ Exception: ${error}`);
        stillFailing.push({
          ...game,
          error: String(error)
        });
        retryFailed++;
      }
    }

    console.log(`\\n📊 Retry Results:`);
    console.log(`✅ Successfully retried: ${retrySuccessful}`);
    console.log(`❌ Still failing: ${retryFailed}`);

    // Update or remove failed games file
    if (stillFailing.length > 0) {
      fs.writeFileSync(failedGamesFile, JSON.stringify(stillFailing, null, 2));
      console.log(`\\n⚠️  ${stillFailing.length} games are still failing`);
      console.log(`📄 Updated failed games file: ${failedGamesFile}`);
      console.log(`🔄 You can retry these again later`);

      // Show some example errors
      console.log(`\\n🔍 Sample errors:`);
      stillFailing.slice(0, 3).forEach((game, index) => {
        console.log(`${index + 1}. ${game.name}: ${game.error}`);
      });
    } else {
      // All games succeeded, remove the failed games file
      fs.unlinkSync(failedGamesFile);
      console.log(`\\n🎉 All previously failed games have been successfully enriched!`);
      console.log(`📄 Removed failed games file`);
    }

  } catch (error) {
    console.error('❌ Error retrying failed games:', error);
  }
}

retryFailedGames().catch(console.error);