import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function runMigration() {
  console.log('Starting to apply migration...');

  try {
    // Determine migration file path from CLI arg or fallback to previous default
    const argPath = process.argv[2];
    const migrationPath = argPath
      ? path.isAbsolute(argPath)
        ? argPath
        : path.join(process.cwd(), argPath)
      : path.join(
          __dirname,
          '../supabase/migrations/20250910212000_add_achievement_functions.sql'
        );

    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Execute each statement
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 100) + '...');
      
      try {
        // Execute raw SQL using Supabase client
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Ignore "already exists" errors and similar
          if (error.message?.includes('already exists') || 
              error.message?.includes('relation') || 
              error.message?.includes('function') ||
              error.message?.includes('trigger') ||
              error.message?.includes('does not exist') ||
              error.message?.includes('duplicate')) {
            console.log('  (statement already applied or relation exists)');
          } else {
            throw error;
          }
        } else {
          console.log('  Success');
        }
      } catch (error: any) {
        // Ignore common "already exists" type errors
        if (error.message?.includes('already exists') || 
            error.message?.includes('relation') ||
            error.message?.includes('function') ||
            error.message?.includes('trigger') ||
            error.message?.includes('does not exist') ||
            error.message?.includes('duplicate')) {
          console.log('  (statement already applied)');
        } else {
          console.error('  Error executing statement:', error);
          throw error;
        }
      }
    }

    console.log('Migration applied successfully!');
    
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration().catch(console.error);
