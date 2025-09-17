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
  logo_url?: string;
  screenshot_url?: string;
  cover_url?: string;
}

async function addGameImages() {
  console.log('🖼️ Adding clear logos to games...');

  // Get games that don't have logos yet (limit to avoid overwhelming LaunchBox)
  const { data: games, error } = await supabase
    .from('games_database')
    .select('id, name, platform_name, logo_url, screenshot_url, cover_url')
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

      // Search for clear logo on LaunchBox
      const logoUrl = await launchBoxService.getClearLogo(game.name);

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

      // Add delay to be respectful to LaunchBox
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay

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