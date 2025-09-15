import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tnsgrwntmnzpaifmutqh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing required environment variables');
  console.error('Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkSchema() {
  try {
    console.log('Checking database schema...');
    
    // Check if tables exist using raw SQL
    const { data: tables, error: tablesError } = await supabase.rpc('pg_tables');
    
    if (tablesError) throw tablesError;
    
    console.log('\n=== Tables in public schema ===');
    console.log(tables);
    
    // Try to create the tables directly
    console.log('\nAttempting to create tables directly...');
    
    const { data: createResult, error: createError } = await supabase.rpc('exec_sql', {
      query: `
        -- Create games table if it doesn't exist
        CREATE TABLE IF NOT EXISTS public.games (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          logo_url TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          include_in_challenge BOOLEAN NOT NULL DEFAULT true,
          tournament_id UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        
        -- Create scores table if it doesn't exist
        CREATE TABLE IF NOT EXISTS public.scores (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          player_name TEXT NOT NULL CHECK (LENGTH(player_name) <= 3),
          score INTEGER NOT NULL CHECK (score >= 0),
          game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
          tournament_id UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `
    });
    
    if (createError) {
      console.error('Error creating tables:', createError);
    } else {
      console.log('Tables created successfully:', createResult);
    }
    
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkSchema();
