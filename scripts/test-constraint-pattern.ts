import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function testConstraintPattern() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log('🧪 Testing constraint pattern...');

  const testCases = [
    'A',           // 1 char - worked before
    'AB',          // 2 chars
    'ABC',         // 3 chars
    'a',           // lowercase
    'ab',          // lowercase 2 chars
    '1',           // number
    '12',          // 2 numbers
    'A1',          // letter + number
    ' ',           // space
    '',            // empty
    'X',           // another single letter
    'Z',           // another single letter
    'Player',      // common name
    'test',        // lowercase word
  ];

  const gameId = '95caf0d5-f28f-4dc0-b56d-695adf0aadc8';
  const tournamentId = 'bce0d5e5-2a88-45e2-b84d-86d73dd20dd5';

  const successfulNames = [];
  const failedNames = [];

  for (const testName of testCases) {
    console.log(`Testing: "${testName}" (length: ${testName.length})`);

    const { data: testScore, error: testError } = await supabase
      .from('scores')
      .insert({
        player_name: testName,
        score: Math.floor(Math.random() * 1000),
        game_id: gameId,
        tournament_id: tournamentId
      })
      .select();

    if (testError) {
      console.log(`  ❌ Failed: ${testError.message}`);
      failedNames.push({ name: testName, length: testName.length, error: testError.message });
    } else {
      console.log(`  ✅ Success!`);
      successfulNames.push({ name: testName, length: testName.length });

      // Clean up
      if (testScore && testScore[0]) {
        await supabase.from('scores').delete().eq('id', testScore[0].id);
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n📊 Results Summary:');
  console.log('\n✅ Successful names:');
  successfulNames.forEach(item =>
    console.log(`  "${item.name}" (length: ${item.length})`)
  );

  console.log('\n❌ Failed names:');
  failedNames.forEach(item =>
    console.log(`  "${item.name}" (length: ${item.length})`)
  );

  // Try to deduce the pattern
  console.log('\n🔍 Pattern Analysis:');
  const successLengths = successfulNames.map(s => s.length);
  const failLengths = failedNames.map(f => f.length);

  if (successLengths.length > 0) {
    const maxSuccessLength = Math.max(...successLengths);
    const minSuccessLength = Math.min(...successLengths);
    console.log(`Successful lengths: ${successLengths.join(', ')}`);
    console.log(`Range: ${minSuccessLength} to ${maxSuccessLength} characters`);
  }

  if (failLengths.length > 0) {
    console.log(`Failed lengths: ${failLengths.join(', ')}`);
  }

  // Recommendation
  if (successfulNames.length > 0) {
    console.log('\n💡 Recommendation:');
    console.log('It appears the constraint only allows very short names (possibly 1 character).');
    console.log('This constraint should be removed to allow normal player names.');
    console.log('You may need to access the Supabase dashboard directly to remove this constraint.');
  }
}

testConstraintPattern();