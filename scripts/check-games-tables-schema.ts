import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGamesTablesSchema() {
  console.log('🔍 Checking games tables schema...\n');

  try {
    // Check if games table exists and its structure
    console.log('1. Games table structure (for tournaments):');
    const { data: gamesColumns, error: gamesError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'games')
      .order('ordinal_position');

    if (gamesError) {
      console.log('❌ Error fetching games table columns:', gamesError);
    } else if (!gamesColumns || gamesColumns.length === 0) {
      console.log('❌ Games table not found');
    } else {
      console.log('✅ Games table columns:');
      gamesColumns.forEach(col =>
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
      );
    }

    // Check if games_database table exists and its structure
    console.log('\n2. Games_database table structure (for full games database):');
    const { data: gamesDatabaseColumns, error: gamesDatabaseError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'games_database')
      .order('ordinal_position');

    if (gamesDatabaseError) {
      console.log('❌ Error fetching games_database table columns:', gamesDatabaseError);
    } else if (!gamesDatabaseColumns || gamesDatabaseColumns.length === 0) {
      console.log('❌ Games_database table not found');
    } else {
      console.log('✅ Games_database table columns:');
      gamesDatabaseColumns.forEach(col =>
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
      );
    }

    // Check for logo-related fields specifically
    console.log('\n3. Logo field analysis:');

    if (gamesColumns && gamesColumns.length > 0) {
      const gamesLogoFields = gamesColumns.filter(col =>
        col.column_name.toLowerCase().includes('logo')
      );
      console.log('Games table logo fields:');
      if (gamesLogoFields.length > 0) {
        gamesLogoFields.forEach(field =>
          console.log(`   ✅ ${field.column_name}: ${field.data_type}`)
        );
      } else {
        console.log('   ❌ No logo fields found in games table');
      }
    }

    if (gamesDatabaseColumns && gamesDatabaseColumns.length > 0) {
      const gamesDatabaseLogoFields = gamesDatabaseColumns.filter(col =>
        col.column_name.toLowerCase().includes('logo')
      );
      console.log('Games_database table logo fields:');
      if (gamesDatabaseLogoFields.length > 0) {
        gamesDatabaseLogoFields.forEach(field =>
          console.log(`   ✅ ${field.column_name}: ${field.data_type}`)
        );
      } else {
        console.log('   ❌ No logo fields found in games_database table');
      }
    }

    // Sample a few rows to see actual data structure
    console.log('\n4. Sample data from each table:');

    if (gamesColumns && gamesColumns.length > 0) {
      console.log('Sample from games table:');
      const { data: gamesSample, error: gamesSampleError } = await supabase
        .from('games')
        .select('*')
        .limit(3);

      if (gamesSampleError) {
        console.log('❌ Error fetching games sample:', gamesSampleError);
      } else {
        console.log('✅ Games table sample:');
        gamesSample?.forEach((game, index) => {
          console.log(`   Row ${index + 1}:`);
          Object.keys(game).forEach(key => {
            const value = game[key];
            const preview = typeof value === 'string' && value.length > 50
              ? value.substring(0, 50) + '...'
              : value;
            console.log(`     ${key}: ${preview}`);
          });
        });
      }
    }

    if (gamesDatabaseColumns && gamesDatabaseColumns.length > 0) {
      console.log('\nSample from games_database table:');
      const { data: gamesDatabaseSample, error: gamesDatabaseSampleError } = await supabase
        .from('games_database')
        .select('*')
        .limit(3);

      if (gamesDatabaseSampleError) {
        console.log('❌ Error fetching games_database sample:', gamesDatabaseSampleError);
      } else {
        console.log('✅ Games_database table sample:');
        gamesDatabaseSample?.forEach((game, index) => {
          console.log(`   Row ${index + 1}:`);
          Object.keys(game).forEach(key => {
            const value = game[key];
            const preview = typeof value === 'string' && value.length > 50
              ? value.substring(0, 50) + '...'
              : value;
            console.log(`     ${key}: ${preview}`);
          });
        });
      }
    }

  } catch (error) {
    console.error('❌ Schema check failed:', error);
  }
}

checkGamesTablesSchema().catch(console.error);