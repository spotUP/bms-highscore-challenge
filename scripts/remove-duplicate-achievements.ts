import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using service role key for admin operations

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function removeDuplicateAchievements() {
  console.log('Starting to remove duplicate achievements...');

  try {
    // Step 1: Find all duplicate achievements (same name and tournament_id)
    const { data: duplicates, error: findError } = await supabase
      .rpc('find_duplicate_achievements');

    if (findError) {
      throw findError;
    }

    if (!duplicates || duplicates.length === 0) {
      console.log('No duplicate achievements found!');
      return;
    }

    console.log(`Found ${duplicates.length} sets of duplicate achievements`);

    // Step 2: For each set of duplicates, keep the oldest one and delete the rest
    let deletedCount = 0;

    for (const dup of duplicates) {
      console.log(`\nProcessing duplicates for: ${dup.name} (Tournament: ${dup.tournament_id})`);
      
      // Get all duplicates for this name and tournament
      const { data: achievements, error: fetchError } = await supabase
        .from('achievements')
        .select('*')
        .eq('name', dup.name)
        .eq('tournament_id', dup.tournament_id)
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error(`Error fetching duplicates for ${dup.name}:`, fetchError);
        continue;
      }

      if (!achievements || achievements.length <= 1) {
        console.log('  No duplicates found (might have been processed already)');
        continue;
      }

      // The first one is the oldest (due to ordering above)
      const [oldest, ...rest] = achievements;
      console.log(`  Keeping oldest (ID: ${oldest.id}, Created: ${oldest.created_at})`);
      
      // Delete the rest
      const idsToDelete = rest.map(a => a.id);
      const { error: deleteError } = await supabase
        .from('achievements')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error(`  Error deleting duplicates:`, deleteError);
      } else {
        console.log(`  Deleted ${idsToDelete.length} duplicates`);
        deletedCount += idsToDelete.length;
      }
    }

    console.log(`\nDone! Removed ${deletedCount} duplicate achievements`);

    // Step 3: Add unique constraint if it doesn't exist
    console.log('\nEnsuring unique constraint exists...');
    const { error: constraintError } = await supabase.rpc('add_achievement_name_constraint');
    
    if (constraintError) {
      console.error('Error adding constraint (it might already exist):', constraintError);
    } else {
      console.log('Unique constraint added successfully');
    }

  } catch (error) {
    console.error('Error removing duplicate achievements:', error);
    process.exit(1);
  }
}

// Run the function
removeDuplicateAchievements().catch(console.error);
