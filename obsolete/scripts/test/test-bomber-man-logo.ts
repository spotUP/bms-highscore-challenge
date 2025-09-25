import { createClient } from '@supabase/supabase-js';

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL || 'https://bdwqagbahfrfdckucbph.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkd3FhZ2JhaGZyZmRja3VjYnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQzNjM5NjIsImV4cCI6MjAzOTkzOTk2Mn0.mq3T4IHDGQEtGGlP1HfBiK2Ay7aGJNpRs6oc1LY9HKE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testBomberManLogo() {
  console.log('🎯 Testing Bomber Man Clear Logo extraction...');

  // From our metadata analysis, we know Bomber Man (Arcade) has DatabaseID 34197
  // and has these Clear Logo images:
  const clearLogos = [
    { filename: '71b43f95-c9c1-48b1-bcd6-7f71af32f78e.png', region: 'Europe' },
    { filename: 'a2e94e72-f7aa-4783-ae47-575b73765d63.png', region: 'Japan' },
    { filename: '05927e41-42b2-44aa-b4bd-560908390ece.png', region: 'Japan' },
    { filename: 'b895f997-f8e7-417f-88a0-395b62595ccb.png', region: null }
  ];

  // Use the first one (Europe region)
  const logoToTest = clearLogos[0];
  const imageUrl = `https://images.launchbox-app.com/${logoToTest.filename}`;

  console.log(`📥 Downloading Clear Logo: ${logoToTest.filename}`);

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const sizeKB = Math.round(imageBuffer.byteLength / 1024);

    console.log(`✅ Successfully downloaded ${sizeKB}KB Clear Logo`);

    // Store in database
    const { error: insertError } = await supabase
      .from('clear_logos')
      .insert({
        launchbox_database_id: 34197,
        game_name: 'Bomber Man',
        platform_name: 'Arcade',
        source_url: imageUrl,
        logo_data: base64Image,
        region: logoToTest.region,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      if (insertError.code === '23505') {
        console.log('⚠️ Bomber Man logo already exists in database');
      } else {
        throw new Error(`Database insert error: ${insertError.message}`);
      }
    } else {
      console.log('🎉 Successfully stored Bomber Man Clear Logo in database!');
    }

    // Verify it was stored
    const { data: storedLogo, error: selectError } = await supabase
      .from('clear_logos')
      .select('game_name, platform_name, region')
      .eq('launchbox_database_id', 34197)
      .single();

    if (!selectError && storedLogo) {
      console.log(`✅ Verification: ${storedLogo.game_name} (${storedLogo.platform_name}) [${storedLogo.region || 'Global'}] is now in database`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testBomberManLogo();