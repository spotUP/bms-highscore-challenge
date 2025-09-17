import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updateDefaultTournament() {
  console.log('Updating default arcade tournament with start and end times...');

  try {
    // Set reasonable default times - tournament started a week ago and ends in a month
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('tournaments')
      .update({
        start_time: oneWeekAgo.toISOString(),
        end_time: oneMonthFromNow.toISOString()
      })
      .eq('slug', 'default-arcade')
      .select();

    if (error) {
      console.error('Error updating tournament:', error);
      process.exit(1);
    }

    if (data && data.length > 0) {
      console.log('Successfully updated default arcade tournament:');
      console.log('- Tournament ID:', data[0].id);
      console.log('- Start time:', oneWeekAgo.toISOString());
      console.log('- End time:', oneMonthFromNow.toISOString());
    } else {
      console.log('No tournament found with slug "default-arcade"');

      // Let's see what tournaments exist
      const { data: tournaments, error: listError } = await supabase
        .from('tournaments')
        .select('id, name, slug, start_time, end_time')
        .limit(10);

      if (listError) {
        console.error('Error listing tournaments:', listError);
      } else {
        console.log('Available tournaments:');
        tournaments?.forEach(t => {
          console.log(`- ${t.name} (${t.slug}) - ID: ${t.id}`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the update
updateDefaultTournament().catch(console.error);