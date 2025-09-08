import fs from 'fs';
import path from 'path';

// Read the current game-logo-mapping.json
const currentMapping = JSON.parse(fs.readFileSync('src/data/game-logo-mapping.json', 'utf8'));

// Get list of all logo files
const logoFiles = fs.readdirSync('public/game-logos/')
  .filter(file => file.endsWith('.png'))
  .map(file => file.replace('.png', ''));

console.log(`Found ${logoFiles.length} logo files`);

// Read the MAME names XML file (if available) or use a comprehensive list
// For now, let's use the logo filenames as MAME names since they follow MAME conventions
const mameGames = logoFiles;

// Create a comprehensive mapping
const newMapping = { ...currentMapping };
let addedCount = 0;

// Function to create a readable game title from MAME name
function createGameTitle(mameName) {
  // Common MAME name to title mappings
  const commonMappings = {
    'pacman': 'Pac-Man',
    'mspacman': 'Ms. Pac-Man',
    'dkong': 'Donkey Kong',
    'dkongjr': 'Donkey Kong Junior',
    'dkong3': 'Donkey Kong 3',
    'galaga': 'Galaga',
    'frogger': 'Frogger',
    'centiped': 'Centipede',
    'asteroid': 'Asteroids',
    'defender': 'Defender',
    'tempest': 'Tempest',
    'robotron': 'Robotron 2084',
    'joust': 'Joust',
    'qbert': 'Q*bert',
    'digdug': 'Dig Dug',
    'berzerk': 'Berzerk',
    'missile': 'Missile Command',
    'invaders': 'Space Invaders',
    'bublbobl': 'Bubble Bobble',
    'wiz': 'Wizard of Wor',
    'gorf': 'Gorf',
    'bagman': 'Bagman',
    'athena': 'Athena',
    'botanic': 'Botanic',
    'pickin': 'Pickin\'',
    'squash': 'Squash',
    'superbag': 'Super Bagman',
    'bankpanic': 'Bank Panic',
    'combathawk': 'Combat Hawk',
    'bradley': 'Bradley Trainer',
    'blackwidow': 'Black Widow',
    'gravitar': 'Gravitar',
    'blasto': 'Blasto',
    'bubbles': 'Bubbles',
    'playball': 'Playball',
    'ebases': 'Extra Bases',
    'seawolf2': 'Sea Wolf II',
    'ace': 'Space Zap',
    'robby': 'The Adventures of Robby Roto!',
    'tetris': 'Tetris',
    'arkanoid': 'Arkanoid',
    'gauntlet': 'Gauntlet',
    'gauntlet2': 'Gauntlet II',
    'rampage': 'Rampage',
    'rampage2': 'Rampage: World Tour',
    'spy': 'Spy Hunter',
    'spyhunt': 'Spy Hunter',
    'outrun': 'Out Run',
    'hangon': 'Hang-On',
    'afterburn': 'After Burner',
    'shinobi': 'Shinobi',
    'altered': 'Altered Beast',
    'goldenaxe': 'Golden Axe',
    'streets': 'Streets of Rage',
    'sonic': 'Sonic the Hedgehog',
    'mario': 'Super Mario Bros.',
    'zelda': 'The Legend of Zelda',
    'metroid': 'Metroid',
    'contra': 'Contra',
    'castlevania': 'Castlevania',
    'megaman': 'Mega Man',
    'streetfighter': 'Street Fighter',
    'streetf': 'Street Fighter',
    'sf2': 'Street Fighter II',
    'sf2ce': 'Street Fighter II: Champion Edition',
    'sf2hf': 'Street Fighter II: Hyper Fighting',
    'sf2t': 'Super Street Fighter II Turbo',
    'mk': 'Mortal Kombat',
    'mk2': 'Mortal Kombat II',
    'mk3': 'Mortal Kombat 3',
    'killer': 'Killer Instinct',
    'tekken': 'Tekken',
    'virtua': 'Virtua Fighter',
    'soul': 'Soul Calibur',
    'marvel': 'Marvel vs Capcom',
    'xmen': 'X-Men',
    'xmvsf': 'X-Men vs Street Fighter',
    'mshvsf': 'Marvel Super Heroes vs Street Fighter',
    'mvc': 'Marvel vs Capcom',
    'mvc2': 'Marvel vs Capcom 2',
    'kof': 'The King of Fighters',
    'samsho': 'Samurai Shodown',
    'fatal': 'Fatal Fury',
    'artof': 'Art of Fighting',
    'world': 'World Heroes',
    'last': 'Last Blade',
    'garou': 'Garou: Mark of the Wolves',
    'metal': 'Metal Slug',
    'neogeo': 'Neo Geo',
    'cps1': 'Capcom Play System',
    'cps2': 'Capcom Play System 2',
    'cps3': 'Capcom Play System 3',
    'sega': 'Sega System',
    'namco': 'Namco System',
    'konami': 'Konami System',
    'taito': 'Taito System',
    'irem': 'Irem System',
    'data': 'Data East System',
    'snk': 'SNK System',
    'atari': 'Atari System',
    'williams': 'Williams System',
    'bally': 'Bally/Midway System',
    'cinematronics': 'Cinematronics System',
    'vectorbeam': 'Vectorbeam System',
    'exidy': 'Exidy System',
    'stern': 'Stern System',
    'gottlieb': 'Gottlieb System',
    'centuri': 'Centuri System',
    'universal': 'Universal System',
    'nichibutsu': 'Nichibutsu System',
    'jaleco': 'Jaleco System',
    'technos': 'Technos System',
    'toaplan': 'Toaplan System',
    'cave': 'Cave System',
    'raizing': 'Raizing System',
    '8ing': '8ing System',
    'psikyo': 'Psikyo System',
    'visco': 'Visco System',
    'kaneko': 'Kaneko System',
    'seta': 'Seta System',
    'atlus': 'Atlus System',
    'igs': 'IGS System',
    'comad': 'Comad System',
    'dynax': 'Dynax System',
    'fuuki': 'Fuuki System',
    'gaelco': 'Gaelco System',
    'metro': 'Metro System',
    'mitchell': 'Mitchell System',
    'nmk': 'NMK System',
    'semicom': 'Semicom System',
    'subsino': 'Subsino System',
    'unico': 'Unico System',
    'yunsung': 'Yunsung System'
  };

  // Check if we have a direct mapping
  if (commonMappings[mameName.toLowerCase()]) {
    return commonMappings[mameName.toLowerCase()];
  }

  // Convert MAME name to readable title
  let title = mameName
    // Remove common suffixes
    .replace(/[0-9]+$/, '') // Remove trailing numbers
    .replace(/u$/, '') // Remove 'u' suffix (usually means US version)
    .replace(/j$/, '') // Remove 'j' suffix (usually means Japanese version)
    .replace(/e$/, '') // Remove 'e' suffix (usually means European version)
    .replace(/a$/, '') // Remove 'a' suffix (usually means alternate version)
    .replace(/b$/, '') // Remove 'b' suffix (usually means bootleg)
    .replace(/h$/, '') // Remove 'h' suffix (usually means hack)
    .replace(/x$/, '') // Remove 'x' suffix (usually means extra)
    .replace(/r$/, '') // Remove 'r' suffix (usually means revision)
    .replace(/t$/, '') // Remove 't' suffix (usually means tournament)
    .replace(/w$/, '') // Remove 'w' suffix (usually means world)
    .replace(/k$/, '') // Remove 'k' suffix (usually means Korean version)
    .replace(/c$/, '') // Remove 'c' suffix (usually means Chinese version)
    .replace(/f$/, '') // Remove 'f' suffix (usually means French version)
    .replace(/g$/, '') // Remove 'g' suffix (usually means German version)
    .replace(/i$/, '') // Remove 'i' suffix (usually means Italian version)
    .replace(/s$/, '') // Remove 's' suffix (usually means Spanish version)
    .replace(/pt$/, '') // Remove 'pt' suffix (usually means prototype)
    .replace(/alt$/, '') // Remove 'alt' suffix (usually means alternate)
    .replace(/rev$/, '') // Remove 'rev' suffix (usually means revision)
    .replace(/set$/, '') // Remove 'set' suffix (usually means set)
    .replace(/ver$/, '') // Remove 'ver' suffix (usually means version)
    .replace(/v[0-9]+$/, '') // Remove version numbers like v1, v2, etc.
    .replace(/[0-9]+u$/, '') // Remove numbers with 'u' suffix
    .replace(/[0-9]+j$/, '') // Remove numbers with 'j' suffix
    .replace(/[0-9]+e$/, '') // Remove numbers with 'e' suffix
    .replace(/[0-9]+a$/, '') // Remove numbers with 'a' suffix
    .replace(/[0-9]+b$/, '') // Remove numbers with 'b' suffix
    .replace(/[0-9]+h$/, '') // Remove numbers with 'h' suffix
    .replace(/[0-9]+x$/, '') // Remove numbers with 'x' suffix
    .replace(/[0-9]+r$/, '') // Remove numbers with 'r' suffix
    .replace(/[0-9]+t$/, '') // Remove numbers with 't' suffix
    .replace(/[0-9]+w$/, '') // Remove numbers with 'w' suffix
    .replace(/[0-9]+k$/, '') // Remove numbers with 'k' suffix
    .replace(/[0-9]+c$/, '') // Remove numbers with 'c' suffix
    .replace(/[0-9]+f$/, '') // Remove numbers with 'f' suffix
    .replace(/[0-9]+g$/, '') // Remove numbers with 'g' suffix
    .replace(/[0-9]+i$/, '') // Remove numbers with 'i' suffix
    .replace(/[0-9]+s$/, '') // Remove numbers with 's' suffix
    .replace(/[0-9]+pt$/, '') // Remove numbers with 'pt' suffix
    .replace(/[0-9]+alt$/, '') // Remove numbers with 'alt' suffix
    .replace(/[0-9]+rev$/, '') // Remove numbers with 'rev' suffix
    .replace(/[0-9]+set$/, '') // Remove numbers with 'set' suffix
    .replace(/[0-9]+ver$/, '') // Remove numbers with 'ver' suffix
    // Convert to title case
    .split('')
    .map((char, index) => {
      if (index === 0) return char.toUpperCase();
      if (char === char.toUpperCase() && char.match(/[A-Z]/)) {
        return ' ' + char;
      }
      return char;
    })
    .join('')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  return title || mameName;
}

// Process each MAME game
mameGames.forEach(mameName => {
  // Skip if already in mapping
  if (Object.values(newMapping).some(game => game.mameName === mameName)) {
    return;
  }

  // Create game entry
  const gameTitle = createGameTitle(mameName);
  const logoFile = `${mameName}.png`;

  // Only add if logo file exists
  if (logoFiles.includes(mameName)) {
    newMapping[gameTitle] = {
      logoFile: logoFile,
      mameName: mameName,
      mameTitle: gameTitle
    };
    addedCount++;
  }
});

// Write the updated mapping
fs.writeFileSync('src/data/game-logo-mapping.json', JSON.stringify(newMapping, null, 2));

console.log(`Added ${addedCount} new games to the mapping`);
console.log(`Total games in mapping: ${Object.keys(newMapping).length}`);
console.log(`Total logo files: ${logoFiles.length}`);

// Show some examples of what was added
const newGames = Object.keys(newMapping).filter(key => !currentMapping[key]);
console.log('\nExamples of newly added games:');
newGames.slice(0, 20).forEach(game => {
  console.log(`  ${game} -> ${newMapping[game].mameName}`);
});
