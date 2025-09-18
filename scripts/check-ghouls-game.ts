import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkGhoulsGame() {
  console.log('🔍 Searching for Ghouls games in database...\n');

  // Search for games containing "ghouls"
  const { data: ghoulsGames, error } = await supabase
    .from('games_database')
    .select('id, name, platform_name')
    .ilike('name', '%ghouls%')
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Found ${ghoulsGames?.length || 0} games containing "ghouls":`);
  ghoulsGames?.forEach((game, index) => {
    console.log(`  ${index + 1}. "${game.name}" (${game.platform_name})`);
  });

  // Also search for "ghosts" to see related games
  const { data: ghostsGames, error: ghostsError } = await supabase
    .from('games_database')
    .select('id, name, platform_name')
    .ilike('name', '%ghosts%')
    .limit(10);

  if (!ghostsError && ghostsGames?.length) {
    console.log(`\nFound ${ghostsGames.length} games containing "ghosts":`);
    ghostsGames.forEach((game, index) => {
      console.log(`  ${index + 1}. "${game.name}" (${game.platform_name})`);
    });
  }

  // Try the exact variations we'd search for
  const searchTerm = 'ghouls n ghosts';
  const searchVariations = [
    searchTerm, // Original search
    searchTerm.replace(/\s+/g, '-'), // spaces to hyphens
    searchTerm.replace(/\s+/g, ''), // remove spaces
    searchTerm.replace(/-/g, ' '), // hyphens to spaces
    searchTerm.replace(/[^\w\s]/g, ''), // remove punctuation
    // Handle various 'n' patterns
    searchTerm.replace(/\s+n\s+/gi, " 'n "), // "n" to "'n"
    searchTerm.replace(/\s+n\s+/gi, "'n "), // "n" to "'n " - ARCADE FORMAT - SHOULD MATCH!
    searchTerm.replace(/\s+n\s+/gi, " 'n' "), // "n" to "'n'" both sides
    searchTerm.replace(/\s+and\s+/gi, " 'n "), // "and" to "'n"
    searchTerm.replace(/\s+and\s+/gi, "'n "), // "and" to "'n " - ARCADE FORMAT
  ];

  // Check the exact arcade game that should be found
  const { data: arcadeGame } = await supabase
    .from('games_database')
    .select('name, platform_name')
    .eq('name', 'Ghouls\'n Ghosts')
    .eq('platform_name', 'Arcade')
    .single();

  console.log('\nArcade game check:', arcadeGame ? `Found: "${arcadeGame.name}"` : 'Not found');

  console.log('\nTesting search variations:');
  for (const variation of searchVariations) {
    const { data: results } = await supabase
      .from('games_database')
      .select('name, platform_name')
      .ilike('name', `%${variation}%`)
      .limit(5);

    console.log(`  "${variation}": ${results?.length || 0} matches`);
    if (results?.length) {
      results.forEach(game => console.log(`    - "${game.name}" (${game.platform_name})`));
    }
  }

  // Test the specific arcade game variations
  console.log('\nArcade-specific tests:');
  const arcadeVariations = ['ghouls\'n ghosts', 'Ghouls\'n Ghosts'];
  for (const variation of arcadeVariations) {
    const { data: results } = await supabase
      .from('games_database')
      .select('name, platform_name')
      .ilike('name', `%${variation}%`)
      .limit(5);

    console.log(`  "${variation}": ${results?.length || 0} matches`);
    if (results?.length) {
      results.forEach(game => console.log(`    - "${game.name}" (${game.platform_name})`));
    }
  }
}

checkGhoulsGame()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });