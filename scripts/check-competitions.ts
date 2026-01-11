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

async function checkCompetitions() {
  console.log('Checking competitions table...');

  try {
    // Check all competitions
    const { data: competitions, error } = await supabase
      .from('competitions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching competitions:', error);
      return;
    }

    console.log(`Found ${competitions?.length || 0} competitions:`);

    if (competitions && competitions.length > 0) {
      competitions.forEach(comp => {
        console.log(`- ${comp.name} (${comp.status}) - Start: ${comp.start_time}, End: ${comp.end_time}`);
      });
    } else {
      console.log('No competitions found.');
    }

    // Check for active competitions specifically
    const { data: activeComps, error: activeError } = await supabase
      .from('competitions')
      .select('*')
      .eq('status', 'active');

    if (activeError) {
      console.error('Error fetching active competitions:', activeError);
    } else {
      console.log(`\nActive competitions: ${activeComps?.length || 0}`);
      activeComps?.forEach(comp => {
        console.log(`- ${comp.name} - Start: ${comp.start_time}, End: ${comp.end_time}`);
      });
    }

    // If no active competitions, let's create one based on the current tournament
    if (!activeComps || activeComps.length === 0) {
      console.log('\nNo active competitions found. Would you like to create one?');

      // Get current tournament info
      const { data: tournaments, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('slug', 'default-arcade')
        .single();

      if (tournamentError) {
        console.log('Could not find default tournament to base competition on.');
      } else if (tournaments) {
        console.log('Found tournament:', tournaments.name);
        console.log('Tournament times:', tournaments.start_time, 'to', tournaments.end_time);

        // Create a competition based on this tournament
        const competitionData = {
          name: tournaments.name || 'Default Competition',
          description: tournaments.description || 'Default arcade competition',
          start_time: tournaments.start_time || new Date().toISOString(),
          end_time: tournaments.end_time || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          status: 'active'
        };

        console.log('\nCreating active competition with data:', competitionData);

        const { data: newComp, error: createError } = await supabase
          .from('competitions')
          .insert(competitionData)
          .select()
          .single();

        if (createError) {
          console.error('Error creating competition:', createError);
        } else {
          console.log('Successfully created active competition:', newComp);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the check
checkCompetitions().catch(console.error);