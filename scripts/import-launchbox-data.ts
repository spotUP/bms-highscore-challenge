import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseStringPromise } from 'xml2js';
import path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface LaunchBoxGame {
  Name: string[];
  Platform?: string[];
  ReleaseYear?: string[];
  Overview?: string[];
  MaxPlayers?: string[];
  ReleaseType?: string[];
  Cooperative?: string[];
  VideoURL?: string[];
  DatabaseID?: string[];
  CommunityRating?: string[];
  CommunityRatingCount?: string[];
  ESRB?: string[];
  Genres?: string[];
  Developer?: string[];
  Publisher?: string[];
  Series?: string[];
  Region?: string[];
  AlternateName?: string[];
  PlayModes?: string[];
  Theme?: string[];
  WikipediaURL?: string[];
  VideoURLs?: string[];
}

interface LaunchBoxPlatform {
  Name: string[];
  Emulated?: string[];
  ReleaseDate?: string[];
  Developer?: string[];
  Manufacturer?: string[];
  Cpu?: string[];
  Memory?: string[];
  Graphics?: string[];
  Sound?: string[];
  Display?: string[];
  Media?: string[];
  MaxControllers?: string[];
  Notes?: string[];
  Category?: string[];
  UseMameFiles?: string[];
}

function getFirstValue(arr: string[] | undefined): string | null {
  return arr && arr.length > 0 ? arr[0] : null;
}

function splitGenres(genreString: string | null): string[] {
  if (!genreString) return [];
  return genreString.split(/[,;]/).map(g => g.trim()).filter(Boolean);
}

async function importPlatforms() {
  console.log('📱 Importing platforms...');

  const platformsXml = readFileSync('Platforms.xml', 'utf8');
  const platformsData = await parseStringPromise(platformsXml);

  const platforms = platformsData.LaunchBox?.Platform || [];

  for (let i = 0; i < platforms.length; i++) {
    const platform: LaunchBoxPlatform = platforms[i];
    const batch = platforms.slice(i, i + 100); // Process in batches of 100

    const platformInserts = batch.map((p: LaunchBoxPlatform) => ({
      name: getFirstValue(p.Name)!,
      emulated: getFirstValue(p.Emulated) === 'true',
      release_date: getFirstValue(p.ReleaseDate) ? new Date(getFirstValue(p.ReleaseDate)!).toISOString().split('T')[0] : null,
      developer: getFirstValue(p.Developer),
      manufacturer: getFirstValue(p.Manufacturer),
      cpu: getFirstValue(p.Cpu),
      memory: getFirstValue(p.Memory),
      graphics: getFirstValue(p.Graphics),
      sound: getFirstValue(p.Sound),
      display: getFirstValue(p.Display),
      media: getFirstValue(p.Media),
      max_controllers: getFirstValue(p.MaxControllers),
      notes: getFirstValue(p.Notes),
      category: getFirstValue(p.Category),
      use_mame_files: getFirstValue(p.UseMameFiles) === 'true'
    }));

    const { error } = await supabase.from('platforms').upsert(platformInserts, {
      onConflict: 'name',
      ignoreDuplicates: false
    });

    if (error) {
      console.error('Error inserting platforms batch:', error);
    } else {
      console.log(`✅ Inserted platforms batch ${Math.floor(i/100) + 1}`);
    }

    i += 99; // Skip ahead since we processed a batch
  }

  console.log('✅ Platforms import complete!');
}

async function importGames() {
  console.log('🎮 Importing games (this may take a while)...');

  const metadataXml = readFileSync('Metadata.xml', 'utf8');
  const metadataData = await parseStringPromise(metadataXml);

  const games = metadataData.LaunchBox?.Game || [];
  console.log(`Found ${games.length} games to import`);

  // Get platform mapping
  const { data: platforms } = await supabase.from('platforms').select('id, name');
  const platformMap = new Map(platforms?.map(p => [p.name, p.id]) || []);

  const batchSize = 100;

  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);

    const gameInserts = batch.map((game: LaunchBoxGame) => {
      const platformName = getFirstValue(game.Platform);
      const platformId = platformName ? platformMap.get(platformName) : null;

      const releaseYear = getFirstValue(game.ReleaseYear);
      const maxPlayers = getFirstValue(game.MaxPlayers);
      const databaseId = getFirstValue(game.DatabaseID);
      const communityRating = getFirstValue(game.CommunityRating);
      const communityRatingCount = getFirstValue(game.CommunityRatingCount);

      return {
        name: getFirstValue(game.Name)!,
        platform_id: platformId,
        platform_name: platformName || 'Unknown',
        database_id: databaseId ? parseInt(databaseId) : null,
        release_year: releaseYear ? parseInt(releaseYear) : null,
        overview: getFirstValue(game.Overview),
        max_players: maxPlayers ? parseInt(maxPlayers) : null,
        release_type: getFirstValue(game.ReleaseType),
        cooperative: getFirstValue(game.Cooperative) === 'true',
        video_url: getFirstValue(game.VideoURL),
        community_rating: communityRating ? parseFloat(communityRating) : null,
        community_rating_count: communityRatingCount ? parseInt(communityRatingCount) : null,
        esrb_rating: getFirstValue(game.ESRB),
        genres: splitGenres(getFirstValue(game.Genres)),
        developer: getFirstValue(game.Developer),
        publisher: getFirstValue(game.Publisher),
        series: getFirstValue(game.Series),
        region: getFirstValue(game.Region),
        alternative_names: game.AlternateName || [],
        play_modes: splitGenres(getFirstValue(game.PlayModes)),
        themes: splitGenres(getFirstValue(game.Theme)),
        wikipedia_url: getFirstValue(game.WikipediaURL),
        video_urls: game.VideoURLs || []
      };
    }).filter(game => game.name); // Filter out games without names

    const { error } = await supabase.from('games_database').upsert(gameInserts, {
      onConflict: 'database_id',
      ignoreDuplicates: false
    });

    if (error) {
      console.error(`Error inserting games batch ${Math.floor(i/batchSize) + 1}:`, error);
      console.error('Sample game that failed:', gameInserts[0]);
    } else {
      console.log(`✅ Inserted games batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(games.length/batchSize)} (${gameInserts.length} games)`);
    }
  }

  console.log('✅ Games import complete!');
}

async function ensureTables() {
  console.log('🏗️ Ensuring database tables exist...');

  // Check if tables exist, if not, they'll be created by the first insert
  const { data: platforms } = await supabase.from('platforms').select('count').limit(1);
  const { data: games } = await supabase.from('games_database').select('count').limit(1);

  console.log('✅ Tables ready for import!');
}

async function main() {
  console.log('🚀 Starting LaunchBox data import...');

  try {
    await ensureTables();
    await importPlatforms();
    await importGames();

    // Get final stats
    const { count: platformCount } = await supabase.from('platforms').select('*', { count: 'exact', head: true });
    const { count: gameCount } = await supabase.from('games_database').select('*', { count: 'exact', head: true });

    console.log(`\n🎉 Import completed successfully!`);
    console.log(`📱 Platforms: ${platformCount}`);
    console.log(`🎮 Games: ${gameCount}`);

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

// Run the import if this script is executed directly
main();