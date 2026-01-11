import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixBracketTables() {
  console.log('🔧 Fixing Bracket Tables...\n');

  try {
    // Step 1: Create bracket_players table
    console.log('1. Creating bracket_players table...');
    const { error: createError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.bracket_players (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tournament_id UUID NOT NULL REFERENCES public.bracket_tournaments(id) ON DELETE CASCADE,
          user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          seed INTEGER NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- Create index
        CREATE INDEX IF NOT EXISTS idx_bracket_players_tournament ON public.bracket_players(tournament_id);

        -- Enable RLS
        ALTER TABLE public.bracket_players ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies for bracket_players
        DROP POLICY IF EXISTS bracket_players_select ON public.bracket_players;
        CREATE POLICY bracket_players_select ON public.bracket_players
          FOR SELECT USING (
            EXISTS(SELECT 1 FROM public.bracket_tournaments t WHERE t.id = tournament_id AND (t.is_public OR t.created_by = auth.uid()))
          );

        DROP POLICY IF EXISTS bracket_players_mutate ON public.bracket_players;
        CREATE POLICY bracket_players_mutate ON public.bracket_players
          FOR ALL USING (
            EXISTS(SELECT 1 FROM public.bracket_tournaments t WHERE t.id = tournament_id AND t.created_by = auth.uid())
          ) WITH CHECK (
            EXISTS(SELECT 1 FROM public.bracket_tournaments t WHERE t.id = tournament_id AND t.created_by = auth.uid())
          );
      `
    });

    if (createError) {
      console.error('❌ Error creating bracket_players table:', createError.message);
      throw createError;
    }
    console.log('✅ bracket_players table created successfully');

    // Step 2: Update bracket_matches table if needed
    console.log('\n2. Checking bracket_matches table...');
    const { error: updateError } = await supabase.rpc('execute_sql', {
      sql: `
        -- Update bracket_matches to use bracket_players references if needed
        DO $$
        BEGIN
          -- Check if participant columns reference the wrong table
          IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_name = 'bracket_matches'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_name = 'bracket_participants'
          ) THEN
            -- Drop foreign key constraints that reference bracket_participants
            ALTER TABLE public.bracket_matches DROP CONSTRAINT IF EXISTS bracket_matches_participant1_id_fkey;
            ALTER TABLE public.bracket_matches DROP CONSTRAINT IF EXISTS bracket_matches_participant2_id_fkey;
            ALTER TABLE public.bracket_matches DROP CONSTRAINT IF EXISTS bracket_matches_winner_participant_id_fkey;

            -- Add foreign key constraints that reference bracket_players
            ALTER TABLE public.bracket_matches
            ADD CONSTRAINT bracket_matches_participant1_id_fkey
            FOREIGN KEY (participant1_id) REFERENCES public.bracket_players(id) ON DELETE SET NULL;

            ALTER TABLE public.bracket_matches
            ADD CONSTRAINT bracket_matches_participant2_id_fkey
            FOREIGN KEY (participant2_id) REFERENCES public.bracket_players(id) ON DELETE SET NULL;

            ALTER TABLE public.bracket_matches
            ADD CONSTRAINT bracket_matches_winner_participant_id_fkey
            FOREIGN KEY (winner_participant_id) REFERENCES public.bracket_players(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `
    });

    if (updateError) {
      console.error('❌ Error updating bracket_matches table:', updateError.message);
      throw updateError;
    }
    console.log('✅ bracket_matches table updated successfully');

    // Step 3: Test the fix
    console.log('\n3. Testing bracket system...');
    const { data: tournaments, error: testError } = await supabase
      .from('bracket_tournaments')
      .select('*')
      .limit(1);

    if (testError) {
      console.error('❌ Error testing tournaments:', testError.message);
      throw testError;
    }

    const { data: players, error: playersError } = await supabase
      .from('bracket_players')
      .select('*')
      .limit(1);

    if (playersError) {
      console.error('❌ Error testing players:', playersError.message);
      throw playersError;
    }

    console.log('✅ Bracket system test completed successfully');
    console.log(`   - Found ${tournaments?.length || 0} tournaments`);
    console.log(`   - Found ${players?.length || 0} players`);

    console.log('\n✨ Bracket tables fixed successfully!');
    console.log('📝 The "failed to add players" error should now be resolved.');

  } catch (error) {
    console.error('❌ Fatal error during bracket table fix:', error);
    process.exit(1);
  }
}

fixBracketTables().then(() => {
  console.log('\n🎉 Bracket table fix complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});