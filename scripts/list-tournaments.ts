import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllTournaments() {
  try {
    console.log('📋 Listing all bracket tournaments...\n');

    // Get all tournaments
    const { data: tournaments, error } = await supabase
      .from('bracket_tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching tournaments:', error);
      return;
    }

    if (!tournaments || tournaments.length === 0) {
      console.log('❌ No bracket tournaments found');
      return;
    }

    console.log(`Found ${tournaments.length} tournament(s):\n`);

    tournaments.forEach((t, i) => {
      console.log(`${i + 1}. "${t.name}"`);
      console.log(`   ID: ${t.id}`);
      console.log(`   Status: ${t.status}`);
      console.log(`   Type: ${t.bracket_type}`);
      console.log(`   Created: ${t.created_at}`);
      console.log(`   Updated: ${t.updated_at}`);
      console.log(`   Created by: ${t.created_by}`);
      console.log('');
    });

    // Look for tournaments with "test" in the name (case insensitive)
    const testTournaments = tournaments.filter(t =>
      t.name.toLowerCase().includes('test')
    );

    if (testTournaments.length > 0) {
      console.log('🧪 Tournaments with "test" in the name:');
      testTournaments.forEach(t => {
        console.log(`  - "${t.name}" (ID: ${t.id})`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

listAllTournaments();