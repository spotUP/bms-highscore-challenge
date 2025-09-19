import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function exploreGamesData() {
  console.log('🔍 Exploring games database for competitive vs. game filtering...');

  // Check genres for 2-player arcade games
  console.log('\n📋 Checking genres for 2-player arcade games...');
  const { data: genreData, error: genreError } = await supabase
    .from('games_database')
    .select('genres')
    .eq('platform_name', 'Arcade')
    .eq('max_players', 2)
    .not('genres', 'is', null)
    .limit(50);

  if (genreError) {
    console.error('❌ Error fetching genres:', genreError);
  } else {
    const allGenres = new Set();
    genreData.forEach(game => {
      if (game.genres) {
        game.genres.forEach(genre => allGenres.add(genre));
      }
    });
    console.log('📊 Available genres:', Array.from(allGenres).sort());
  }

  // Check play modes for 2-player arcade games
  console.log('\n🎮 Checking play modes for 2-player arcade games...');
  const { data: playModeData, error: playModeError } = await supabase
    .from('games_database')
    .select('play_modes')
    .eq('platform_name', 'Arcade')
    .eq('max_players', 2)
    .not('play_modes', 'is', null)
    .limit(50);

  if (playModeError) {
    console.error('❌ Error fetching play modes:', playModeError);
  } else {
    const allPlayModes = new Set();
    playModeData.forEach(game => {
      if (game.play_modes) {
        game.play_modes.forEach(mode => allPlayModes.add(mode));
      }
    });
    console.log('🎯 Available play modes:', Array.from(allPlayModes).sort());
  }

  // Check cooperative field distribution
  console.log('\n🤝 Checking cooperative field distribution...');
  const { data: coopData, error: coopError } = await supabase
    .from('games_database')
    .select('cooperative, name')
    .eq('platform_name', 'Arcade')
    .eq('max_players', 2)
    .limit(20);

  if (coopError) {
    console.error('❌ Error fetching coop data:', coopError);
  } else {
    console.log('🔢 Sample cooperative field values:');
    coopData.forEach(game => {
      console.log(`  ${game.name}: cooperative = ${game.cooperative}`);
    });
  }

  // Look for specific versus games with strict filtering
  console.log('\n⚔️ Looking for strict competitive versus games...');
  const { data: versusGames, error: versusError } = await supabase
    .from('games_database')
    .select('name, genres, play_modes, cooperative, overview, max_players')
    .eq('platform_name', 'Arcade')
    .eq('max_players', 2)
    .not('genres', 'cs', '{"Fighting"}')
    .eq('cooperative', false)
    .or('genres.cs.{"Racing"},genres.cs.{"Sports"}')
    .not('community_rating', 'is', null)
    .gte('community_rating', 3.0)
    .order('community_rating', { ascending: false })
    .limit(15);

  if (versusError) {
    console.error('❌ Error fetching versus games:', versusError);
  } else {
    console.log('🏆 Top versus games found:');
    versusGames.forEach(game => {
      console.log(`  📍 ${game.name}`);
      console.log(`     Genres: ${game.genres?.join(', ') || 'None'}`);
      console.log(`     Play Modes: ${game.play_modes?.join(', ') || 'None'}`);
      console.log(`     Cooperative: ${game.cooperative}`);
      console.log(`     Overview: ${game.overview ? game.overview.substring(0, 100) + '...' : 'None'}`);
      console.log('');
    });
  }
}

exploreGamesData().catch(console.error);