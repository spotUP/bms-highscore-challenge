#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function applySchemaDirect() {
  console.log('🔧 Applying schema changes directly...');

  // Read the SQL file
  const sqlContent = readFileSync('create-full-launchbox-schema.sql', 'utf8');

  // Split into individual statements
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    if (!statement || statement.trim().length === 0) continue;

    try {
      console.log(`\n${i + 1}/${statements.length}: ${statement.substring(0, 60)}...`);

      // Try to execute the SQL directly using fetch to Supabase
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          sql_query: statement + ';'
        })
      });

      if (response.ok) {
        console.log('✅ Success');
        successCount++;
      } else {
        const errorData = await response.json();
        console.log(`⚠️  Error: ${errorData.message || 'Unknown error'}`);
        errorCount++;
      }
    } catch (error: any) {
      console.log(`⚠️  Exception: ${error.message}`);
      errorCount++;
    }

    // Small delay to prevent overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n🎉 Schema application complete!`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`⚠️  Errors: ${errorCount}`);
}

applySchemaDirect();