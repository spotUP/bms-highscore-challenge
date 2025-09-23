#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createFullSchema() {
  console.log('🔧 Creating full LaunchBox schema...');

  // Add all missing columns to games_database table
  const alterQueries = [
    // Core game metadata
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS platform_id UUID REFERENCES platforms(id);`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS database_id INTEGER UNIQUE;`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS release_year INTEGER;`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS overview TEXT;`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS max_players INTEGER;`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS release_type TEXT;`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS cooperative BOOLEAN;`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS video_url TEXT;`,

    // Rating and community data
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS community_rating DECIMAL(4,2);`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS community_rating_count INTEGER;`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS esrb_rating TEXT;`,

    // Game details
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS genres TEXT[] DEFAULT '{}';`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS developer TEXT;`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS publisher TEXT;`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS series TEXT;`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS region TEXT;`,

    // Additional metadata
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS alternative_names TEXT[] DEFAULT '{}';`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS play_modes TEXT[] DEFAULT '{}';`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS themes TEXT[] DEFAULT '{}';`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS wikipedia_url TEXT;`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS video_urls TEXT[] DEFAULT '{}';`,

    // Image URLs for better organization
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS screenshot_url TEXT;`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS cover_url TEXT;`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS logo_url TEXT;`,
  ];

  for (const query of alterQueries) {
    try {
      console.log(`Running: ${query.substring(0, 80)}...`);

      // Use a direct query since we can't use stored procedures
      const { error } = await supabase.rpc('exec_sql', { sql_query: query }).catch(async () => {
        // If exec_sql doesn't exist, try using the raw SQL approach
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({ sql_query: query })
        });

        if (!response.ok) {
          const error = await response.json();
          throw error;
        }

        return { error: null };
      });

      if (error) {
        console.log(`⚠️  ${error.message}`);
      } else {
        console.log('✅ Success');
      }
    } catch (err: any) {
      console.log(`⚠️  Error: ${err.message || err}`);
    }
  }

  // Create indexes for better performance
  const indexQueries = [
    `CREATE INDEX IF NOT EXISTS idx_games_database_name ON games_database(name);`,
    `CREATE INDEX IF NOT EXISTS idx_games_database_platform ON games_database(platform_name);`,
    `CREATE INDEX IF NOT EXISTS idx_games_database_release_year ON games_database(release_year);`,
    `CREATE INDEX IF NOT EXISTS idx_games_database_rating ON games_database(community_rating);`,
    `CREATE INDEX IF NOT EXISTS idx_games_database_genres ON games_database USING GIN(genres);`,
    `CREATE INDEX IF NOT EXISTS idx_games_database_developer ON games_database(developer);`,
    `CREATE INDEX IF NOT EXISTS idx_games_database_publisher ON games_database(publisher);`,
    `CREATE INDEX IF NOT EXISTS idx_games_database_database_id ON games_database(database_id);`,
  ];

  console.log('\n📊 Creating performance indexes...');
  for (const query of indexQueries) {
    try {
      console.log(`Running: ${query.substring(0, 60)}...`);

      const { error } = await supabase.rpc('exec_sql', { sql_query: query }).catch(async () => {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({ sql_query: query })
        });

        if (!response.ok) {
          const error = await response.json();
          throw error;
        }

        return { error: null };
      });

      if (error) {
        console.log(`⚠️  ${error.message}`);
      } else {
        console.log('✅ Index created');
      }
    } catch (err: any) {
      console.log(`⚠️  Index error: ${err.message || err}`);
    }
  }

  console.log('\n🎉 Schema creation complete!');
}

createFullSchema();