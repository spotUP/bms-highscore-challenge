import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Search, Filter, Star, Users, Calendar, Gamepad2, Shuffle, Plus, Info, Heart, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { GameDetailsModal } from "@/components/GameDetailsModal";
import { GameRatingDisplay } from "@/components/GameRatingDisplay";
import { ratingAggregationService } from "@/services/ratingAggregationService";
import { CreateTournamentModal } from "@/components/CreateTournamentModal";
import { useGameDatabaseFavorites } from "@/hooks/useGameDatabaseFavorites";
import { sqliteService } from "@/services/sqliteService";
import { clearLogoService } from "@/services/clearLogoService";
import { AutocompleteDropdown } from "@/components/ui/autocomplete-dropdown";

// Utility function to decode HTML entities
const decodeHtmlEntities = (text: string): string => {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
};

// Levenshtein distance function for fuzzy matching
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = [];

  // Create empty matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
};

// Function to generate fuzzy variations based on edit distance
const generateFuzzyVariations = (searchTerm: string): string[] => {
  const commonGameWords = [
    'mario', 'sonic', 'zelda', 'pokemon', 'street', 'fighter', 'final', 'fantasy',
    'dragon', 'quest', 'mortal', 'kombat', 'super', 'mega', 'ultra', 'turbo',
    'world', 'land', 'adventure', 'legends', 'chronicles', 'saga', 'tales'
  ];

  const variations: string[] = [];
  const words = searchTerm.toLowerCase().split(/\s+/);

  words.forEach(word => {
    if (word.length >= 4) { // Only apply fuzzy matching to words 4+ chars
      commonGameWords.forEach(gameWord => {
        const distance = levenshteinDistance(word, gameWord);
        // Allow 1-2 character differences based on word length
        const threshold = word.length <= 5 ? 1 : 2;

        if (distance <= threshold && distance > 0) {
          // Replace the word with the close match
          const newTerm = searchTerm.replace(new RegExp(`\\b${word}\\b`, 'gi'), gameWord);
          if (newTerm !== searchTerm) {
            variations.push(newTerm);
          }
        }
      });
    }
  });

  return variations;
};

interface Game {
  id: number;
  name: string;
  platform_name: string;
  logo_base64: string | null;
  launchbox_id: number | null;
  created_at: string;
  updated_at: string;
  aggregatedRating?: number; // For client-side sorting by external API ratings
}

interface Platform {
  id: string;
  name: string;
  category: string | null;
}

interface FilterState {
  search: string;
  platform: string;
  genre: string;
  yearRange: [number, number];
  minPlayers: number;
  minRating: number;
  esrbRating: string;
  cooperative: string;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
}

const GamesBrowser: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [games, setGames] = useState<Game[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  // Use Supabase for favorites instead of localStorage
  const { favoriteGameIds, favoriteGamesDetails, toggleFavorite: toggleFavoriteInDB, isFavorited } = useGameDatabaseFavorites();
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [totalGames, setTotalGames] = useState(0);
  const [selectedGameForModal, setSelectedGameForModal] = useState<Game | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<'all' | 'favorites'>('all');
  const [searchInput, setSearchInput] = useState(''); // Separate state for input field
  const [favoritesSortBy, setFavoritesSortBy] = useState('name');
  const [favoritesSortDirection, setFavoritesSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pulsingHearts, setPulsingHearts] = useState<Set<string>>(new Set());
  const [sqliteLogos, setSqliteLogos] = useState<Record<string, string>>({});

  // Search suggestions state
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    platform: 'all',
    genre: 'all',
    yearRange: [1970, 2024],
    minPlayers: 1,
    minRating: 0,
    esrbRating: 'all',
    cooperative: 'all',
    sortBy: 'name',
    sortDirection: 'asc'
  });

  const [hasMoreGames, setHasMoreGames] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const gamesPerPage = 20; // Load 20 games per batch

  // Extract unique values for filters - load these separately for better performance
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [allESRBRatings, setAllESRBRatings] = useState<string[]>([]);

  // Server-side pagination
  // Remove totalPages calculation - not needed for infinite scroll

  // Load filter options - only from approved platforms
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        // Wait for platforms to be loaded first
        if (platforms.length === 0) return;

        const approvedPlatformNames = platforms.map(p => p.name);

        // Load unique genres only from approved platform games
        const { data: genresData } = await supabase
          .from('games_database')
          .select('genres')
          .not('genres', 'is', null)
          .in('platform_name', approvedPlatformNames);

        if (genresData) {
          const genreSet = new Set<string>();
          genresData.forEach(row => {
            row.genres?.forEach((genre: string) => genreSet.add(genre));
          });
          setAllGenres(Array.from(genreSet).sort());
        }

        // Load unique ESRB ratings only from approved platform games
        const { data: ratingsData } = await supabase
          .from('games_database')
          .select('esrb_rating')
          .not('esrb_rating', 'is', null)
          .in('platform_name', approvedPlatformNames);

        if (ratingsData) {
          const ratingSet = new Set<string>();
          ratingsData.forEach(row => {
            if (row.esrb_rating) ratingSet.add(row.esrb_rating);
          });
          setAllESRBRatings(Array.from(ratingSet).sort());
        }
      } catch (error) {
        console.error('Error loading filter options:', error);
      }
    };

    loadFilterOptions();
  }, [platforms]); // Depend on platforms being loaded

  // Memoized image error handler to prevent infinite re-renders
  const handleImageError = useCallback((gameId: string) => {
    setFailedImages(prev => {
      if (prev.has(gameId)) return prev;
      return new Set([...prev, gameId]);
    });
  }, []);

  useEffect(() => {
    loadPlatforms();
  }, []);

  // Load games when filters change - reset games list for new filters
  useEffect(() => {
    setGames([]);
    setHasMoreGames(true);
    loadGames(true); // true = reset games list
  }, [filters]);

  // Load SQLite logos when games change - DISABLED for performance
  // Individual images now load on-demand via lazy loading
  // useEffect(() => {
  //   const loadSQLiteLogos = async () => {
  //     if (games.length === 0) return;

  //     console.log('Loading SQLite logos for games:', games.map(game => game.name));

  //     try {
  //       const gameNames = games.map(game => game.name);
  //       const logoMap = await clearLogoService.getClearLogosForGames(gameNames);
  //       console.log('Clear Logo logos loaded:', Object.keys(logoMap));
  //       setSqliteLogos(logoMap);
  //     } catch (error) {
  //       console.warn('Failed to load Clear Logo logos:', error);
  //     }
  //   };

  //   loadSQLiteLogos();
  // }, [games]);

  // Handle search on Enter key
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setFilters(prev => ({
        ...prev,
        search: searchInput
      }));
      setCurrentPage(1); // Reset to first page for new search
    }
  };

  // Handle clearing search
  const handleClearSearch = () => {
    setSearchInput('');
    setFilters(prev => ({
      ...prev,
      search: ''
    }));
    setShowSuggestions(false);
  };

  // Fetch search suggestions
  const fetchSearchSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSuggestionLoading(true);
    try {
      const { data: suggestions, error } = await supabase
        .from('games_database')
        .select('name')
        .ilike('name', `%${query}%`)
        .limit(8)
        .order('name');

      if (error) throw error;

      const suggestionNames = suggestions
        ?.map(game => game.name)
        .filter((name, index, arr) => arr.indexOf(name) === index) // Remove duplicates
        .slice(0, 6) || []; // Limit to 6 suggestions

      setSearchSuggestions(suggestionNames);
      setShowSuggestions(suggestionNames.length > 0);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSearchSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setSuggestionLoading(false);
    }
  };

  // Handle input change with debouncing for suggestions
  const handleSearchInputChange = (value: string) => {
    setSearchInput(value);

    // Debounce suggestion fetching
    const timeoutId = setTimeout(() => {
      fetchSearchSuggestions(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    setSearchInput(suggestion);
    setFilters(prev => ({
      ...prev,
      search: suggestion
    }));
    setShowSuggestions(false);
  };

  const loadGames = async (resetGames = false) => {
    // If loading more games, use different loading state
    if (resetGames) {
      // Use searchLoading for search operations, loading for initial load
      if (filters.search || filters.platform !== 'all' || filters.yearRange[0] > 1970 || filters.yearRange[1] < 2024) {
        setSearchLoading(true);
      } else {
        setLoading(true);
      }
    } else {
      setIsLoadingMore(true);
    }

    try {
      // Get approved platform names for filtering
      const approvedPlatformNames = platforms.map(p => p.name);

      let query = supabase
        .from('games_database')
        .select(`
          id,
          name,
          platform_name,
          logo_base64,
          launchbox_id,
          created_at,
          updated_at
        `); // Only selecting fields that actually exist in games_database table

      // ALWAYS filter by approved platforms to prevent excluded platforms from showing
      if (approvedPlatformNames.length > 0) {
        query = query.in('platform_name', approvedPlatformNames);
      }

      // Apply search filter - enhanced fuzzy matching to handle punctuation, spaces, and character variations
      if (filters.search && filters.search.length >= 3) {
        const searchTerm = filters.search.toLowerCase().trim();

        // Create variations to handle common issues
        const searchVariations = [searchTerm];

        // Remove all punctuation and normalize spaces for fuzzy matching
        const normalizedTerm = searchTerm
          .replace(/[^\w\s]/g, '') // Remove all punctuation
          .replace(/\s+/g, ' ')    // Normalize multiple spaces to single space
          .trim();

        if (normalizedTerm !== searchTerm) {
          searchVariations.push(normalizedTerm);
        }

        // Enhanced apostrophe handling for cases like "hammerin harry" vs "hammerin' harry"
        if (searchTerm.includes("'")) {
          // If search has apostrophes, also try without them
          searchVariations.push(searchTerm.replace(/['']/g, ''));
          searchVariations.push(searchTerm.replace(/['']/g, ' '));
        } else {
          // If search has no apostrophes, try adding them in common positions
          // For "hammerin harry" -> "hammerin' harry"
          const withApostrophe = searchTerm.replace(/(\w+)in\s/g, "$1in' ");
          if (withApostrophe !== searchTerm) {
            searchVariations.push(withApostrophe);
          }

          // For "solomons key" -> "solomon's key"
          const withPossessive = searchTerm.replace(/(\w)s\s/g, "$1's ");
          if (withPossessive !== searchTerm) {
            searchVariations.push(withPossessive);
          }

          // Generic pattern: try adding apostrophes before common endings
          const commonEndings = ['in', 'n', 'er', 'ed', 'ly'];
          commonEndings.forEach(ending => {
            const pattern = new RegExp(`(\\w+)${ending}\\s`, 'g');
            const withApos = searchTerm.replace(pattern, `$1${ending}' `);
            if (withApos !== searchTerm) {
              searchVariations.push(withApos);
            }
          });

          // Special handling for "n" vs "'n" patterns like "ghost n goblins" vs "ghosts 'n goblins"
          if (searchTerm.includes(' n ')) {
            searchVariations.push(searchTerm.replace(/\s+n\s+/g, " 'n "));
            searchVariations.push(searchTerm.replace(/\s+n\s+/g, " & "));
            searchVariations.push(searchTerm.replace(/\s+n\s+/g, " and "));
          }
        }

        // Handle singular/plural variations
        const words = searchTerm.split(/\s+/);
        const pluralVariations = [];
        const singularVariations = [];

        words.forEach(word => {
          if (word.length > 3) {
            // Try plural forms
            if (!word.endsWith('s')) {
              pluralVariations.push(word + 's');
            }
            // Try singular forms
            if (word.endsWith('s') && word.length > 4) {
              singularVariations.push(word.slice(0, -1));
            }
          }
        });

        // Create variations with plural/singular substitutions
        if (pluralVariations.length > 0) {
          words.forEach((word, index) => {
            if (pluralVariations.includes(word + 's')) {
              const newWords = [...words];
              newWords[index] = word + 's';
              searchVariations.push(newWords.join(' '));
            }
          });
        }

        if (singularVariations.length > 0) {
          words.forEach((word, index) => {
            if (word.endsWith('s') && singularVariations.includes(word.slice(0, -1))) {
              const newWords = [...words];
              newWords[index] = word.slice(0, -1);
              searchVariations.push(newWords.join(' '));
            }
          });
        }

        // Add variations with common word concatenations
        // "dragon ninja" -> "dragonninja"
        const concatenated = searchTerm.replace(/\s+/g, '');
        if (concatenated !== searchTerm && concatenated.length >= 3) {
          searchVariations.push(concatenated);
        }

        // Add specific variations for common game naming patterns
        // "vs dragon ninja" -> "vs. dragonninja" and vice versa
        if (searchTerm.includes('vs') || searchTerm.includes('dragon ninja')) {
          const vsVariations = [
            searchTerm.replace(/\bvs\b/g, 'vs.'),
            searchTerm.replace(/\bvs\.\b/g, 'vs'),
            searchTerm.replace(/dragon ninja/g, 'dragonninja'),
            searchTerm.replace(/dragonninja/g, 'dragon ninja'),
          ];

          vsVariations.forEach(variation => {
            if (variation !== searchTerm) {
              searchVariations.push(variation);
            }
          });
        }

        // Add variations with spaces added between words for compound games
        if (!searchTerm.includes(' ') && searchTerm.length > 6) {
          // Try to split common compound words
          const commonSplits = [
            { from: 'vs', to: ' vs ' },
            { from: 'ninja', to: ' ninja' },
            { from: 'dragon', to: 'dragon ' },
            { from: 'dudes', to: 'dudes ' },
            { from: 'quest', to: ' quest' },
            { from: 'force', to: ' force' },
            { from: 'world', to: ' world' },
          ];

          for (const split of commonSplits) {
            if (searchTerm.includes(split.from)) {
              const splitTerm = searchTerm.replace(split.from, split.to).replace(/\s+/g, ' ').trim();
              if (splitTerm !== searchTerm) {
                searchVariations.push(splitTerm);
              }
            }
          }
        }

        // Add word order variations for multi-word searches
        if (words.length === 2) {
          // For "harry hammerin" -> also try "hammerin harry"
          const reversed = [...words].reverse().join(' ');
          if (reversed !== searchTerm) {
            searchVariations.push(reversed);

            // Also add apostrophe variations of the reversed order
            const reversedWithApos = reversed.replace(/(\w+)in\s/g, "$1in' ");
            if (reversedWithApos !== reversed) {
              searchVariations.push(reversedWithApos);
            }
          }
        } else if (words.length > 2) {
          // For longer phrases, try common reorderings
          // "street fighter alpha" -> "alpha street fighter", "fighter street alpha"
          const firstLast = [words[0], words[words.length - 1]].join(' ');
          const lastFirst = [words[words.length - 1], words[0]].join(' ');
          searchVariations.push(firstLast, lastFirst);
        }

        // Add partial word matching for names with common prefixes/suffixes
        if (searchTerm.length >= 5) {
          // For searches like "street fight" -> also try "street fighter"
          const withCommonSuffixes = [
            searchTerm + 'er',
            searchTerm + 'ers',
            searchTerm + 'ing',
            searchTerm.replace(/\s+/g, '') + 'er',
          ];
          searchVariations.push(...withCommonSuffixes);

          // For searches ending in common suffixes, try without them
          if (searchTerm.endsWith('er')) {
            searchVariations.push(searchTerm.slice(0, -2));
          }
          if (searchTerm.endsWith('ers')) {
            searchVariations.push(searchTerm.slice(0, -3));
          }
        }

        // Handle common game title patterns and abbreviations
        const gamePatterns = [
          // Numbers and Roman numerals
          { from: /\b2\b/g, to: ['II', 'Two'] },
          { from: /\b3\b/g, to: ['III', 'Three'] },
          { from: /\b4\b/g, to: ['IV', 'Four'] },
          { from: /\bII\b/g, to: ['2', 'Two'] },
          { from: /\bIII\b/g, to: ['3', 'Three'] },
          { from: /\bIV\b/g, to: ['4', 'Four'] },

          // Common game abbreviations
          { from: /\bst\b/gi, to: ['street'] },
          { from: /\bstreet\b/gi, to: ['st'] },
          { from: /\bmk\b/gi, to: ['mortal kombat'] },
          { from: /\bmortal kombat\b/gi, to: ['mk'] },
          { from: /\bsf\b/gi, to: ['street fighter'] },
          { from: /\bstreet fighter\b/gi, to: ['sf'] },

          // Common word substitutions
          { from: /\bvs\b/gi, to: ['versus', 'v'] },
          { from: /\bversus\b/gi, to: ['vs', 'v'] },
          { from: /\band\b/gi, to: ['&', 'n'] },
          { from: /\bthe\b/gi, to: [''] }, // Try without "the"
        ];

        gamePatterns.forEach(pattern => {
          if (pattern.from.test(searchTerm)) {
            pattern.to.forEach(replacement => {
              const variation = searchTerm.replace(pattern.from, replacement).replace(/\s+/g, ' ').trim();
              if (variation && variation !== searchTerm) {
                searchVariations.push(variation);
              }
            });
          }
        });

        // Handle typos and common misspellings for popular games
        const commonTypos = {
          'mario': ['mario', 'mario'],
          'sonic': ['sanic', 'sonik'],
          'zelda': ['zelda', 'zeld'],
          'pokemon': ['pokemon', 'pokeman'],
          'final fantasy': ['final fantasy', 'final fantasi'],
          'street fighter': ['street fighter', 'street figher'],
          'mortal kombat': ['mortal kombat', 'mortal combat'],
        };

        Object.entries(commonTypos).forEach(([correct, variants]) => {
          variants.forEach(variant => {
            if (searchTerm.includes(variant) && !searchTerm.includes(correct)) {
              searchVariations.push(searchTerm.replace(variant, correct));
            }
            if (searchTerm.includes(correct) && !searchTerm.includes(variant)) {
              searchVariations.push(searchTerm.replace(correct, variant));
            }
          });
        });

        // Add fuzzy string matching variations
        const fuzzyVariations = generateFuzzyVariations(searchTerm);
        searchVariations.push(...fuzzyVariations);

        // Apply apostrophe variations to ALL generated variations (including plurals)
        const allVariations = [...searchVariations];
        searchVariations.forEach(variation => {
          if (!variation.includes("'") && variation.includes(' n ')) {
            allVariations.push(variation.replace(/\s+n\s+/g, " 'n "));
            allVariations.push(variation.replace(/\s+n\s+/g, " & "));
            allVariations.push(variation.replace(/\s+n\s+/g, " and "));
          }
        });

        // Remove duplicates and create OR conditions with relevance scoring
        const uniqueVariations = [...new Set(allVariations)];

        // Create weighted search conditions based on match quality
        const exactMatchCondition = `name.ilike.${searchTerm}`;
        const startsWithCondition = `name.ilike.${searchTerm}%`;
        const containsCondition = uniqueVariations.map(term => `name.ilike.%${term}%`).join(',');

        // Use a more sophisticated OR query that prioritizes exact matches
        query = query.or(`${exactMatchCondition},${startsWithCondition},${containsCondition}`);
      }

      // Apply platform filter
      if (filters.platform !== 'all') {
        query = query.eq('platform_name', filters.platform);
      }

      // Apply year filter
      if (filters.yearRange[0] > 1970 || filters.yearRange[1] < 2024) {
        query = query.gte('release_year', filters.yearRange[0]).lte('release_year', filters.yearRange[1]);
      }

      // Apply minimum community rating filter
      if (filters.minRating > 0) {
        query = query.gte('community_rating', filters.minRating);
      }

      // Special case: Show interesting arcade games when no actual filters are applied
      // (but still allow sorting of featured games)
      const hasActualFilters = filters.search ||
                              filters.platform !== 'all' ||
                              filters.yearRange[0] > 1970 ||
                              filters.yearRange[1] < 2024 ||
                              filters.genre !== 'all' ||
                              filters.minRating > 0 ||
                              filters.esrbRating !== 'all' ||
                              filters.cooperative !== 'all';

      if (!hasActualFilters) {
        // For infinite random games, don't use the get_random_games RPC
        // Instead, let the normal pagination work with random ordering
        // This ensures truly infinite scroll without limits
        console.log('Loading random games with infinite scroll - no special filtering needed');
      }

      // Apply pagination for infinite scroll - works for both filtered and random games
      const startIndex = resetGames ? 0 : games.length;
      query = query.range(startIndex, startIndex + gamesPerPage - 1);

      // Apply sorting
      let orderColumn = 'name';
      let ascending = filters.sortDirection === 'asc';

      // For random games (no filters), use a time-based seed for consistent pagination
      if (!hasActualFilters) {
        // Use a combination of fields that creates pseudo-random but consistent ordering
        // This allows pagination while still feeling random
        orderColumn = 'name'; // We'll actually modify the query to use a custom ordering
        ascending = true;
      }

      switch (filters.sortBy) {
        case 'rating':
          orderColumn = 'community_rating';
          // For rating, reverse the logic: asc = high to low, desc = low to high
          ascending = filters.sortDirection === 'asc' ? false : true;
          break;
        case 'year':
          orderColumn = 'release_year';
          break;
        case 'players':
          orderColumn = 'max_players';
          break;
        case 'platform':
          orderColumn = 'platform_name';
          break;
        case 'newest':
          orderColumn = 'created_at';
          // For newest, reverse the logic: asc = newest first (desc), desc = oldest first (asc)
          ascending = filters.sortDirection === 'asc' ? false : true;
          break;
        default: // name
          orderColumn = 'name';
      }

      // Apply sorting - skip database sorting for ratings (we'll do client-side)
      // For featured games (no filters), use random ordering for variety on each page load
      if (!hasActualFilters) {
        // Use random ordering for featured games to show different games each time
        query = query.order('id'); // Use stable ordering first
      } else if (filters.sortBy !== 'rating') {
        query = query.order(orderColumn, { ascending });
      } else {
        // For rating sort, just filter out null ratings for better performance
        query = query.not('community_rating', 'is', null);
      }

      const { data: gamesData, error: gamesError } = await query;

      if (gamesError) throw gamesError;

      // Use the games data directly since randomization is now handled at query level
      let finalGamesData = gamesData || [];

      // Handle client-side rating sorting with external API data
      if (filters.sortBy === 'rating' && finalGamesData.length > 0) {
        console.log('Fetching aggregated ratings for', finalGamesData.length, 'games...');

        // Fetch aggregated ratings for all games in parallel
        const ratingPromises = finalGamesData.map(async (game) => {
          try {
            const gameRatings = await ratingAggregationService.getCachedGameRatings(
              game.name,
              game.platform_name,
              game.community_rating && game.community_rating_count ? {
                rating: game.community_rating,
                count: game.community_rating_count
              } : undefined
            );
            return {
              ...game,
              aggregatedRating: gameRatings.aggregated.averageRating
            };
          } catch (error) {
            console.error('Error fetching rating for', game.name, ':', error);
            return {
              ...game,
              aggregatedRating: game.community_rating || 0
            };
          }
        });

        try {
          const gamesWithRatings = await Promise.all(ratingPromises);

          // Sort by aggregated ratings
          gamesWithRatings.sort((a, b) => {
            const aRating = a.aggregatedRating || 0;
            const bRating = b.aggregatedRating || 0;

            // For rating: asc = high to low, desc = low to high
            return filters.sortDirection === 'asc' ? bRating - aRating : aRating - bRating;
          });

          finalGamesData = gamesWithRatings;
          console.log('Sorted by aggregated ratings:', finalGamesData.slice(0, 5).map(g => ({
            name: g.name,
            rating: g.aggregatedRating
          })));
        } catch (error) {
          console.error('Error sorting by aggregated ratings:', error);
          // Fall back to original data if rating fetch fails
        }
      }

      // Update games list - append or replace based on resetGames
      if (resetGames) {
        setGames(finalGamesData);
      } else {
        setGames(prev => [...prev, ...finalGamesData]);
      }

      // Update hasMoreGames based on returned data
      // For filtered searches, stop when we get fewer than requested
      // For random games (no filters), keep going indefinitely
      if (hasActualFilters) {
        setHasMoreGames(finalGamesData.length === gamesPerPage);
      } else {
        // For random games, always assume there are more games available
        // Only stop if we get no games at all (which shouldn't happen with a large database)
        setHasMoreGames(finalGamesData.length > 0);
      }

      // Set approximate total for display
      setTotalGames(prev => resetGames ? finalGamesData.length : prev + finalGamesData.length);
    } catch (error) {
      console.error('Error loading games:', error);
      toast({
        title: "Error",
        description: "Failed to load games data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setSearchLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Infinite scroll implementation
  const loadMoreGames = useCallback(() => {
    if (!isLoadingMore && hasMoreGames) {
      loadGames(false); // false = append to existing games
    }
  }, [isLoadingMore, hasMoreGames, loadGames]);

  // Intersection observer for infinite scroll
  const lastGameRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoadingMore) return;
    if (!node) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMoreGames) {
        loadMoreGames();
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [isLoadingMore, hasMoreGames, loadMoreGames]);

  const loadPlatforms = async () => {
    try {
      const { data: platformsData, error: platformsError } = await supabase
        .from('platforms')
        .select('*')
        .order('name');

      if (platformsError) throw platformsError;
      setPlatforms(platformsData || []);
    } catch (error) {
      console.error('Error loading platforms:', error);
    }
  };

  const clearFilters = useCallback(() => {
    setSearchInput(''); // Also clear search input
    setFilters({
      search: '',
      platform: 'all',
      genre: 'all',
      yearRange: [1970, 2024],
      minPlayers: 1,
      minRating: 0,
      esrbRating: 'all',
      cooperative: 'all',
      sortBy: 'name',
      sortDirection: 'asc'
    });
  }, []);

  const getRandomGames = async (count: number = 10) => {
    try {
      // Use PostgreSQL's RANDOM() function for true randomness from entire database
      const { data: randomGames, error } = await supabase.rpc('get_random_games', {
        game_count: count
      });

      if (error) {
        // Fallback to manual approach if function doesn't exist
        console.warn('RPC function not available, using fallback method');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('games_database')
          .select('id')
          .order('id') // Use a stable order first
          .limit(50000); // Get a very large pool from entire database

        if (fallbackError) throw fallbackError;

        if (fallbackData && fallbackData.length > 0) {
          // Use Fisher-Yates shuffle for true randomness
          const shuffled = [...fallbackData];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }

          const selected = shuffled.slice(0, count);
          const gameIds = new Set(selected.map(g => g.id));
          setSelectedGames(gameIds);

          toast({
            title: "Random Selection",
            description: `Selected ${selected.length} random games from ${fallbackData.length} total games`,
          });
        }
        return;
      }

      if (randomGames) {
        const gameIds = new Set(randomGames.map(g => g.id));
        setSelectedGames(gameIds);

        toast({
          title: "Random Selection",
          description: `Selected ${randomGames.length} truly random games`,
        });
      }
    } catch (error) {
      console.error('Error getting random games:', error);
      toast({
        title: "Error",
        description: "Failed to get random games",
        variant: "destructive"
      });
    }
  };

  const toggleGameSelection = useCallback((gameId: string) => {
    setSelectedGames(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(gameId)) {
        newSelection.delete(gameId);
      } else {
        newSelection.add(gameId);
      }
      return newSelection;
    });
  }, []);

  const toggleFavorite = useCallback(async (gameId: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to add games to your favorites",
        variant: "destructive"
      });
      return;
    }

    // Trigger pulse animation
    setPulsingHearts(prev => new Set([...prev, gameId]));

    // Remove from pulse set after animation completes
    setTimeout(() => {
      setPulsingHearts(prev => {
        const newSet = new Set(prev);
        newSet.delete(gameId);
        return newSet;
      });
    }, 600);

    // Look for the game in either the main games list or favorites details
    const game = games.find(g => g.id.toString() === gameId) || favoriteGamesDetails.find(g => g.id.toString() === gameId);

    if (game) {
      try {
        const result = await toggleFavoriteInDB(game);
        if (result) {
          toast({
            title: "Success",
            description: `${game.name} ${isFavorited(gameId) ? 'removed from' : 'added to'} favorites`,
          });
        }
      } catch (error) {
        console.error('Error toggling favorite:', error);
        toast({
          title: "Error",
          description: "Failed to update favorite. Please try again.",
          variant: "destructive"
        });
      }
    }
  }, [games, favoriteGamesDetails, toggleFavoriteInDB, user, toast, isFavorited]);

  const openGameModal = useCallback((game: Game, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card selection
    setSelectedGameForModal(game);
    setIsModalOpen(true);
  }, []);

  const closeGameModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedGameForModal(null);
  }, []);

  const openTournamentModal = useCallback(() => {
    setIsTournamentModalOpen(true);
  }, []);

  const closeTournamentModal = useCallback(() => {
    setIsTournamentModalOpen(false);
  }, []);

  // Convert selected games to the format expected by CreateTournamentModal
  const getSelectedGamesForTournament = useCallback(() => {
    // Look for selected games in both the main games array and favorites array
    const allGames = [...games, ...favoriteGamesDetails];

    // Remove duplicates by game id
    const uniqueGames = allGames.filter((game, index, self) =>
      index === self.findIndex(g => g.id === game.id)
    );

    return uniqueGames
      .filter(game => selectedGames.has(game.id))
      .map(game => ({
        id: parseInt(game.database_id?.toString() || '0'),
        name: game.name,
        description: game.overview,
        // Use stored logo_base64 first (should contain clear logos), then fallback to other images
        logo_url: game.logo_base64 || game.cover_url || game.screenshot_url,
        cover_url: game.cover_url,
        screenshot_url: game.screenshot_url,
        platform_name: game.platform_name
      }));
  }, [games, favoriteGamesDetails, selectedGames]);

  // State for favorites with aggregated ratings
  const [favoritesWithRatings, setFavoritesWithRatings] = useState<Game[]>([]);
  const [favoritesRatingLoading, setFavoritesRatingLoading] = useState(false);

  // Load SQLite logos for favorites when they change
  useEffect(() => {
    const loadFavoritesLogos = async () => {
      if (activeMainTab === 'favorites' && favoriteGamesDetails.length > 0) {
        try {
          const gameNames = favoriteGamesDetails.map(game => game.name);
          const logoMap = await sqliteService.getLogosForGames(gameNames);
          setSqliteLogos(prev => ({ ...prev, ...logoMap }));
        } catch (error) {
          console.warn('Failed to load SQLite logos for favorites:', error);
        }
      }
    };

    loadFavoritesLogos();
  }, [activeMainTab, favoriteGamesDetails]);

  // Fetch aggregated ratings for favorites when sorting by rating
  useEffect(() => {
    const fetchFavoritesRatings = async () => {
      if (activeMainTab === 'favorites' && favoritesSortBy === 'rating' && favoriteGamesDetails.length > 0) {
        setFavoritesRatingLoading(true);
        console.log('Fetching aggregated ratings for', favoriteGamesDetails.length, 'favorite games...');

        try {
          // Fetch aggregated ratings for all favorite games in parallel
          const ratingPromises = favoriteGamesDetails.map(async (game) => {
            try {
              const gameRatings = await ratingAggregationService.getCachedGameRatings(
                game.name,
                game.platform_name,
                game.community_rating && game.community_rating_count ? {
                  rating: game.community_rating,
                  count: game.community_rating_count
                } : undefined
              );
              return {
                ...game,
                aggregatedRating: gameRatings.aggregated.averageRating
              };
            } catch (error) {
              console.error('Error fetching rating for', game.name, ':', error);
              return {
                ...game,
                aggregatedRating: game.community_rating || 0
              };
            }
          });

          const gamesWithRatings = await Promise.all(ratingPromises);
          setFavoritesWithRatings(gamesWithRatings);
          console.log('Fetched aggregated ratings for favorites:', gamesWithRatings.slice(0, 3).map(g => ({
            name: g.name,
            rating: g.aggregatedRating
          })));
        } catch (error) {
          console.error('Error fetching aggregated ratings for favorites:', error);
          setFavoritesWithRatings(favoriteGamesDetails.map(game => ({ ...game, aggregatedRating: game.community_rating || 0 })));
        } finally {
          setFavoritesRatingLoading(false);
        }
      } else if (activeMainTab === 'favorites' && favoritesSortBy !== 'rating') {
        // For non-rating sorts, just use the original data
        setFavoritesWithRatings(favoriteGamesDetails);
      }
    };

    fetchFavoritesRatings();
  }, [activeMainTab, favoritesSortBy, favoriteGamesDetails]);

  // Filter and sort games based on active tab
  const displayedGames = useMemo(() => {
    if (activeMainTab === 'favorites') {
      if (favoritesRatingLoading) {
        return favoriteGamesDetails; // Show original data while loading
      }

      // Sort favorites using fetched aggregated ratings
      const gamesToSort = favoritesSortBy === 'rating' ? favoritesWithRatings : favoriteGamesDetails;
      const sorted = [...gamesToSort].sort((a, b) => {
        let comparison = 0;

        switch (favoritesSortBy) {
          case 'rating':
            const aRating = (a as Game & { aggregatedRating?: number }).aggregatedRating ?? a.community_rating ?? 0;
            const bRating = (b as Game & { aggregatedRating?: number }).aggregatedRating ?? b.community_rating ?? 0;
            // For rating: asc = high to low, desc = low to high
            comparison = favoritesSortDirection === 'asc' ? bRating - aRating : aRating - bRating;
            break;
          case 'year':
            const aYear = a.release_year || 0;
            const bYear = b.release_year || 0;
            comparison = aYear - bYear;
            break;
          case 'players':
            const aPlayers = a.max_players || 0;
            const bPlayers = b.max_players || 0;
            comparison = aPlayers - bPlayers;
            break;
          case 'platform':
            comparison = (a.platform_name || '').localeCompare(b.platform_name || '');
            break;
          default: // name
            comparison = a.name.localeCompare(b.name);
        }

        return favoritesSortDirection === 'desc' ? -comparison : comparison;
      });

      return sorted;
    }
    return games;
  }, [games, favoriteGamesDetails, favoritesWithRatings, favoritesRatingLoading, activeMainTab, favoritesSortBy, favoritesSortDirection]);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <div className="text-xl">Loading games database...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Games Database</h1>
        <p className="text-muted-foreground">
          Browse {totalGames.toLocaleString()} games from the LaunchBox database
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeMainTab} onValueChange={(value) => setActiveMainTab(value as 'all' | 'favorites')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4" />
            All Games ({totalGames})
          </TabsTrigger>
          <TabsTrigger value="favorites" className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Favorites ({favoriteGameIds.size})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters</CardTitle>
            <div className="flex gap-2">
              <Button onClick={clearFilters} variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
              <Button onClick={() => getRandomGames(10)} variant="outline" size="sm">
                <Shuffle className="w-4 h-4 mr-2" />
                Random 10
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Filters</TabsTrigger>
              <TabsTrigger value="advanced">Advanced Filters</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search games by name and press Enter..."
                      value={searchInput}
                      onChange={(e) => handleSearchInputChange(e.target.value)}
                      onKeyPress={handleSearchKeyPress}
                      onFocus={() => searchInput.length >= 2 && searchSuggestions.length > 0 && setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      className={`pl-10 ${searchLoading ? 'pr-16' : 'pr-10'}`}
                      disabled={searchLoading}
                    />
                    {searchInput && !searchLoading && (
                      <button
                        onClick={handleClearSearch}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 w-4 h-4 flex items-center justify-center"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                    {(searchLoading || suggestionLoading) && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                      </div>
                    )}

                    {/* Search Suggestions Dropdown */}
                    <AutocompleteDropdown
                      suggestions={searchSuggestions}
                      isOpen={showSuggestions}
                      onSelect={handleSuggestionSelect}
                      loading={suggestionLoading}
                    />
                  </div>
                  {filters.search && (
                    <div className="text-xs text-blue-600 mt-1">
                      Searching for: "{filters.search}"
                    </div>
                  )}

                  {/* Platform-specific search hints */}
                  {!filters.search && filters.platform !== 'all' && (
                    <div className="text-xs text-gray-500 mt-1">
                      {(() => {
                        const platformHints = {
                          'Nintendo Entertainment System': 'Try: "super mario", "zelda", "metroid", "mega man"',
                          'Super Nintendo Entertainment System': 'Try: "donkey kong country", "f-zero", "chrono trigger"',
                          'Sega Genesis': 'Try: "sonic", "streets of rage", "golden axe"',
                          'Nintendo Game Boy': 'Try: "tetris", "pokemon", "metroid ii"',
                          'Sony PlayStation': 'Try: "final fantasy", "resident evil", "metal gear"',
                          'Sony PlayStation 2': 'Try: "grand theft auto", "god of war", "shadow of the colossus"',
                          'Arcade': 'Try: "street fighter", "pac-man", "donkey kong", "galaga"',
                          'Nintendo 64': 'Try: "goldeneye", "mario kart 64", "ocarina of time"',
                          'Nintendo GameCube': 'Try: "wind waker", "metroid prime", "smash bros melee"'
                        };
                        return platformHints[filters.platform] || `Popular on ${filters.platform}: Try searching for classic titles`;
                      })()}
                    </div>
                  )}

                  {/* General search tips */}
                  {!filters.search && filters.platform === 'all' && (
                    <div className="text-xs text-gray-500 mt-1">
                      💡 Tip: Try "mario", "sonic", "zelda", or use abbreviations like "sf" for Street Fighter
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Platform</label>
                  <Select
                    value={filters.platform}
                    onValueChange={(value) => {
                      setFilters(prev => ({
                        ...prev,
                        platform: value,
                        search: searchInput || prev.search // Apply pending search input if any
                      }));
                      setCurrentPage(1); // Reset to first page when platform changes
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      {platforms.map(platform => (
                        <SelectItem key={platform.id} value={platform.name}>
                          {platform.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Genre</label>
                  <Select
                    value={filters.genre}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, genre: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genres</SelectItem>
                      {allGenres.map(genre => (
                        <SelectItem key={genre} value={genre}>
                          {genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sorting Controls */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Sort By</label>
                    <Select
                      value={filters.sortBy}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name (A-Z)</SelectItem>
                        <SelectItem value="rating">Rating (High to Low)</SelectItem>
                        <SelectItem value="year">Release Year</SelectItem>
                        <SelectItem value="players">Max Players</SelectItem>
                        <SelectItem value="platform">Platform</SelectItem>
                        <SelectItem value="newest">Newest Added</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setFilters(prev => ({
                      ...prev,
                      sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc'
                    }))}
                    title={`Current: ${filters.sortDirection === 'asc' ? 'Ascending' : 'Descending'} - Click to reverse`}
                  >
                    {filters.sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Release Year: {filters.yearRange[0]} - {filters.yearRange[1]}
                  </label>
                  <Slider
                    value={filters.yearRange}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, yearRange: value as [number, number] }))}
                    min={1970}
                    max={2024}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Min Players: {filters.minPlayers}</label>
                  <Slider
                    value={[filters.minPlayers]}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, minPlayers: value[0] }))}
                    min={1}
                    max={8}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Min Community Rating: {filters.minRating}</label>
                  <Slider
                    value={[filters.minRating]}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, minRating: value[0] }))}
                    min={0}
                    max={5}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">ESRB Rating</label>
                  <Select
                    value={filters.esrbRating}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, esrbRating: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Ratings</SelectItem>
                      {allESRBRatings.map(rating => (
                        <SelectItem key={rating} value={rating}>
                          {rating}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-muted-foreground">
          Showing {games.length.toLocaleString()} games
          {hasMoreGames && (
            <span className="ml-2 text-blue-600 font-medium">
              • Scroll down to load more
            </span>
          )}
          {selectedGames.size > 0 && (
            <span className="ml-2">
              • {selectedGames.size} selected
            </span>
          )}
        </div>

      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayedGames.map((game, index) => (
          <Card
            ref={index === displayedGames.length - 1 ? lastGameRef : null}
            key={game.id}
            className={`cursor-pointer transition-all hover:shadow-lg overflow-hidden flex flex-col h-full ${
              selectedGames.has(game.id) ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => toggleGameSelection(game.id)}
          >
            {/* Game Image - Always try GameLogo first with skeleton loading, then fallback to other images if clear logo fails */}
            <div className="relative aspect-video w-full overflow-hidden">
              {(() => {
                // If we have a pre-loaded SQLite logo, use it immediately
                if (sqliteLogos[game.name]) {
                  return (
                    <img
                      src={sqliteLogos[game.name]}
                      alt={`${game.name} clear logo`}
                      className="w-full h-full object-contain bg-gradient-to-br from-gray-900 to-gray-700"
                      onError={() => handleImageError(game.id)}
                    />
                  );
                }

                // If we have a pre-loaded logo_base64, use it immediately
                if (game.logo_base64) {
                  return (
                    <img
                      src={game.logo_base64}
                      alt={`${game.name} clear logo`}
                      className="w-full h-full object-contain bg-gradient-to-br from-gray-900 to-gray-700"
                      onError={() => handleImageError(game.id)}
                    />
                  );
                }

                // Try to load clear logo from API, show skeleton while loading
                return (
                  <div className="w-full h-full relative">
                    {/* Always show skeleton initially */}
                    <div
                      className="w-full h-full rounded-md relative overflow-hidden bg-gradient-to-r from-card via-muted to-card animate-pulse"
                      style={{
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 2.0s ease-in-out infinite'
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center p-4">
                          <div className="text-xs text-gray-400 mt-2 font-medium">
                            {game.name.substring(0, 15)}{game.name.length > 15 ? '...' : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Clear logo image loads on top when available */}
                    <img
                      src={`/api/clear-logos/${game.name.replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '-').toLowerCase()}.webp`}
                      alt={`${game.name} clear logo`}
                      className="absolute inset-0 w-full h-full object-contain bg-gradient-to-br from-gray-900 to-gray-700 opacity-0 transition-opacity duration-300"
                      onLoad={(e) => {
                        // Show image when loaded
                        e.currentTarget.style.opacity = '1';
                      }}
                      onError={(e) => {
                        // Hide image on error, keep skeleton visible
                        e.currentTarget.style.display = 'none';
                      }}
                      loading={index >= 4 ? "lazy" : "eager"}
                      decoding="async"
                      fetchpriority={index < 2 ? "high" : "auto"}
                    />
                  </div>
                );
              })()}

              {/* Heart icon for favorites - only show for logged in users */}
              {user && (
                <button
                  className="absolute top-2 left-2 z-10 p-1 transition-colors bg-black/20 rounded-full backdrop-blur-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(game.id.toString());
                  }}
                >
                  <div className="relative">
                    <Heart
                      className={`w-5 h-5 ${
                        favoriteGameIds.has(game.id.toString())
                          ? 'text-red-500 fill-red-500'
                          : 'text-white'
                      }`}
                    />
                    {pulsingHearts.has(game.id.toString()) && (
                      <Heart
                        className="absolute top-0 left-0 w-5 h-5 text-red-500 fill-red-500 heart-pulse pointer-events-none"
                      />
                    )}
                  </div>
                </button>
              )}

              {selectedGames.has(game.id) && (
                <div className="absolute top-2 right-2">
                  <Plus className="w-6 h-6 text-white bg-primary rounded-full p-1 rotate-45" />
                </div>
              )}
              {/* Platform badge */}
              <div className="absolute bottom-2 left-2">
                <Badge variant="secondary" className="text-xs bg-black/70 text-white border-none">
                  {game.platform_name}
                </Badge>
              </div>
              {/* Year badge */}
              {game.release_year && (
                <div className="absolute bottom-2 right-2">
                  <Badge variant="outline" className="text-xs bg-black/70 text-white border-white/20">
                    {game.release_year}
                  </Badge>
                </div>
              )}
            </div>

            <CardHeader className="pb-3 pt-4">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg leading-tight">{decodeHtmlEntities(game.name)}</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col flex-grow">
              <div className="flex flex-col space-y-3 flex-grow">
                {/* Enhanced Ratings and Players */}
                <div className="space-y-2">
                  {/* Rating Display */}
                  {game.community_rating && (
                    <GameRatingDisplay
                      gameName={game.name}
                      platform={game.platform_name}
                      launchboxRating={game.community_rating}
                      launchboxRatingCount={game.community_rating_count}
                      showSources={false}
                      className="text-sm"
                    />
                  )}

                  {/* Players and Co-op */}
                  <div className="flex items-center gap-4 text-sm">
                    {game.max_players && (
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{game.max_players}P</span>
                      </div>
                    )}

                    {game.cooperative && (
                      <Badge variant="secondary" className="text-xs">Co-op</Badge>
                    )}
                  </div>
                </div>

                {/* Genres */}
                {game.genres && game.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {game.genres.slice(0, 3).map(genre => (
                      <Badge key={genre} variant="outline" className="text-xs">
                        {genre}
                      </Badge>
                    ))}
                    {game.genres.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{game.genres.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Developer/Publisher */}
                {(game.developer || game.publisher) && (
                  <div className="text-xs text-muted-foreground">
                    {game.developer && <div>Dev: {game.developer}</div>}
                    {game.publisher && game.publisher !== game.developer && (
                      <div>Pub: {game.publisher}</div>
                    )}
                  </div>
                )}

                {/* Overview */}
                {game.overview && (
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {game.overview}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-auto pt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={selectedGames.has(game.id) ? "default" : "outline"}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGameSelection(game.id);
                    }}
                  >
                    <Plus className={`w-4 h-4 mr-1 ${selectedGames.has(game.id) ? 'rotate-45' : ''}`} />
                    {selectedGames.has(game.id) ? 'Added' : 'Add'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => openGameModal(game, e)}
                  >
                    <Info className="w-4 h-4 mr-1" />
                    Info
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Loading More Indicator */}
      {isLoadingMore && (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full"></div>
            <span>Loading more games...</span>
          </div>
        </div>
      )}

      {/* End of results indicator */}
      {!hasMoreGames && games.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <span>You've reached the end! Found {games.length} games total.</span>
        </div>
      )}

      {/* No Results */}
      {games.length === 0 && !loading && (
        <div className="text-center py-12">
          <Gamepad2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No games found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your filters or search terms
          </p>
          <Button onClick={clearFilters}>Clear All Filters</Button>
        </div>
      )}
        </TabsContent>

        <TabsContent value="favorites">
          {/* Favorites Content */}
          {favoriteGameIds.size === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No favorites yet</h3>
              <p className="text-muted-foreground mb-4">
                Click the heart icon on games in the "All Games" tab to add them to your favorites.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Your Favorite Games</h3>
                <div className="text-sm text-muted-foreground">
                  {favoriteGameIds.size} game{favoriteGameIds.size !== 1 ? 's' : ''} favorited
                </div>
              </div>

              {/* Favorites Sorting Controls */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Sort By</label>
                    <Select
                      value={favoritesSortBy}
                      onValueChange={setFavoritesSortBy}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name (A-Z)</SelectItem>
                        <SelectItem value="rating">Rating (High to Low)</SelectItem>
                        <SelectItem value="year">Release Year</SelectItem>
                        <SelectItem value="players">Max Players</SelectItem>
                        <SelectItem value="platform">Platform</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setFavoritesSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                    title={`Current: ${favoritesSortDirection === 'asc' ? 'Ascending' : 'Descending'} - Click to reverse`}
                  >
                    {favoritesSortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Favorites Games Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayedGames.map((game, index) => (
                  <Card
                    key={game.id}
                    className={`cursor-pointer transition-all hover:shadow-lg overflow-hidden flex flex-col h-full ${
                      selectedGames.has(game.id) ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => toggleGameSelection(game.id)}
                  >
                    {/* Game Image - Always try GameLogo first with skeleton loading, only clear logos in game lists */}
                    <div className="relative aspect-video w-full overflow-hidden">
                      {(() => {
                        // If we have a pre-loaded SQLite logo, use it immediately
                        if (sqliteLogos[game.name]) {
                          return (
                            <img
                              src={sqliteLogos[game.name]}
                              alt={`${game.name} clear logo`}
                              className="w-full h-full object-contain bg-gradient-to-br from-gray-900 to-gray-700"
                              onError={() => handleImageError(game.id)}
                            />
                          );
                        }

                        // If we have a pre-loaded logo_base64, use it immediately
                        if (game.logo_base64) {
                          return (
                            <img
                              src={game.logo_base64}
                              alt={`${game.name} clear logo`}
                              className="w-full h-full object-contain bg-gradient-to-br from-gray-900 to-gray-700"
                              onError={() => handleImageError(game.id)}
                            />
                          );
                        }

                        // All games have clear logos, show skeleton while loading
                        return (
                          <div className="w-full h-full relative">
                            {/* Always show skeleton initially */}
                            <div
                              className="w-full h-full rounded-md relative overflow-hidden bg-gradient-to-r from-card via-muted to-card animate-pulse"
                              style={{
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 2.0s ease-in-out infinite'
                              }}
                            >
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center p-4">
                                  <div className="text-xs text-gray-400 mt-2 font-medium">
                                    {game.name.substring(0, 15)}{game.name.length > 15 ? '...' : ''}
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/* Clear logo image loads on top when available */}
                            <img
                              src={`/api/clear-logos/${game.name.replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '-').toLowerCase()}.webp`}
                              alt={`${game.name} clear logo`}
                              className="absolute inset-0 w-full h-full object-contain bg-gradient-to-br from-gray-900 to-gray-700 opacity-0 transition-opacity duration-300"
                              onLoad={(e) => {
                                // Show image when loaded
                                e.currentTarget.style.opacity = '1';
                              }}
                              onError={(e) => {
                                // Hide image on error, keep skeleton visible
                                e.currentTarget.style.display = 'none';
                                handleImageError(game.id);
                              }}
                              loading={index >= 4 ? "lazy" : "eager"}
                              decoding="async"
                              fetchpriority={index < 2 ? "high" : "auto"}
                            />
                          </div>
                        );
                      })()}

                      {/* Heart icon for favorites - only show for logged in users */}
                      {user && (
                        <button
                          className="absolute top-2 left-2 z-10 p-1 transition-colors bg-black/20 rounded-full backdrop-blur-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(game.id.toString());
                          }}
                        >
                          <div className="relative">
                            <Heart
                              className={`w-5 h-5 ${
                                favoriteGameIds.has(game.id.toString())
                                  ? 'text-red-500 fill-red-500'
                                  : 'text-white'
                              }`}
                            />
                            {pulsingHearts.has(game.id.toString()) && (
                              <Heart
                                className="absolute top-0 left-0 w-5 h-5 text-red-500 fill-red-500 heart-pulse pointer-events-none"
                              />
                            )}
                          </div>
                        </button>
                      )}

                      {selectedGames.has(game.id) && (
                        <div className="absolute top-2 right-2">
                          <Plus className="w-6 h-6 text-white bg-primary rounded-full p-1 rotate-45" />
                        </div>
                      )}
                      {/* Platform badge */}
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="secondary" className="text-xs bg-black/70 text-white border-none">
                          {game.platform_name}
                        </Badge>
                      </div>
                      {/* Year badge */}
                      {game.release_year && (
                        <div className="absolute bottom-2 right-2">
                          <Badge variant="outline" className="text-xs bg-black/70 text-white border-white/20">
                            {game.release_year}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <CardHeader className="pb-3 pt-4">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg leading-tight">{decodeHtmlEntities(game.name)}</CardTitle>
                      </div>
                    </CardHeader>

                    <CardContent className="flex flex-col flex-grow">
                      <div className="flex flex-col space-y-3 flex-grow">
                        {/* Enhanced Ratings and Players */}
                        <div className="space-y-2">
                          {/* Rating Display */}
                          {game.community_rating && (
                            <GameRatingDisplay
                              gameName={game.name}
                              platform={game.platform_name}
                              launchboxRating={game.community_rating}
                              launchboxRatingCount={game.community_rating_count}
                              showSources={false}
                              className="text-sm"
                            />
                          )}

                          {/* Players and Co-op */}
                          <div className="flex items-center gap-4 text-sm">
                            {game.max_players && (
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                <span>{game.max_players}P</span>
                              </div>
                            )}
                            {game.cooperative && (
                              <div className="flex items-center gap-1">
                                <span className="text-green-400">Co-op</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-auto">
                          <Button
                            variant={selectedGames.has(game.id) ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGameSelection(game.id);
                            }}
                          >
                            <Plus className={`w-4 h-4 mr-1 ${selectedGames.has(game.id) ? 'rotate-45' : ''}`} />
                            {selectedGames.has(game.id) ? 'Added' : 'Add'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={(e) => openGameModal(game, e)}
                          >
                            <Info className="w-4 h-4 mr-1" />
                            More Info
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Selection Actions */}
      {selectedGames.size > 0 && (
        <Card className="fixed bottom-4 right-4 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {selectedGames.size} games selected
            </span>
            <Button size="sm" onClick={() => setSelectedGames(new Set())}>
              Clear
            </Button>
            <Button size="sm" onClick={openTournamentModal}>
              Create Competition
            </Button>
          </div>
        </Card>
      )}

      {/* Game Details Modal */}
      <GameDetailsModal
        game={selectedGameForModal}
        isOpen={isModalOpen}
        onClose={closeGameModal}
        favoriteGameIds={favoriteGameIds}
        toggleFavorite={toggleFavorite}
        pulsingHearts={pulsingHearts}
      />

      {/* Tournament Creation Modal */}
      <CreateTournamentModal
        isOpen={isTournamentModalOpen}
        onClose={closeTournamentModal}
        initialGames={getSelectedGamesForTournament()}
      />
    </div>
  );
};

export default GamesBrowser;