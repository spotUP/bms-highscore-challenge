import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface GameToProcess {
  id: number;
  name: string;
  platform_name: string;
  database_id?: number;
  logo_url?: string;
}

// Multiple direct URL patterns to try for LaunchBox clear logos
const getDirectLogoUrls = (databaseId: number): string[] => [
  `https://images.launchbox-app.com/clearlogo/${databaseId}-01.png`,
  `https://images.launchbox-app.com/clearlogo/${databaseId}-02.png`,
  `https://images.launchbox-app.com/clearlogo/${databaseId}-03.png`,
  `https://images.launchbox-app.com/clearlogo/${databaseId}.png`,
  `https://images.launchbox-app.com/${databaseId}-clearlogo.png`,
  `https://images.launchbox-app.com/games/${databaseId}-clearlogo.png`,
];

async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function findWorkingLogoUrl(databaseId: number): Promise<string | null> {
  const urls = getDirectLogoUrls(databaseId);

  for (const url of urls) {
    if (await checkUrlExists(url)) {
      return url;
    }
    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return null;
}

async function addGameImagesOptimized() {
  console.log('🚀 Starting OPTIMIZED clear logo import...');
  console.log('📊 Using direct URL patterns for fast bulk processing\n');

  // Get games that don't have logos yet and have database_id
  const { data: games, error } = await supabase
    .from('games_database')
    .select('id, name, platform_name, database_id, logo_url')
    .is('logo_url', null)
    .not('database_id', 'is', null)
    .limit(1000); // Process more games at once since direct URLs are fast

  if (error) {
    console.error('Error fetching games:', error);
    return;
  }

  if (!games || games.length === 0) {
    console.log('✅ All games with database_id already have logos or no games found');
    return;
  }

  console.log(`📋 Found ${games.length} games without logos (all have database_id)`);
  console.log('⚡ Using direct URL checking for maximum speed\n');

  let processed = 0;
  let updated = 0;
  let errors = 0;
  let notFound = 0;

  // Process in parallel batches for much faster processing
  const batchSize = 20; // Process 20 games in parallel

  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);
    console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(games.length/batchSize)} (${batch.length} games)`);

    const batchPromises = batch.map(async (game) => {
      const result = {
        game,
        success: false,
        logoUrl: null as string | null,
        error: null as string | null
      };

      try {
        console.log(`   🔍 ${game.name}`);

        // Try direct URLs
        const logoUrl = await findWorkingLogoUrl(game.database_id!);

        if (logoUrl) {
          // Update the game with the clear logo
          const { error: updateError } = await supabase
            .from('games_database')
            .update({
              logo_url: logoUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', game.id);

          if (updateError) {
            result.error = `Failed to update database: ${updateError.message}`;
          } else {
            result.success = true;
            result.logoUrl = logoUrl;
            console.log(`   ✅ Found logo for ${game.name}`);
          }
        } else {
          console.log(`   ⚠️  No logo found for ${game.name}`);
        }

      } catch (error) {
        result.error = `Processing error: ${error}`;
        console.log(`   ❌ Error processing ${game.name}: ${error}`);
      }

      return result;
    });

    // Wait for all promises in this batch to complete
    const batchResults = await Promise.all(batchPromises);

    // Update counters
    batchResults.forEach(result => {
      processed++;
      if (result.success) {
        updated++;
      } else if (result.error) {
        errors++;
      } else {
        notFound++;
      }
    });

    // Progress update
    const progress = ((processed / games.length) * 100).toFixed(1);
    console.log(`   📊 Batch complete: ${updated} found, ${notFound} not found, ${errors} errors`);
    console.log(`   📈 Overall progress: ${progress}% (${processed}/${games.length})\n`);

    // Small delay between batches to be respectful to the CDN
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n🎉 Optimized logo processing completed!');
  console.log('📊 Final Results:');
  console.log(`   ✅ Logos found: ${updated}`);
  console.log(`   ⚠️  Not found: ${notFound}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📈 Total processed: ${processed}`);
  console.log(`   🎯 Success rate: ${((updated / processed) * 100).toFixed(1)}%`);
}

// Run the optimized import
addGameImagesOptimized().catch(console.error);