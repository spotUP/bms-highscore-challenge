#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnoseMissingClearLogos() {
  try {
    console.log('🔍 Diagnosing missing clear logos for approved platform games...\n');

    // Get approved platforms
    const { data: platformsData, error: platformsError } = await supabase
      .from('platforms')
      .select('name')
      .order('name');

    if (platformsError) {
      console.error('Error querying platforms table:', platformsError);
      return;
    }

    const approvedPlatformNames = platformsData?.map(p => p.name) || [];

    // Get games from approved platforms with logo information
    const { data: gamesData, error: gamesError } = await supabase
      .from('games_database')
      .select('id, name, platform_name, logo_base64')
      .in('platform_name', approvedPlatformNames)
      .limit(50); // Sample first 50 games

    if (gamesError) {
      console.error('Error querying games:', gamesError);
      return;
    }

    if (!gamesData) {
      console.log('No games data found');
      return;
    }

    console.log(`📊 Analyzing ${gamesData.length} sample games from approved platforms:\n`);

    let hasLogoBase64 = 0;
    let noLogoBase64 = 0;
    const gamesWithoutLogos: any[] = [];

    gamesData.forEach(game => {
      if (game.logo_base64) {
        hasLogoBase64++;
      } else {
        noLogoBase64++;
        gamesWithoutLogos.push(game);
      }
    });

    console.log(`✅ Games with logo_base64: ${hasLogoBase64}`);
    console.log(`❌ Games without logo_base64: ${noLogoBase64}`);
    console.log(`📈 Coverage: ${((hasLogoBase64 / gamesData.length) * 100).toFixed(1)}%\n`);

    if (gamesWithoutLogos.length > 0) {
      console.log('🔍 Sample games without clear logos:');
      gamesWithoutLogos.slice(0, 10).forEach((game, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${game.name.padEnd(30)} (${game.platform_name})`);
      });
    }

    // Check what's in the clear logo service / R2 bucket
    console.log('\n🌐 Checking R2 domain configuration...');
    console.log(`R2 Domain: ${process.env.VITE_CLOUDFLARE_R2_DOMAIN}`);

    // Sample a few specific games to check if they have clear logos in R2
    const sampleGames = gamesWithoutLogos.slice(0, 3);
    console.log('\n🔍 Testing R2 clear logo access for sample games:');

    for (const game of sampleGames) {
      const safeFileName = game.name
        .replace(/[^a-zA-Z0-9\-_\s]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase();

      const r2Url = `https://${process.env.VITE_CLOUDFLARE_R2_DOMAIN}/clear-logos/${safeFileName}.webp`;
      console.log(`   ${game.name} -> ${r2Url}`);

      try {
        const response = await fetch(r2Url, { method: 'HEAD' });
        console.log(`   Status: ${response.status} ${response.status === 200 ? '✅' : '❌'}`);
      } catch (error) {
        console.log(`   Status: Error - ${error}`);
      }
    }

  } catch (error) {
    console.error('Script error:', error);
  }
}

diagnoseMissingClearLogos().catch(console.error);