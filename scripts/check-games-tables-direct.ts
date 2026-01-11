import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGamesTablesDirect() {
  console.log('🔍 Checking games tables directly...\n');

  try {
    // Test direct access to tables and see what columns exist
    console.log('1. Testing games table access:');
    const { data: gamesTest, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .limit(1);

    if (gamesError) {
      console.log('❌ Error accessing games table:', gamesError);
    } else {
      console.log('✅ Games table exists');
      if (gamesTest && gamesTest.length > 0) {
        console.log('   Columns found:');
        Object.keys(gamesTest[0]).forEach(key => {
          console.log(`   - ${key}: ${typeof gamesTest[0][key]}`);
        });
      }
    }

    console.log('\n2. Testing games_database table access:');
    const { data: gamesDatabaseTest, error: gamesDatabaseError } = await supabase
      .from('games_database')
      .select('*')
      .limit(1);

    if (gamesDatabaseError) {
      console.log('❌ Error accessing games_database table:', gamesDatabaseError);
    } else {
      console.log('✅ Games_database table exists');
      if (gamesDatabaseTest && gamesDatabaseTest.length > 0) {
        console.log('   Columns found:');
        Object.keys(gamesDatabaseTest[0]).forEach(key => {
          console.log(`   - ${key}: ${typeof gamesDatabaseTest[0][key]}`);
        });
      }
    }

    // Now check for specific logo-related queries that might be failing
    console.log('\n3. Testing specific logo field queries:');

    // Test logo_url query on games_database
    console.log('Testing logo_url on games_database:');
    const { data: logoUrlTest, error: logoUrlError } = await supabase
      .from('games_database')
      .select('logo_url')
      .limit(1);

    if (logoUrlError) {
      console.log('❌ logo_url query failed:', logoUrlError);
    } else {
      console.log('✅ logo_url query succeeded');
    }

    // Test logo_base64 query on games_database
    console.log('Testing logo_base64 on games_database:');
    const { data: logoBase64Test, error: logoBase64Error } = await supabase
      .from('games_database')
      .select('logo_base64')
      .limit(1);

    if (logoBase64Error) {
      console.log('❌ logo_base64 query failed:', logoBase64Error);
    } else {
      console.log('✅ logo_base64 query succeeded');
    }

    // Test logo_data query on games_database
    console.log('Testing logo_data on games_database:');
    const { data: logoDataTest, error: logoDataError } = await supabase
      .from('games_database')
      .select('logo_data')
      .limit(1);

    if (logoDataError) {
      console.log('❌ logo_data query failed:', logoDataError);
    } else {
      console.log('✅ logo_data query succeeded');
    }

    // Check what logo-related fields actually exist
    console.log('\n4. Logo field analysis:');

    if (gamesTest && gamesTest.length > 0) {
      const gamesLogoFields = Object.keys(gamesTest[0]).filter(key =>
        key.toLowerCase().includes('logo')
      );
      console.log('Games table logo fields:');
      if (gamesLogoFields.length > 0) {
        gamesLogoFields.forEach(field => {
          const value = gamesTest[0][field];
          const preview = typeof value === 'string' && value.length > 50
            ? value.substring(0, 50) + '...'
            : value;
          console.log(`   ✅ ${field}: ${preview}`);
        });
      } else {
        console.log('   ❌ No logo fields found in games table');
      }
    }

    if (gamesDatabaseTest && gamesDatabaseTest.length > 0) {
      const gamesDatabaseLogoFields = Object.keys(gamesDatabaseTest[0]).filter(key =>
        key.toLowerCase().includes('logo')
      );
      console.log('Games_database table logo fields:');
      if (gamesDatabaseLogoFields.length > 0) {
        gamesDatabaseLogoFields.forEach(field => {
          const value = gamesDatabaseTest[0][field];
          const preview = typeof value === 'string' && value.length > 50
            ? value.substring(0, 50) + '...'
            : value;
          console.log(`   ✅ ${field}: ${preview}`);
        });
      } else {
        console.log('   ❌ No logo fields found in games_database table');
      }
    }

    // Test a few more rows to see if data structure is consistent
    console.log('\n5. More samples to verify structure:');

    const { data: moreGamesDatabase, error: moreGamesDatabaseError } = await supabase
      .from('games_database')
      .select('*')
      .limit(5);

    if (moreGamesDatabaseError) {
      console.log('❌ Error fetching more games_database samples:', moreGamesDatabaseError);
    } else if (moreGamesDatabase && moreGamesDatabase.length > 0) {
      console.log(`✅ Found ${moreGamesDatabase.length} rows in games_database`);

      // Check if all rows have the same column structure
      const firstRowKeys = Object.keys(moreGamesDatabase[0]);
      let structureConsistent = true;

      moreGamesDatabase.forEach((row, index) => {
        const rowKeys = Object.keys(row);
        if (JSON.stringify(rowKeys.sort()) !== JSON.stringify(firstRowKeys.sort())) {
          console.log(`❌ Row ${index + 1} has different column structure`);
          structureConsistent = false;
        }
      });

      if (structureConsistent) {
        console.log('✅ All rows have consistent column structure');
      }
    }

  } catch (error) {
    console.error('❌ Direct table check failed:', error);
  }
}

checkGamesTablesDirect().catch(console.error);