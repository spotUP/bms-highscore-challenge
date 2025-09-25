#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  try {
    console.log('🔍 Checking games_database schema...\n');

    // Try to get a single row to see what fields are available
    const { data, error } = await supabase
      .from('games_database')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error fetching from games_database:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('📊 games_database is empty, checking with describe');

      // Try to insert a dummy row to see what fields are expected
      const { error: insertError } = await supabase
        .from('games_database')
        .insert([{ name: 'test' }]);

      if (insertError) {
        console.log('Schema validation error:', insertError.message);
        console.log('Details:', insertError.details);
      }

    } else {
      console.log('📋 Available fields in games_database:');
      const fields = Object.keys(data[0]);
      fields.forEach((field, index) => {
        console.log(`   ${index + 1}. ${field}: ${typeof data[0][field]} = ${data[0][field]}`);
      });
    }

  } catch (error) {
    console.error('Schema check error:', error);
  }
}

checkSchema().catch(console.error);
