#!/usr/bin/env tsx

// Import SQLite games metadata to Supabase
// This script reads from the local SQLite database and imports game metadata
// (excluding image data) to the Supabase games_database table

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface SQLiteGame {
  id: number;
  name: string;
  platform_name: string;
  has_logo: number;
  logo_chunk: number | null;
  processed_at: string;
}

interface SupabaseGame {
  name: string;
  platform_name: string;
  database_id: number;
  // Other fields will be null/undefined
}

async function main() {
  console.log('🚀 Starting SQLite to Supabase import...');

  // Check environment variables
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Open SQLite database
  const sqliteDb = new Database('public/games-index.db', { readonly: true });

  try {
    // Get total count
    const countStmt = sqliteDb.prepare('SELECT COUNT(*) as total FROM games');
    const { total } = countStmt.get() as { total: number };
    console.log(`📊 Found ${total} games in SQLite database`);

    // Prepare queries
    const selectStmt = sqliteDb.prepare(`
      SELECT id, name, platform_name, has_logo, logo_chunk, processed_at
      FROM games
      ORDER BY id
    `);

    // We'll use upsert directly

    // Process in batches
    const batchSize = 1000;
    let processed = 0;
    let batch: SupabaseGame[] = [];

    console.log('🔄 Processing games in batches...');

    for (const row of selectStmt.iterate() as IterableIterator<SQLiteGame>) {
      batch.push({
        name: row.name,
        platform_name: row.platform_name,
        database_id: row.id,
      });

      if (batch.length >= batchSize) {
        await insertBatch(supabase, batch);
        processed += batch.length;
        console.log(`✅ Processed ${processed}/${total} games`);
        batch = [];
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      await insertBatch(supabase, batch);
      processed += batch.length;
      console.log(`✅ Processed ${processed}/${total} games`);
    }

    console.log('🎉 Import completed successfully!');

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    sqliteDb.close();
  }
}

async function insertBatch(
  supabase: any,
  batch: SupabaseGame[]
): Promise<void> {
  const { error } = await supabase
    .from('games_database')
    .upsert(batch, {
      onConflict: 'database_id',
      ignoreDuplicates: false // Update existing records
    });

  if (error) {
    console.error('❌ Batch insert failed:', error);
    throw error;
  }
}

// Run the script
main().catch(console.error);