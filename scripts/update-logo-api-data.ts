#!/usr/bin/env tsx

import { writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SQLITE_API_URL = 'http://localhost:3001';
const OUTPUT_FILE = 'public/api/recent-logos.json';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function fetchWithLogos() {
  try {
    // Get recent logos with the logo data
    const recentResponse = await fetch(`${SQLITE_API_URL}/recent?limit=12`);
    const recentLogos = await recentResponse.json();

    // Get stats
    const statsResponse = await fetch(`${SQLITE_API_URL}/stats`);
    const statsData = await statsResponse.json();

    // Get recent logos from the production turbo scraper database instead
    // These are the freshly scraped logos that are being actively collected
    const productionLogosResponse = await fetch(`${SQLITE_API_URL}/recent?limit=8`);
    const productionLogos = await productionLogosResponse.json();

    // Fetch actual logo data for each recent logo from production scraper
    const logosWithData = await Promise.all(
      productionLogos.slice(0, 8).map(async (logo: any) => {
        try {
          const logoResponse = await fetch(`${SQLITE_API_URL}/logo/${logo.id}`);
          if (logoResponse.ok) {
            const logoData = await logoResponse.json();
            return {
              id: logo.id,
              name: logo.name,
              platform_name: logo.platform_name,
              logo_base64: logoData.logo,
              processed_at: logo.processed_at
            };
          }
        } catch (error) {
          console.log(`Failed to fetch logo for ${logo.id}`);
        }

        // Return without logo_base64 if fetch failed
        return {
          id: logo.id,
          name: logo.name,
          platform_name: logo.platform_name,
          logo_base64: null,
          processed_at: logo.processed_at
        };
      })
    );

    // Get total games from Supabase games_database table (the real total)
    const { count: supabaseTotalGames } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true });

    // Create the structure expected by LogoScraper
    // Use the actual Supabase database count for accurate completion percentage
    const ACTUAL_TOTAL_GAMES = supabaseTotalGames || 169556;
    const output = {
      recentLogos: logosWithData,
      stats: {
        totalGames: ACTUAL_TOTAL_GAMES,
        gamesWithLogos: statsData.with_logos,
        gamesWithoutLogos: ACTUAL_TOTAL_GAMES - statsData.with_logos,
        completionPercentage: Math.round((statsData.with_logos / ACTUAL_TOTAL_GAMES) * 100)
      }
    };

    writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`✅ Updated ${OUTPUT_FILE} with ${logosWithData.length} logos and stats`);

  } catch (error) {
    console.error('❌ Failed to update logo API data:', error);
  }
}

async function runUpdate() {
  console.log('🔄 Updating logo API data...');
  await fetchWithLogos();

  // Update every 5 seconds for real-time updates
  setInterval(fetchWithLogos, 5000);
}

runUpdate().catch(console.error);