#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tnsgrwntmnzpaifmutqh.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.log('Need service role key to update database');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateEarthionLogos() {
  console.log('Updating Earthion game logos...');

  // Get all Earthion games
  const { data: earthionGames, error } = await supabase
    .from('games_database')
    .select('id, name, database_id, logo_url')
    .ilike('name', '%earthion%');

  if (error) {
    console.error('Error fetching Earthion games:', error);
    return;
  }

  console.log(`Found ${earthionGames?.length || 0} Earthion games`);

  if (!earthionGames || earthionGames.length === 0) {
    return;
  }

  for (const game of earthionGames) {
    console.log(`\nProcessing: ${game.name} (ID: ${game.database_id})`);

    if (game.logo_url) {
      console.log('  Already has logo:', game.logo_url);
      continue;
    }

    if (!game.database_id) {
      console.log('  No database_id, skipping');
      continue;
    }

    // Try to find LaunchBox clear logo
    const logoUrl = `https://images.launchbox-app.com/clearlogo/${game.database_id}-01.png`;

    try {
      const response = await fetch(logoUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log('  ✅ Found logo, updating database');

        const { error: updateError } = await supabase
          .from('games_database')
          .update({ logo_url: logoUrl })
          .eq('id', game.id);

        if (updateError) {
          console.error('  ❌ Error updating:', updateError);
        } else {
          console.log('  ✅ Updated successfully');
        }
      } else {
        console.log('  ⚠️ No logo found at LaunchBox');

        // Try other image types as fallbacks
        const fallbackTypes = ['box-3d', 'boxfront', 'screenshot', 'banner'];
        let foundFallback = false;

        for (const type of fallbackTypes) {
          const fallbackUrl = `https://images.launchbox-app.com/${type}/${game.database_id}-01.png`;
          const fallbackResponse = await fetch(fallbackUrl, { method: 'HEAD' });

          if (fallbackResponse.ok) {
            console.log(`  ✅ Found ${type}, using as logo`);

            const { error: updateError } = await supabase
              .from('games_database')
              .update({ logo_url: fallbackUrl })
              .eq('id', game.id);

            if (updateError) {
              console.error('  ❌ Error updating:', updateError);
            } else {
              console.log('  ✅ Updated successfully');
              foundFallback = true;
              break;
            }
          }
        }

        if (!foundFallback) {
          console.log('  ❌ No images found at all');
        }
      }
    } catch (error) {
      console.error('  ❌ Error checking logo:', error);
    }
  }

  console.log('\n✅ Earthion logo update complete');
}

updateEarthionLogos();