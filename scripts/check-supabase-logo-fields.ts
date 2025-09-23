#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkLogoFields() {
  console.log('🔍 Checking Supabase logo field structure...');

  try {
    // Check a few sample games to see the data structure
    const { data: sampleGames, error } = await supabase
      .from('games_database')
      .select('*')
      .limit(3);

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('\n📊 Sample game records:');
    sampleGames?.forEach((game, i) => {
      console.log(`\nGame ${i + 1}:`);
      console.log(`  ID: ${game.id}`);
      console.log(`  Name: ${game.name}`);
      console.log(`  Platform: ${game.platform_name}`);
      console.log(`  Has logo_base64: ${game.logo_base64 ? 'YES' : 'NO'}`);
      console.log(`  Other fields: ${Object.keys(game).join(', ')}`);
    });

    // Check count of games with logo data
    const logoFields = ['logo_base64', 'logo_url', 'logo', 'image', 'clearlogo'];

    for (const field of logoFields) {
      try {
        const { count } = await supabase
          .from('games_database')
          .select('*', { count: 'exact', head: true })
          .not(field, 'is', null);

        if (count !== null && count > 0) {
          console.log(`\n✅ Found ${count} games with '${field}' field`);
        }
      } catch (e) {
        // Field doesn't exist, skip
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkLogoFields().catch(console.error);