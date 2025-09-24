import { createClient } from '@supabase/supabase-js';

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL || 'https://bdwqagbahfrfdckucbph.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkd3FhZ2JhaGZyZmRja3VjYnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQzNjM5NjIsImV4cCI6MjAzOTkzOTk2Mn0.mq3T4IHDGQEtGGlP1HfBiK2Ay7aGJNpRs6oc1LY9HKE';
const supabase = createClient(supabaseUrl, supabaseKey);

class SupabaseLogoScraper {

  private async listTables() {
    console.log('🔍 Checking available tables...');

    try {
      // Try to check if we have LaunchBox game images table
      const { data: imageData, error: imageError } = await supabase
        .from('launchbox_game_images')
        .select('*')
        .limit(1);

      if (!imageError) {
        console.log('✅ Found launchbox_game_images table');

        // Check structure
        const { data: clearLogos, error } = await supabase
          .from('launchbox_game_images')
          .select('*')
          .eq('type', 'Clear Logo')
          .limit(5);

        if (!error && clearLogos.length > 0) {
          console.log(`🎯 Found ${clearLogos.length} Clear Logo samples:`);
          clearLogos.forEach((logo, i) => {
            console.log(`  ${i + 1}. Game ID ${logo.database_id}: ${logo.file_name} (${logo.region || 'Global'})`);
          });
          return true;
        }
      }
    } catch (err) {
      console.log('❌ No launchbox_game_images table found');
    }

    try {
      // Try alternative table name
      const { data: games, error } = await supabase
        .from('launchbox_games')
        .select('*')
        .limit(1);

      if (!error) {
        console.log('✅ Found launchbox_games table');
        return false; // Has games but not images
      }
    } catch (err) {
      console.log('❌ No launchbox_games table found either');
    }

    return false;
  }

  private async extractClearLogosFromSupabase() {
    console.log('🎯 Extracting Clear Logos from Supabase...');

    const { data: clearLogos, error } = await supabase
      .from('launchbox_game_images')
      .select('*')
      .eq('type', 'Clear Logo')
      .order('database_id');

    if (error) {
      throw new Error(`Failed to get Clear Logos: ${error.message}`);
    }

    console.log(`✅ Found ${clearLogos.length} Clear Logo entries in database`);

    let successCount = 0;
    let errorCount = 0;

    for (const logo of clearLogos) {
      try {
        const imageUrl = `https://images.launchbox-app.com/${logo.file_name}`;

        console.log(`📥 Downloading Game ID ${logo.database_id}: ${logo.file_name}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const sizeKB = Math.round(imageBuffer.byteLength / 1024);

        // Get game name from launchbox_games table
        const { data: gameData } = await supabase
          .from('launchbox_games')
          .select('name, platform')
          .eq('database_id', logo.database_id)
          .single();

        // Store in our clear_logos table
        const { error: insertError } = await supabase
          .from('clear_logos')
          .insert({
            launchbox_database_id: logo.database_id,
            game_name: gameData?.name || 'Unknown Game',
            platform_name: gameData?.platform || 'Unknown Platform',
            source_url: imageUrl,
            logo_data: base64Image,
            region: logo.region,
            created_at: new Date().toISOString()
          });

        if (insertError) {
          // Skip if already exists
          if (insertError.code === '23505') {
            console.log(`⚠️ Game ID ${logo.database_id} already exists, skipping`);
            continue;
          }
          throw new Error(insertError.message);
        }

        console.log(`✅ Game ID ${logo.database_id} - ${sizeKB}KB stored successfully`);
        successCount++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error processing Game ID ${logo.database_id}: ${error}`);
        errorCount++;
      }
    }

    console.log(`🎉 Clear Logo import completed!`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total: ${clearLogos.length}`);
  }

  async run() {
    try {
      const hasImageTable = await this.listTables();

      if (hasImageTable) {
        await this.extractClearLogosFromSupabase();
      } else {
        console.log('❌ Could not find LaunchBox image data in Supabase');
        console.log('💡 You may need to import the LaunchBox image metadata first');
      }

    } catch (error) {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    }
  }
}

// Run the scraper
const scraper = new SupabaseLogoScraper();
scraper.run();