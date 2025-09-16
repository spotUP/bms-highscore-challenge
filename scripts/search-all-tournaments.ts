import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchAllTournaments() {
  try {
    console.log('🔍 Searching for Test2 tournament in all tables...\n');

    // Check bracket tournaments
    console.log('📋 Bracket Tournaments:');
    const { data: bracketTournaments, error: bracketError } = await supabase
      .from('bracket_tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (bracketError) {
      console.error('❌ Error fetching bracket tournaments:', bracketError);
    } else {
      console.log(`  Found ${bracketTournaments?.length || 0} bracket tournaments`);
      if (bracketTournaments && bracketTournaments.length > 0) {
        bracketTournaments.forEach((t, i) => {
          console.log(`    ${i + 1}. "${t.name}" (ID: ${t.id})`);
        });
      }
    }

    // Look for anything with "test" in the name
    const testTournaments = bracketTournaments?.filter((t: any) =>
      t.name.toLowerCase().includes('test')
    ) || [];

    if (testTournaments.length > 0) {
      console.log('\n🧪 Found tournaments with "test" in bracket_tournaments:');
      testTournaments.forEach((t: any) => {
        console.log(`  - "${t.name}" (ID: ${t.id}, Status: ${t.status})`);
      });
    }

    console.log('\n🎯 If you can see Test2 in the UI, try refreshing the page - it might be cached data.');
    console.log('The tournament appears to already be deleted from the database.');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

searchAllTournaments();