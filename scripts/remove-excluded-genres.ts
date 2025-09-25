#!/usr/bin/env tsx

// Remove games with non-highscore-suitable genres from Supabase games_database

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { config } from 'dotenv';

config();

// Excluded genres (not suitable for highscore competitions)
const EXCLUDED_GENRES = [
  'Board Game',
  'Casino',
  'Compilation',
  'Education',
  'Life Simulation',
  'Music',
  'Party',
  'Quiz',
  'Role-Playing',
  'Strategy',
  'Visual Novel'
];

async function removeExcludedGenres() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🧹 Starting removal of non-highscore genres from games_database...');
  console.log(`🎯 Excluding genres: ${EXCLUDED_GENRES.join(', ')}`);

  // Get count before deletion
  const { count: totalBefore } = await supabase
    .from('games_database')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total games before cleanup: ${totalBefore?.toLocaleString()}`);

  let totalDeleted = 0;

  // Process each excluded genre
  for (const genre of EXCLUDED_GENRES) {
    console.log(`\n🗑️ Removing games with genre: "${genre}"`);

    // Get count of games with this genre
    const { count: genreCount } = await supabase
      .from('games_database')
      .select('*', { count: 'exact', head: true })
      .contains('genres', [genre]);

    if (!genreCount || genreCount === 0) {
      console.log(`   ✅ No games found with genre "${genre}"`);
      continue;
    }

    console.log(`   📊 Found ${genreCount.toLocaleString()} games with genre "${genre}"`);

    // Delete games that contain this genre
    const { error, count: deletedCount } = await supabase
      .from('games_database')
      .delete({ count: 'exact' })
      .contains('genres', [genre]);

    if (error) {
      console.error(`   ❌ Error deleting games with genre "${genre}":`, error);
      continue;
    }

    console.log(`   ✅ Deleted ${deletedCount?.toLocaleString()} games with genre "${genre}"`);
    totalDeleted += deletedCount || 0;
  }

  // Get final count
  const { count: totalAfter } = await supabase
    .from('games_database')
    .select('*', { count: 'exact', head: true });

  console.log('\n🎉 Genre cleanup completed!');
  console.log(`📊 Before: ${totalBefore?.toLocaleString()} games`);
  console.log(`📊 After: ${totalAfter?.toLocaleString()} games`);
  console.log(`🗑️ Total deleted: ${totalDeleted.toLocaleString()} games`);
  console.log(`📈 Reduction: ${Math.round(((totalBefore! - totalAfter!) / totalBefore!) * 100)}%`);

  // Show remaining genres
  console.log('\n🎯 Remaining genres in database:');
  const { data: remainingGenres } = await supabase
    .from('games_database')
    .select('genres')
    .not('genres', 'is', null);

  if (remainingGenres) {
    const allGenres = new Set();
    remainingGenres.forEach(row => {
      if (row.genres && Array.isArray(row.genres)) {
        row.genres.forEach(genre => {
          if (genre && genre.trim()) {
            allGenres.add(genre.trim());
          }
        });
      }
    });

    const sortedGenres = Array.from(allGenres).sort();
    sortedGenres.forEach(genre => console.log(`   - ${genre}`));
    console.log(`📊 ${sortedGenres.length} unique genres remaining`);
  }
}

removeExcludedGenres().catch(console.error);