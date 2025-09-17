import gameLogoMapping from "@/data/game-logo-mapping.json";

interface LogoSearchResult {
  url: string;
  alt: string;
  score: number;
}

// Smart game name normalization for better matching (copied from GameLogoSuggestions)
const normalizeGameName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    // Remove common arcade suffixes and parenthetical content
    .replace(/\s*\([^)]*\)$/g, '') // Remove (US), (Japan), (Set 1), etc.
    .replace(/\s*\[[^\]]*\]$/g, '') // Remove [Region] markers
    .replace(/\s*-\s*(us|usa|jp|japan|world|eu|europe)$/gi, '') // Remove region suffixes
    .replace(/\s*:\s*the\s+/gi, ': ') // Normalize "The" articles
    .replace(/[-_\s]+/g, '') // Remove hyphens, underscores, and spaces for MAME-style matching
    .trim();
};

// Create MAME-style compressed name (removes spaces, hyphens, etc.)
const createMameName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
    .trim();
};

// Convert roman numerals to numbers and vice versa for better matching
const createSearchVariants = (name: string): string[] => {
  const variants = [name.toLowerCase().trim()];
  const spacePreserved = name.toLowerCase().trim();

  // Add the normalized version
  variants.push(normalizeGameName(name));

  // Add MAME-style name
  variants.push(createMameName(name));

  // Roman numeral conversions
  const romanMap = {
    ' i ': ' 1 ', ' ii ': ' 2 ', ' iii ': ' 3 ', ' iv ': ' 4 ', ' v ': ' 5 ',
    ' vi ': ' 6 ', ' vii ': ' 7 ', ' viii ': ' 8 ', ' ix ': ' 9 ', ' x ': ' 10 '
  };

  Object.entries(romanMap).forEach(([roman, number]) => {
    if (spacePreserved.includes(roman)) {
      const numberVariant = spacePreserved.replace(roman, number);
      variants.push(numberVariant);
      variants.push(createMameName(numberVariant));
    }
    if (spacePreserved.includes(number)) {
      const romanVariant = spacePreserved.replace(number, roman);
      variants.push(romanVariant);
      variants.push(createMameName(romanVariant));
    }
  });

  // Common abbreviations
  const expansions = {
    'sf': 'street fighter',
    'kof': 'king of fighters',
    'mk': 'mortal kombat',
    'ms': 'metal slug',
    'ff': 'final fight',
    'ex': 'ex',
    'plus': 'plus',
    'special': 'special',
    'hyper': 'hyper',
    'ultra': 'ultra',
    'arcade': 'arcade',
    'deluxe': 'deluxe'
  };

  Object.entries(expansions).forEach(([abbrev, full]) => {
    if (spacePreserved.includes(abbrev)) {
      const expandedVariant = spacePreserved.replace(abbrev, full);
      variants.push(expandedVariant);
      variants.push(createMameName(expandedVariant));
    }
    if (spacePreserved.includes(full)) {
      const abbreviatedVariant = spacePreserved.replace(full, abbrev);
      variants.push(abbreviatedVariant);
      variants.push(createMameName(abbreviatedVariant));
    }
  });

  // Add hyphen/space variations
  if (name.includes('-') || name.includes(' ')) {
    const noHyphens = name.replace(/-/g, '').toLowerCase();
    const noSpaces = name.replace(/\s+/g, '').toLowerCase();
    const hyphensToSpaces = name.replace(/-/g, ' ').toLowerCase();

    variants.push(noHyphens, noSpaces, hyphensToSpaces);
  }

  return [...new Set(variants)]; // Remove duplicates
};

// Calculate similarity score between two strings
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = normalizeGameName(str1);
  const s2 = normalizeGameName(str2);

  // Exact match gets highest score
  if (s1 === s2) return 100;

  // Prevent very short strings from getting high scores
  if (Math.min(s1.length, s2.length) <= 2) return 0;

  // Check if one contains the other
  if (s1.includes(s2)) {
    const lengthRatio = s2.length / s1.length;
    return Math.max(70, 90 * lengthRatio);
  }
  if (s2.includes(s1)) {
    const lengthRatio = s1.length / s2.length;
    return Math.max(70, 90 * lengthRatio);
  }

  // Levenshtein distance for similarity
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  return Math.max(0, similarity);
};

// Simple Levenshtein distance calculation
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
};

/**
 * Search for clear logos for arcade games
 * @param gameName - The name of the game to search for
 * @returns Promise<string | null> - The URL of the best logo match, or null if none found
 */
export const searchArcadeGameLogo = async (gameName: string): Promise<string | null> => {
  if (!gameName.trim()) {
    return null;
  }

  try {
    const supabaseUrl = 'https://tnsgrwntmnzpaifmutqh.supabase.co';
    const searchVariants = createSearchVariants(gameName);
    console.log('Searching arcade logo for:', gameName, 'variants:', searchVariants);

    // Create scored matches from all available games
    const allGames = Object.entries(gameLogoMapping);
    const scoredMatches: Array<{ game: [string, any], score: number, matchType: string }> = [];

    // First, try direct MAME name lookups for exact matches
    const directMameMatches = new Set<string>();
    searchVariants.forEach(variant => {
      const mameVariant = createMameName(variant);

      // Direct lookup by MAME name in the mapping
      allGames.forEach(([gameTitle, gameData]) => {
        const gameMameName = createMameName(gameData.mameName || '');

        if (gameMameName && mameVariant === gameMameName) {
          if (!directMameMatches.has(gameTitle)) {
            scoredMatches.push({
              game: [gameTitle, gameData],
              score: 100, // Perfect MAME match
              matchType: 'mame'
            });
            directMameMatches.add(gameTitle);
          }
        }
      });
    });

    // If no direct MAME matches, do fuzzy matching on game titles
    if (scoredMatches.length === 0) {
      allGames.forEach(([gameTitle, gameData]) => {
        let bestScore = 0;
        let bestMatchType = 'fuzzy';

        searchVariants.forEach(variant => {
          const score = calculateSimilarity(variant, gameTitle);
          if (score > bestScore && score >= 60) { // Minimum similarity threshold
            bestScore = score;
          }
        });

        if (bestScore > 0) {
          scoredMatches.push({
            game: [gameTitle, gameData],
            score: bestScore,
            matchType: bestMatchType
          });
        }
      });
    }

    // Sort by score (highest first)
    scoredMatches.sort((a, b) => b.score - a.score);

    // Take the best match
    if (scoredMatches.length > 0) {
      const bestMatch = scoredMatches[0];
      const [gameTitle, gameData] = bestMatch.game;

      console.log('Best logo match:', gameTitle, 'score:', bestMatch.score, 'type:', bestMatch.matchType);

      // Return the logo URL
      if (gameData.logoUrl) {
        return `${supabaseUrl}/storage/v1/object/public/game-images/${gameData.logoUrl}`;
      }
    }

    console.log('No suitable logo found for:', gameName);
    return null;
  } catch (error) {
    console.error('Error searching for arcade logo:', error);
    return null;
  }
};

/**
 * Check if a game is an arcade game based on its platforms
 * @param platforms - Array of platform objects from RAWG
 * @returns boolean - True if the game has Arcade as one of its platforms
 */
export const isArcadeGame = (platforms: Array<{ platform: { id: number; name: string; slug: string } }>): boolean => {
  return platforms.some(p => p.platform.id === 79 || p.platform.name.toLowerCase().includes('arcade'));
};