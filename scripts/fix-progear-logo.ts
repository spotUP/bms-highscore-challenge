import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixProgearLogo() {
  console.log('🔧 Fixing Progear logo URL...');

  // First, check if Progear exists and what its current data looks like
  const { data: progearData, error: fetchError } = await supabase
    .from('games_database')
    .select('*')
    .ilike('name', '%progear%')
    .limit(5);

  if (fetchError) {
    console.error('❌ Error fetching Progear:', fetchError);
    return;
  }

  console.log('🔍 Found games matching "progear":', progearData?.length || 0);
  progearData?.forEach((game, index) => {
    console.log(`  ${index + 1}. ${game.name} (ID: ${game.id})`);
    console.log(`     Logo URL: ${game.logo_url || 'null'}`);
    console.log(`     Cover URL: ${game.cover_url || 'null'}`);
    console.log(`     Screenshot URL: ${game.screenshot_url || 'null'}`);
  });

  // Set the LaunchBox clear logo URL for Progear (400x184 size for better performance)
  const progearLogoUrl = 'https://images.launchbox-app.com/183f6e29-41d1-482f-aea0-c87d2bc40715.png';

  if (progearData && progearData.length > 0) {
    const progear = progearData[0]; // Take the first match
    console.log(`\n🔄 Updating logo URL for "${progear.name}" (ID: ${progear.id})`);

    const { error: updateError } = await supabase
      .from('games_database')
      .update({ logo_url: progearLogoUrl })
      .eq('id', progear.id);

    if (updateError) {
      console.error('❌ Error updating Progear logo:', updateError);
    } else {
      console.log('✅ Successfully updated Progear logo URL!');
      console.log(`   New logo URL: ${progearLogoUrl}`);
    }
  } else {
    console.log('❌ No Progear game found in database');
  }
}

fixProgearLogo()
  .then(() => {
    console.log('✨ Progear logo fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });