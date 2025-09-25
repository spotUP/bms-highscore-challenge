#!/usr/bin/env tsx

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkApprovedPlatformGenres() {
  try {
    console.log('🔍 Checking genres from approved platforms...');

    // Get approved platforms
    const { data: platformsData, error: platformsError } = await supabase
      .from('platforms')
      .select('name')
      .order('name');

    if (platformsError) {
      console.error('Error querying platforms table:', platformsError);
      return;
    }

    const approvedPlatformNames = platformsData?.map(p => p.name) || [];
    console.log(`📊 Found ${approvedPlatformNames.length} approved platforms`);

    // Get genres from games in approved platforms only
    const { data: genresData, error: genresError } = await supabase
      .from('games_database')
      .select('genres')
      .not('genres', 'is', null)
      .in('platform_name', approvedPlatformNames);

    if (genresError) {
      console.error('Error querying genres:', genresError);
      return;
    }

    // Count genres
    const genreCount: Record<string, number> = {};
    const genreSet = new Set<string>();

    genresData?.forEach(row => {
      row.genres?.forEach((genre: string) => {
        genreSet.add(genre);
        genreCount[genre] = (genreCount[genre] || 0) + 1;
      });
    });

    const sortedGenres = Array.from(genreSet).sort();
    console.log(`\n📋 Found ${sortedGenres.length} unique genres in approved platforms:`);

    // Show genre counts
    sortedGenres.forEach((genre, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${genre.padEnd(20)} (${genreCount[genre]} games)`);
    });

    console.log(`\n📊 Total genre entries: ${genresData?.length || 0}`);

  } catch (error) {
    console.error('Script error:', error);
  }
}

checkApprovedPlatformGenres().catch(console.error);