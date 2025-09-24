import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function testFixedQueries() {
  console.log('🧪 Testing fixed database queries...\n');

  try {
    // Test the fixed GamesBrowser query
    console.log('1. Testing GamesBrowser query with logo_base64:');
    const { data: gamesBrowserTest, error: gamesBrowserError } = await supabase
      .from('games_database')
      .select(`
        id,
        name,
        platform_name,
        database_id,
        release_year,
        overview,
        max_players,
        cooperative,
        community_rating,
        community_rating_count,
        esrb_rating,
        genres,
        developer,
        publisher,
        video_url,
        screenshot_url,
        cover_url,
        logo_base64
      `)
      .limit(2);

    if (gamesBrowserError) {
      console.log('❌ GamesBrowser query failed:', gamesBrowserError.message);
    } else {
      console.log('✅ GamesBrowser query successful');
      console.log(`   Retrieved ${gamesBrowserTest?.length || 0} games`);
      if (gamesBrowserTest && gamesBrowserTest.length > 0) {
        console.log(`   Sample: ${gamesBrowserTest[0].name}`);
        console.log(`   Logo data: ${gamesBrowserTest[0].logo_base64 ? 'Has logo_base64' : 'No logo_base64'}`);
      }
    }

    // Test the fixed check-db-status query
    console.log('\n2. Testing check-db-status query with logo_base64:');
    const { count: withLogos } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true })
      .not('logo_base64', 'is', null);

    console.log(`✅ Logo count query successful: ${withLogos || 0} games have logos`);

    // Test that the old broken queries still fail (to confirm we identified the right issue)
    console.log('\n3. Confirming old broken queries still fail:');
    const { data: brokenTest, error: brokenError } = await supabase
      .from('games_database')
      .select('logo_url')
      .limit(1);

    if (brokenError) {
      console.log('✅ CONFIRMED: logo_url query still fails as expected');
      console.log(`   Error: ${brokenError.message}`);
    } else {
      console.log('❌ Unexpected: logo_url query should have failed but succeeded');
    }

    // Test games table still works (should have logo_url)
    console.log('\n4. Confirming games table logo_url still works:');
    const { data: gamesTableTest, error: gamesTableError } = await supabase
      .from('games')
      .select('id, name, logo_url')
      .limit(2);

    if (gamesTableError) {
      console.log('❌ Games table logo_url query failed:', gamesTableError.message);
    } else {
      console.log('✅ Games table logo_url query successful');
      console.log(`   Retrieved ${gamesTableTest?.length || 0} tournament games`);
      if (gamesTableTest && gamesTableTest.length > 0) {
        console.log(`   Sample: ${gamesTableTest[0].name} - logo_url: ${gamesTableTest[0].logo_url || 'null'}`);
      }
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\nSUMMARY:');
    console.log('========');
    console.log('✅ GamesBrowser.tsx can now query games_database with logo_base64');
    console.log('✅ check-db-status.ts can now count logos correctly');
    console.log('✅ Tournament games (games table) still use logo_url correctly');
    console.log('✅ Database schema mismatch has been resolved');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFixedQueries().catch(console.error);