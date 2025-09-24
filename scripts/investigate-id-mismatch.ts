#!/usr/bin/env tsx

// Investigate the ID mismatch causing Cool World logo to appear for GTA V

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

console.log('🔍 Investigating ID mismatch...');

// The Cool World logo base64 signature
const coolWorldStart = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAADhCAYAAADmtuMcAAAAAXNSR0IArs4c6Q';

console.log('\n1. Checking what games have the Cool World logo...');

// Find any games with the Cool World logo
const { data: gamesWithCoolWorldLogo, error: logoError } = await supabase
  .from('games_database')
  .select('id, name, platform_name, launchbox_id')
  .like('logo_base64', `${coolWorldStart}%`)
  .limit(10);

if (logoError) {
  console.error('Error:', logoError);
} else {
  console.log(`Found ${gamesWithCoolWorldLogo?.length} games with Cool World logo:`);
  gamesWithCoolWorldLogo?.forEach(game => {
    console.log(`   ID: ${game.id}, LaunchBox ID: ${game.launchbox_id}, Name: "${game.name}", Platform: ${game.platform_name}`);
  });
}

console.log('\n2. Checking what Cool World games exist...');

// Find actual Cool World games
const { data: coolWorldGames, error: coolError } = await supabase
  .from('games_database')
  .select('id, name, platform_name, launchbox_id')
  .ilike('name', '%Cool World%')
  .limit(10);

if (coolError) {
  console.error('Error:', coolError);
} else {
  console.log(`Found ${coolWorldGames?.length} actual Cool World games:`);
  coolWorldGames?.forEach(game => {
    console.log(`   ID: ${game.id}, LaunchBox ID: ${game.launchbox_id}, Name: "${game.name}", Platform: ${game.platform_name}`);
  });
}

console.log('\n3. Checking Grand Theft Auto V games...');

// Find GTA V games
const { data: gtaGames, error: gtaError } = await supabase
  .from('games_database')
  .select('id, name, platform_name, launchbox_id')
  .ilike('name', '%Grand Theft Auto V%')
  .limit(10);

if (gtaError) {
  console.error('Error:', gtaError);
} else {
  console.log(`Found ${gtaGames?.length} GTA V games:`);
  gtaGames?.forEach(game => {
    console.log(`   ID: ${game.id}, LaunchBox ID: ${game.launchbox_id}, Name: "${game.name}", Platform: ${game.platform_name}`);
  });
}

console.log('\n💡 Analysis: Look for LaunchBox ID overlaps that could explain the logo mix-up!');