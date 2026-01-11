import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the MiSTer games list
const misterGames = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/mister-games.json'), 'utf8'));

// Get all PNG files from the game-logos directory
const logosDir = path.join(__dirname, '../public/game-logos');
const logoFiles = fs.readdirSync(logosDir).filter(file => file.endsWith('.png'));

console.log(`Found ${logoFiles.length} logo files`);
console.log(`Found ${misterGames.length} MiSTer games`);

// Fetch the official MAME names XML
console.log('Fetching official MAME names from RetroPie...');
const mameNamesResponse = await fetch('https://raw.githubusercontent.com/RetroPie/EmulationStation/master/resources/mamenames.xml');
const mameNamesXml = await mameNamesResponse.text();

// Parse the XML to extract MAME name mappings
const mameMappings = {};
const gameEntries = mameNamesXml.match(/<game>[\s\S]*?<\/game>/g);

if (gameEntries) {
  gameEntries.forEach(entry => {
    const mameNameMatch = entry.match(/<mamename>([^<]+)<\/mamename>/);
    const realNameMatch = entry.match(/<realname>([^<]+)<\/realname>/);
    
    if (mameNameMatch && realNameMatch) {
      const mameName = mameNameMatch[1].trim();
      const gameTitle = realNameMatch[1].trim();
      mameMappings[mameName] = gameTitle;
    }
  });
}

console.log(`Parsed ${Object.keys(mameMappings).length} MAME name mappings`);

// Create a mapping from game name to logo file
const gameLogoMapping = {};

// For each MiSTer game, try to find a matching logo using the official MAME names
misterGames.forEach(game => {
  const gameName = game.name.toLowerCase();
  
  // Try to find a MAME name that maps to this game
  const matchingMameName = Object.entries(mameMappings).find(([mameName, mameTitle]) => {
    const mameTitleLower = mameTitle.toLowerCase();
    
    // Direct match
    if (mameTitleLower === gameName) {
      return true;
    }
    
    // Check if the game name is contained in the MAME title or vice versa
    if (mameTitleLower.includes(gameName) || gameName.includes(mameTitleLower)) {
      return true;
    }
    
    // Special cases for common variations
    const specialCases = {
      'pacman': ['pac-man', 'pac man'],
      'donkey kong': ['donkey kong'],
      'space invaders': ['space invaders'],
      'galaga': ['galaga'],
      'centipede': ['centipede'],
      'frogger': ['frogger'],
      'dig dug': ['dig dug'],
      'qbert': ['q*bert', 'qbert'],
      'tetris': ['tetris'],
      'asteroids': ['asteroids'],
      'defender': ['defender'],
      'tempest': ['tempest'],
      'robotron': ['robotron'],
      'joust': ['joust'],
      'bubble bobble': ['bubble bobble'],
      'street fighter': ['street fighter'],
      'mortal kombat': ['mortal kombat'],
      'tekken': ['tekken'],
      'king of fighters': ['king of fighters'],
      'metal slug': ['metal slug'],
      'samurai shodown': ['samurai shodown', 'samurai showdown']
    };
    
    for (const [gameKey, variations] of Object.entries(specialCases)) {
      if (gameName.includes(gameKey)) {
        for (const variation of variations) {
          if (mameTitleLower.includes(variation)) {
            return true;
          }
        }
      }
    }
    
    return false;
  });
  
  if (matchingMameName) {
    const [mameName, mameTitle] = matchingMameName;
    const logoFile = `${mameName}.png`;
    
    // Check if the logo file actually exists
    if (logoFiles.includes(logoFile)) {
      gameLogoMapping[game.name] = {
        logoFile: logoFile,
        mameName: mameName,
        mameTitle: mameTitle
      };
    }
  }
});

console.log(`Created ${Object.keys(gameLogoMapping).length} mappings using official MAME names`);

// Save the mapping
fs.writeFileSync(
  path.join(__dirname, '../src/data/game-logo-mapping.json'),
  JSON.stringify(gameLogoMapping, null, 2)
);

console.log('Game logo mapping saved to src/data/game-logo-mapping.json');

// Show some examples
const examples = Object.entries(gameLogoMapping).slice(0, 15);
console.log('\nExample mappings:');
examples.forEach(([gameName, data]) => {
  console.log(`${gameName} -> ${data.mameName} (${data.mameTitle}) -> ${data.logoFile}`);
});

// Show statistics
const totalMappings = Object.keys(gameLogoMapping).length;
const percentage = ((totalMappings / misterGames.length) * 100).toFixed(1);
console.log(`\nStatistics:`);
console.log(`- Total MiSTer games: ${misterGames.length}`);
console.log(`- Games with local logos: ${totalMappings}`);
console.log(`- Coverage: ${percentage}%`);
