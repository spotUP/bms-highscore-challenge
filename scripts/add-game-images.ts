import { createClient } from '@supabase/supabase-js';
import { launchBoxService } from '../src/services/launchboxService';

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
  screenshot_url?: string;
  cover_url?: string;
}

async function addGameImages() {
  console.log('🖼️ Adding clear logos to games...');

  // Get games that don't have logos yet (limit to avoid overwhelming LaunchBox)
  const { data: games, error } = await supabase
    .from('games_database')
    .select('id, name, platform_name, database_id, logo_url, screenshot_url, cover_url')
    .is('logo_url', null)
    .limit(100); // Start with 100 games

  if (error) {
    console.error('Error fetching games:', error);
    return;
  }

  if (!games || games.length === 0) {
    console.log('✅ All games already have logos or no games found');
    return;
  }

  console.log(`📊 Found ${games.length} games without logos`);

  let processed = 0;
  let updated = 0;
  let errors = 0;

  for (const game of games) {
    try {
      console.log(`🔍 Processing: ${game.name} (${game.platform_name})`);

      let logoUrl: string | null = null;

      // Method 1: Try direct LaunchBox URL using database_id (faster and more reliable)
      if (game.database_id) {
        const directUrl = `https://images.launchbox-app.com/clearlogo/${game.database_id}-01.png`;
        try {
          const response = await fetch(directUrl, { method: 'HEAD' });
          if (response.ok) {
            logoUrl = directUrl;
            console.log(`   ✅ Found direct clear logo for ${game.name}`);
          }
        } catch (e) {
          // Continue to next method
        }
      }

      // Method 2: If direct URL doesn't work, try LaunchBox API search
      if (!logoUrl) {
        logoUrl = await launchBoxService.getClearLogo(game.name);
        if (logoUrl) {
          console.log(`   ✅ Found API clear logo for ${game.name}`);
        }
      }

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
          console.error(`   ❌ Failed to update ${game.name}:`, updateError);
          errors++;
        } else {
          console.log(`   ✅ Added logo for ${game.name}`);
          updated++;
        }
      } else {
        console.log(`   ⚠️ No logo found for ${game.name}`);
      }

      processed++;

      // Add delay to be respectful to LaunchBox (shorter delay for direct URL checks)
      await new Promise(resolve => setTimeout(resolve, logoUrl && logoUrl.includes('clearlogo') ? 500 : 1000));

    } catch (error) {
      console.error(`❌ Error processing ${game.name}:`, error);
      errors++;
      processed++;
    }
  }

  console.log('\n🎉 Image processing completed!');
  console.log(`📊 Processed: ${processed} games`);
  console.log(`✅ Updated: ${updated} games`);
  console.log(`❌ Errors: ${errors}`);
}

// Command line options
const args = process.argv.slice(2);
const mode = args[0] || 'logo';

switch (mode) {
  case 'logo':
  case 'logos':
    addGameImages();
    break;
  case 'help':
    console.log('Usage: npx tsx scripts/add-game-images.ts [mode]');
    console.log('Modes:');
    console.log('  logo, logos  - Add clear logos to games (default)');
    console.log('  help         - Show this help');
    break;
  default:
    console.log('Unknown mode. Use "help" for usage information.');
}