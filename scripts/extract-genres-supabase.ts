#!/usr/bin/env tsx

// Extract all unique genres from Supabase games_database table

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { config } from 'dotenv';

config();

async function extractGenres() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Extracting genres from games_database...');

  // Get distinct genres from games_database
  const { data, error } = await supabase
    .from('games_database')
    .select('genres')
    .not('genres', 'is', null);

  if (error) {
    console.error('❌ Error fetching genres:', error);
    return;
  }

  // Flatten all genres arrays and get unique values
  const allGenres = new Set();
  data.forEach(row => {
    if (row.genres && Array.isArray(row.genres)) {
      row.genres.forEach(genre => {
        if (genre && genre.trim()) {
          allGenres.add(genre.trim());
        }
      });
    }
  });

  const uniqueGenres = Array.from(allGenres).sort();

  // Write to file
  fs.writeFileSync('all-game-genres.txt', uniqueGenres.join('\n'));

  console.log(`✅ Extracted ${uniqueGenres.length} unique genres to all-game-genres.txt`);

  // Also show some stats
  console.log(`📊 First 10 genres:`);
  uniqueGenres.slice(0, 10).forEach(genre => console.log(`  - ${genre}`));

  if (uniqueGenres.length > 10) {
    console.log(`  ... and ${uniqueGenres.length - 10} more`);
  }
}

extractGenres().catch(console.error);