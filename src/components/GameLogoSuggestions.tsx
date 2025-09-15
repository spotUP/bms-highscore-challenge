import { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import gameLogoMapping from "@/data/game-logo-mapping.json";
import misterGames from "@/data/mister-games.json";

interface GameLogoSuggestionsProps {
  gameName: string;
  selectedImageUrl?: string;
  onSelectImage: (imageUrl: string) => void;
}

interface ImageResult {
  url: string;
  alt: string;
}

export interface GameLogoSuggestionsRef {
  searchForLogos: () => void;
}

const GameLogoSuggestions = forwardRef<GameLogoSuggestionsRef, GameLogoSuggestionsProps>(({ gameName, selectedImageUrl, onSelectImage }, ref) => {
  const [suggestions, setSuggestions] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Smart game name normalization for better matching
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
    const variants = [name];
    const normalized = normalizeGameName(name);
    const mameStyle = createMameName(name);

    variants.push(normalized);
    variants.push(mameStyle);

    // Add space-preserved version for human-readable matching
    const spacePreserved = name.toLowerCase().trim()
      .replace(/\s*\([^)]*\)$/g, '')
      .replace(/\s*\[[^\]]*\]$/g, '')
      .replace(/\s*-\s*(us|usa|jp|japan|world|eu|europe)$/gi, '');
    variants.push(spacePreserved);

    // Roman numeral conversions
    const romanToNum = { 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5', 'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10' };

    // Add roman numeral variants to space-preserved version
    Object.entries(romanToNum).forEach(([roman, num]) => {
      if (spacePreserved.includes(` ${roman} `) || spacePreserved.endsWith(` ${roman}`)) {
        const numVariant = spacePreserved.replace(new RegExp(`\\b${roman}\\b`, 'g'), num);
        variants.push(numVariant);
        variants.push(createMameName(numVariant)); // Also add MAME version
      }
      if (spacePreserved.includes(` ${num} `) || spacePreserved.endsWith(` ${num}`)) {
        const romanVariant = spacePreserved.replace(new RegExp(`\\b${num}\\b`, 'g'), roman);
        variants.push(romanVariant);
        variants.push(createMameName(romanVariant)); // Also add MAME version
      }
    });

    // Add common abbreviations and expansions
    const expansions = {
      'sf': 'street fighter',
      'kof': 'king of fighters',
      'mk': 'mortal kombat',
      'ms': 'metal slug',
      'gg': 'guilty gear',
      'mvc': 'marvel vs capcom',
      'pac': 'pacman',
      'pacman': 'pac-man',
      'vs': 'versus',
      'vs.': 'versus',
      'super': 'super',
      'alpha': 'alpha',
      'turbo': 'turbo',
      'championship': 'championship',
      'world': 'world',
      'edition': 'edition',
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

    // Add hyphen/space variations specifically for games like "Pac-Land" vs "Pacland"
    if (name.includes('-') || name.includes(' ')) {
      const noHyphens = name.replace(/-/g, '').toLowerCase();
      const noSpaces = name.replace(/\s+/g, '').toLowerCase();
      const hyphensToSpaces = name.replace(/-/g, ' ').toLowerCase();

      variants.push(noHyphens, noSpaces, hyphensToSpaces);
    }

    return [...new Set(variants)]; // Remove duplicates
  };

  // Calculate similarity score between two strings with advanced scoring
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = normalizeGameName(str1);
    const s2 = normalizeGameName(str2);

    // Exact match gets highest score
    if (s1 === s2) return 100;

    // Prevent very short strings from getting high scores
    if (Math.min(s1.length, s2.length) <= 2) return 0;

    // Check if one contains the other (but penalize if the containing string is much longer)
    if (s1.includes(s2)) {
      const lengthRatio = s2.length / s1.length;
      return Math.max(70, 90 * lengthRatio); // Scale score based on length ratio
    }
    if (s2.includes(s1)) {
      const lengthRatio = s1.length / s2.length;
      return Math.max(70, 90 * lengthRatio);
    }

    // Word-based matching for better accuracy
    const words1 = s1.split(/\s+/).filter(w => w.length > 1);
    const words2 = s2.split(/\s+/).filter(w => w.length > 1);

    if (words1.length > 0 && words2.length > 0) {
      let matchingWords = 0;
      let totalWords = Math.max(words1.length, words2.length);

      words1.forEach(word1 => {
        words2.forEach(word2 => {
          if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
            matchingWords += 1;
          }
        });
      });

      const wordScore = (matchingWords / totalWords) * 85;
      if (wordScore > 60) return wordScore;
    }

    // Levenshtein distance-based scoring with minimum threshold
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 100;

    const distance = levenshteinDistance(s1, s2);
    const similarity = ((maxLen - distance) / maxLen) * 100;

    // Only return significant similarities
    return similarity > 40 ? similarity : 0;
  };

  // Simple Levenshtein distance implementation
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  };

  const searchForLogos = async (showToasts = true) => {
    if (!gameName.trim()) {
      if (showToasts) {
        toast({
          title: "Error",
          description: "Please enter a game name first",
          variant: "destructive"
        });
      }
      return;
    }

    setLoading(true);
    try {
      const supabaseUrl = 'https://tnsgrwntmnzpaifmutqh.supabase.co';
      const searchVariants = createSearchVariants(gameName);

      console.log('Smart search variants:', searchVariants);

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
          const gameTitle_mame = createMameName(gameTitle);

          if (gameMameName === mameVariant || gameTitle_mame === mameVariant) {
            if (!directMameMatches.has(gameTitle)) {
              scoredMatches.push({
                game: [gameTitle, gameData],
                score: 100, // Perfect MAME match
                matchType: 'mame-exact'
              });
              directMameMatches.add(gameTitle);
            }
          }
        });
      });

      // Score all games against all search variants
      allGames.forEach(([gameTitle, gameData]) => {
        // Skip if already found as direct MAME match
        if (directMameMatches.has(gameTitle)) return;

        // Skip games with very short titles (likely data issues)
        if (gameTitle.trim().length <= 2) return;

        const gameVariants = [
          gameTitle,
          gameData.mameName || '',
          gameData.mameTitle || '',
          ...createSearchVariants(gameTitle),
          ...createSearchVariants(gameData.mameName || ''),
          ...createSearchVariants(gameData.mameTitle || '')
        ].filter(Boolean);

        let bestScore = 0;
        let bestMatchType = 'fuzzy';

        searchVariants.forEach(searchVariant => {
          gameVariants.forEach(gameVariant => {
            let score = calculateSimilarity(searchVariant, gameVariant);

            // Boost score for title matches vs MAME name matches
            if (gameVariant === gameTitle && score > 0) {
              score = Math.min(100, score * 1.1); // 10% boost for title matches
            }

            // Boost score for exact word matches in the original (non-normalized) strings
            const originalSearch = gameName.toLowerCase();
            const originalGame = gameTitle.toLowerCase();
            if (originalGame.includes(originalSearch) || originalSearch.includes(originalGame)) {
              score = Math.min(100, score * 1.15); // 15% boost for original string matches
            }

            // Penalize very generic matches
            if (gameVariant.length <= 4 && score < 90) {
              score *= 0.7; // Reduce score for short, non-exact matches
            }

            if (score > bestScore) {
              bestScore = score;
              if (score === 100) bestMatchType = 'exact';
              else if (score >= 90) bestMatchType = 'contains';
              else if (score >= 70) bestMatchType = 'similar';
              else bestMatchType = 'fuzzy';
            }
          });
        });

        if (bestScore >= 60) { // Only include high-quality matches
          scoredMatches.push({
            game: [gameTitle, gameData],
            score: bestScore,
            matchType: bestMatchType
          });
        }
      });

      // Also check MiSTer games database
      misterGames.forEach(misterGame => {
        const logoData = gameLogoMapping[misterGame.name];
        if (logoData) {
          const gameVariants = [misterGame.name, ...createSearchVariants(misterGame.name)];

          let bestScore = 0;
          let bestMatchType = 'fuzzy';

          searchVariants.forEach(searchVariant => {
            gameVariants.forEach(gameVariant => {
              const score = calculateSimilarity(searchVariant, gameVariant);
              if (score > bestScore) {
                bestScore = score;
                if (score === 100) bestMatchType = 'exact';
                else if (score >= 90) bestMatchType = 'contains';
                else if (score >= 70) bestMatchType = 'similar';
                else bestMatchType = 'fuzzy';
              }
            });
          });

          if (bestScore >= 60) {
            // Avoid duplicates
            if (!scoredMatches.some(match => match.game[0] === misterGame.name)) {
              scoredMatches.push({
                game: [misterGame.name, logoData],
                score: bestScore,
                matchType: bestMatchType
              });
            }
          }
        }
      });

      // Sort by score (highest first) and take top 2
      const bestMatches = scoredMatches
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      console.log('Smart search results:', bestMatches.map(m => ({
        name: m.game[0],
        score: m.score,
        type: m.matchType
      })));

      // Convert to image results with Supabase Storage URLs
      const imageResults: ImageResult[] = bestMatches.map(({ game: [gameTitle, gameData] }) => ({
        url: `${supabaseUrl}/storage/v1/object/public/game-logos/${gameData.logoFile}`,
        alt: `${gameTitle} logo`
      }));

      setSuggestions(imageResults);
      
      // Debug logging
      console.log(`Search for "${gameName}":`, {
        searchVariants: searchVariants.slice(0, 3), // Show first 3 variants
        totalMatches: bestMatches.length,
        results: bestMatches.map(m => ({ name: m.game[0], score: m.score, type: m.matchType }))
      });
      
      if (showToasts) {
        if (imageResults.length === 0) {
          toast({
            title: "No Results",
            description: "No logo images found for this game in our database",
          });
        } else {
          toast({
            title: "Found Logos",
            description: `Found ${imageResults.length} logo(s) for "${gameName}"`,
          });
        }
      }
    } catch (error) {
      console.error('Error searching for logos:', error);
      if (showToasts) {
        toast({
          title: "Error",
          description: "Failed to search for logo images",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Live search with debounce when gameName changes
  useEffect(() => {
    // Clear suggestions if game name is empty
    if (!gameName.trim()) {
      setSuggestions([]);
      return;
    }

    // Debounce the search to avoid too many API calls
    const timeoutId = setTimeout(() => {
      searchForLogos(false); // Don't show toasts for automatic searches
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [gameName]);

  // Expose searchForLogos function to parent component (rarely needed now)
  useImperativeHandle(ref, () => ({
    searchForLogos: () => searchForLogos(true) // Manual searches show toasts
  }));

  const handleImageSelect = (imageUrl: string) => {
    onSelectImage(imageUrl);
    toast({
      title: "Success",
      description: "Logo selected successfully",
    });
  };

  return (
    <div className="space-y-4">
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-300">Click on an image to select it:</p>
          <div className="grid grid-cols-2 gap-3">
            {suggestions.map((image, index) => {
              const isSelected = selectedImageUrl === image.url;
              return (
                <Card
                  key={index}
                  className={`bg-black/30 cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'border-arcade-neonCyan border-2 shadow-lg shadow-arcade-neonCyan/20'
                      : 'border-white/20 hover:border-arcade-neonCyan/50'
                  }`}
                  onClick={() => handleImageSelect(image.url)}
                >
                  <CardContent className="p-3">
                    <img
                      src={image.url}
                      alt={image.alt}
                      className="w-full h-20 object-contain rounded bg-white/10"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

GameLogoSuggestions.displayName = 'GameLogoSuggestions';

export default GameLogoSuggestions;