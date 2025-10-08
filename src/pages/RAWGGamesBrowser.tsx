import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { Search, Filter, Star, Users, Calendar, Gamepad2, Shuffle, Plus, Info, Heart } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { rawgGamesService, GameSearchFilters } from "@/services/rawgGamesService";
import { RAWGGame } from "@/utils/rawgApi";
import { GameDetailsModal } from "@/components/GameDetailsModal";
import { CreateTournamentModal } from "@/components/CreateTournamentModal";

// Import Game interface for type transformation
interface Game {
  id: number;
  name: string;
  platform_name: string;
  database_id: number | null;
  release_year: number | null;
  overview: string | null;
  max_players: number | null;
  cooperative: boolean | null;
  community_rating: number | null;
  community_rating_count: number | null;
  esrb_rating: string | null;
  genres: string[];
  developer: string | null;
  publisher: string | null;
  video_url: string | null;
  screenshot_url: string | null;
  cover_url: string | null;
  logo_url: string | null;
  series?: string | null;
  region?: string | null;
  alternative_names?: string[];
  play_modes?: string[];
  themes?: string[];
  wikipedia_url?: string | null;
  video_urls?: string[];
  release_type?: string | null;
  release_date?: string | null;
}
import { useFavorites } from "@/hooks/useFavorites";
import RAWGAPI from "@/utils/rawgApi";
import { AdvancedSearchField } from "@/components/ui/advanced-search-field";

// Utility function to clean HTML and truncate text
const cleanDescription = (description: string | undefined, maxLength: number = 150): string => {
  if (!description) return '';

  // Remove HTML tags
  const cleaned = description.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  const decoded = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Truncate and add ellipsis if needed
  if (decoded.length > maxLength) {
    return decoded.substring(0, maxLength).trim() + '...';
  }

  return decoded.trim();
};

interface FilterState {
  search: string;
  platform: string;
  genre: string;
  yearRange: [number, number];
  minRating: number;
}

const RAWGGamesBrowser: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { favorites, toggleFavorite, isFavorited } = useFavorites();

  const [games, setGames] = useState<RAWGGame[]>([]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGames, setSelectedGames] = useState<Set<number>>(new Set());
  const [selectedGamesData, setSelectedGamesData] = useState<Map<number, RAWGGame>>(new Map());
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedGameForDetails, setSelectedGameForDetails] = useState<RAWGGame | null>(null);
  const [detailedGame, setDetailedGame] = useState<Partial<Game> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    platform: 'all',
    genre: 'all',
    yearRange: [1984, 2000],
    minRating: 0
  });

  const [currentPage, setCurrentPage] = useState(1);
  const gamesPerPage = 24;
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const isConfigured = rawgGamesService.isConfigured();

  useEffect(() => {
    loadInitialData();
  }, []);

  // Debounced effect for search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (isConfigured) {
        searchGames();
      }
    }, filters.search ? 500 : 0); // Debounce search, but not other filters

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [filters.search]);

  // Non-debounced effect for other filters
  useEffect(() => {
    if (isConfigured) {
      searchGames();
    }
  }, [filters.platform, filters.genre, filters.yearRange, filters.minRating, currentPage, isConfigured, showFavoritesOnly, favorites]);

  // Handle search input changes
  const handleSearchChange = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
    setCurrentPage(1);
  }, []);


  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const loadInitialData = async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    try {
      const [platformsData, genresData] = await Promise.all([
        rawgGamesService.getPlatforms(),
        rawgGamesService.getGenres()
      ]);

      setPlatforms(platformsData);
      setGenres(genresData);
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast({
        title: "Error",
        description: "Failed to load platform and genre data",
        variant: "destructive"
      });
    }
  };

  const searchGames = async () => {
    if (!isConfigured) return;

    setLoading(true);
    try {
      // If showing favorites only, display favorites instead of searching
      if (showFavoritesOnly) {
        const favoritesAsGames: RAWGGame[] = favorites.map(fav => ({
          id: fav.game_id,
          name: fav.game_name,
          slug: fav.game_name.toLowerCase().replace(/\s+/g, '-'),
          background_image: fav.game_image_url || null,
          released: null,
          rating: 0,
          rating_top: 5,
          ratings_count: 0,
          metacritic: null,
          description: fav.game_description,
          description_raw: fav.game_description,
          website: null,
          playtime: null,
          esrb_rating: null,
          platforms: fav.game_platforms || [],
          genres: [],
          developers: [],
          publishers: [],
          stores: [],
          tags: [],
          short_screenshots: []
        }));

        setGames(favoritesAsGames);
        setTotalCount(favoritesAsGames.length);
        setHasNextPage(false);
        setLoading(false);
        return;
      }
      // If no filters are applied, show popular games
      const hasFilters = filters.search ||
                        filters.platform !== 'all' ||
                        filters.genre !== 'all' ||
                        filters.yearRange[0] !== 1984 ||
                        filters.yearRange[1] !== 2000 ||
                        filters.minRating > 0;

      if (!hasFilters) {
        // Show popular games
        const result = await rawgGamesService.getPopularGames(currentPage, gamesPerPage);
        setGames(result.games);
        setTotalCount(result.totalCount);
        setHasNextPage(result.hasNextPage);
        return;
      }

      // Apply search filters
      const searchFilters: GameSearchFilters = {
        page: currentPage,
        pageSize: gamesPerPage
      };

      if (filters.search) {
        searchFilters.search = filters.search;
      }

      if (filters.platform !== 'all') {
        // Special handling for arcade - use as tag instead of platform
        if (filters.platform === 'arcade') {
          searchFilters.tags = ['31']; // Arcade tag ID in RAWG
        } else {
          const platformId = platforms.find(p => p.slug === filters.platform)?.id;
          if (platformId) {
            searchFilters.platforms = [platformId.toString()];
          }
        }
      }

      if (filters.genre !== 'all') {
        const genreId = genres.find(g => g.slug === filters.genre)?.id;
        if (genreId) {
          searchFilters.genres = [genreId.toString()];
        }
      }

      if (filters.yearRange[0] !== 1984 || filters.yearRange[1] !== 2000) {
        searchFilters.yearRange = filters.yearRange;
      }

      if (filters.minRating > 0) {
        searchFilters.minRating = filters.minRating;
      }

      const result = await rawgGamesService.searchGames(searchFilters);
      setGames(result.games);
      setTotalCount(result.totalCount);
      setHasNextPage(result.hasNextPage);
    } catch (error) {
      console.error('Error searching games:', error);
      toast({
        title: "Error",
        description: "Failed to search games",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      platform: 'all',
      genre: 'all',
      yearRange: [1984, 2000],
      minRating: 0
    });
    setCurrentPage(1);
  }, []);

  const getRandomGames = async (count: number = 10) => {
    if (!isConfigured) return;

    try {
      const result = await rawgGamesService.getPopularGames(Math.floor(Math.random() * 10) + 1, count);
      const gameIds = new Set(result.games.map(g => g.id));
      const gamesMap = new Map(result.games.map(g => [g.id, g]));

      setSelectedGames(gameIds);
      setSelectedGamesData(gamesMap);

      toast({
        title: "Random Selection",
        description: `Selected ${result.games.length} random games`,
      });
    } catch (error) {
      console.error('Error getting random games:', error);
    }
  };

  const toggleGameSelection = useCallback((gameId: number) => {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    setSelectedGames(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(gameId)) {
        newSelection.delete(gameId);
      } else {
        newSelection.add(gameId);
      }
      return newSelection;
    });

    setSelectedGamesData(prev => {
      const newData = new Map(prev);
      if (newData.has(gameId)) {
        newData.delete(gameId);
      } else {
        newData.set(gameId, game);
      }
      return newData;
    });
  }, [games]);

  // Transform RAWGGame to Game format for GameDetailsModal
  const transformRAWGGameToGame = (rawgGame: RAWGGame): Partial<Game> => {
    return {
      id: rawgGame.id,
      name: rawgGame.name,
      platform_name: rawgGame.platforms?.[0]?.platform?.name || 'Unknown',
      database_id: null,
      release_year: rawgGame.released ? new Date(rawgGame.released).getFullYear() : null,
      overview: rawgGame.description || rawgGame.description_raw || null,
      max_players: null,
      cooperative: null,
      community_rating: rawgGame.rating || null,
      community_rating_count: rawgGame.ratings_count || null,
      esrb_rating: rawgGame.esrb_rating?.name || null,
      genres: rawgGame.genres?.map(g => g.name) || [],
      developer: rawgGame.developers?.[0]?.name || null,
      publisher: rawgGame.publishers?.[0]?.name || null,
      video_url: null,
      screenshot_url: rawgGame.background_image || null,
      cover_url: rawgGame.background_image || null,
      logo_url: null,
    };
  };

  const openGameDetails = useCallback(async (game: RAWGGame) => {
    if (!isConfigured) return;

    setSelectedGameForDetails(game);
    setIsModalOpen(true);
    setLoadingDetails(true);

    try {
      // Create API instance to fetch detailed game data
      const apiKey = import.meta.env.VITE_RAWG_API_KEY;
      const api = new RAWGAPI({ apiKey });

      // Fetch detailed game information
      const detailedGameData = await api.getGame(game.id);
      // Transform to Game format
      const transformedGame = transformRAWGGameToGame(detailedGameData);
      setDetailedGame(transformedGame);
    } catch (error) {
      console.error('Error fetching game details:', error);
      // Fall back to basic game data from the list, also transformed
      const transformedGame = transformRAWGGameToGame(game);
      setDetailedGame(transformedGame);
      toast({
        title: "Info",
        description: "Showing basic game information",
        variant: "default"
      });
    } finally {
      setLoadingDetails(false);
    }
  }, [isConfigured, toast]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedGameForDetails(null);
    setDetailedGame(null);
  }, []);

  const getSelectedGamesForTournament = useMemo(() => {
    const result = Array.from(selectedGames).map(gameId => {
      const game = selectedGamesData.get(gameId);
      if (!game) return null;

      return {
        id: game.id,
        name: game.name,
        description: game.description || game.description_raw || undefined,
        logo_url: game.background_image || undefined,
        platforms: game.platforms || [], // Include platform info to detect arcade games
      };
    }).filter(Boolean) as Array<{
      id: number;
      name: string;
      description?: string;
      logo_url?: string;
      platforms?: Array<{ platform: { id: number; name: string; slug: string } }>;
    }>;

    console.log('Selected games for tournament:', result, 'selectedGames set:', selectedGames, 'selectedGamesData:', selectedGamesData);
    return result;
  }, [selectedGames, selectedGamesData]);

  const totalPages = Math.ceil(totalCount / gamesPerPage);

  if (!isConfigured) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <Gamepad2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">RAWG API Not Configured</h3>
          <p className="text-muted-foreground mb-4">
            Please add your RAWG API key to the .env file to browse games
          </p>
          <p className="text-sm text-muted-foreground">
            Get your free API key at: <a href="https://rawg.io/apidocs" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">rawg.io/apidocs</a>
          </p>
        </div>
      </div>
    );
  }

  if (loading && games.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <div className="text-xl">Loading games...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Games Browser</h1>
          <p className="text-muted-foreground">
            {filters.search || filters.platform !== 'all' || filters.genre !== 'all' ||
             filters.yearRange[0] !== 1984 || filters.yearRange[1] !== 2000 || filters.minRating > 0
              ? `Showing filtered results • Powered by RAWG`
              : `Showing popular games • Powered by RAWG`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={clearFilters} variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Clear Filters
          </Button>
          <Button onClick={() => getRandomGames(10)} variant="outline">
            <Shuffle className="w-4 h-4 mr-2" />
            Random 10
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Filters</TabsTrigger>
              <TabsTrigger value="advanced">Advanced Filters</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <AdvancedSearchField
                    value={filters.search}
                    onChange={handleSearchChange}
                    placeholder="Search games..."
                    enableSuggestions={false}
                    enableRealTimeSearch={true}
                    disabled={showFavoritesOnly}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">My Favorites</label>
                  <div className="flex items-center space-x-2 h-10">
                    <Switch
                      checked={showFavoritesOnly}
                      onCheckedChange={(checked) => {
                        setShowFavoritesOnly(checked);
                        setCurrentPage(1);
                      }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {user ? `Show my ${favorites.length} favorites` : 'Login to see favorites'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Platform</label>
                  <Select
                    value={filters.platform}
                    onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, platform: value }));
                      setCurrentPage(1);
                    }}
                    disabled={showFavoritesOnly}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      {platforms.map(platform => (
                        <SelectItem key={platform.id} value={platform.slug}>
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
                    onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, genre: value }));
                      setCurrentPage(1);
                    }}
                    disabled={showFavoritesOnly}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genres</SelectItem>
                      {genres.map(genre => (
                        <SelectItem key={genre.id} value={genre.slug}>
                          {genre.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Release Year: {filters.yearRange[0]} - {filters.yearRange[1]}
                  </label>
                  <Slider
                    value={filters.yearRange}
                    onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, yearRange: value as [number, number] }));
                      setCurrentPage(1);
                    }}
                    min={1980}
                    max={2024}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Min Rating: {filters.minRating}</label>
                  <Slider
                    value={[filters.minRating]}
                    onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, minRating: value[0] }));
                      setCurrentPage(1);
                    }}
                    min={0}
                    max={5}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {games.length} of {totalCount.toLocaleString()} games
          {selectedGames.size > 0 && (
            <span className="ml-2">
              • {selectedGames.size} selected
            </span>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={!hasNextPage || loading}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Games Grid - RAWG-style expanded cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {games.map(game => {
          const imageUrl = rawgGamesService.getGameImage(game);
          const releaseYear = game.released ? new Date(game.released).getFullYear() : null;
          const platforms = game.platforms?.slice(0, 4) || [];

          return (
            <Card
              key={game.id}
              className={`group relative transition-all duration-300 overflow-hidden bg-card border-border/40 ${
                selectedGames.has(game.id) ? 'ring-2 ring-primary shadow-lg' : ''
              }`}
            >
              <div className="flex h-32 sm:h-40">
                {/* Game Image */}
                <div className="relative w-1/3 flex-shrink-0 overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={`${game.name} screenshot`}
                      className="w-full h-full object-cover transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                      <Gamepad2 className="w-8 h-8 opacity-75" />
                    </div>
                  )}

                </div>

                {/* Game Info */}
                <div className="flex-1 p-4 flex flex-col justify-between">
                  {/* Header */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-sm sm:text-base leading-tight line-clamp-2 transition-colors">
                        {game.name}
                      </h3>
                    </div>

                    {/* Release Date */}
                    {game.released && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(game.released).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}</span>
                      </div>
                    )}

                    {/* Rating and Metacritic */}
                    <div className="flex items-center gap-3 text-sm">
                      {game.rating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{game.rating.toFixed(1)}</span>
                          {game.ratings_count > 0 && (
                            <span className="text-muted-foreground text-xs">
                              ({game.ratings_count.toLocaleString()})
                            </span>
                          )}
                        </div>
                      )}

                      {game.metacritic && (
                        <div className="flex items-center gap-1">
                          <div className={`text-xs px-1.5 py-0.5 rounded font-bold text-white ${
                            game.metacritic >= 75 ? 'bg-green-500' :
                            game.metacritic >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}>
                            {game.metacritic}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Game Description */}
                    {(game.description || game.description_raw) ? (
                      <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {cleanDescription(game.description || game.description_raw, 120)}
                      </div>
                    ) : (
                      // Fallback description based on genres and platforms
                      game.genres && game.genres.length > 0 && (
                        <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic">
                          A {game.genres.slice(0, 2).map(g => g.name.toLowerCase()).join(' ')} game
                          {game.developers && game.developers.length > 0 && ` by ${game.developers[0].name}`}
                          {game.released && ` released in ${new Date(game.released).getFullYear()}`}.
                        </div>
                      )
                    )}
                  </div>

                  {/* Footer */}
                  <div className="space-y-2">
                    {/* Genres */}
                    {game.genres && game.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {game.genres.slice(0, 3).map(genre => (
                          <Badge
                            key={genre.id}
                            variant="outline"
                            className="text-xs px-2 py-1 text-foreground border-border/60 hover:bg-muted/50 transition-colors"
                          >
                            {genre.name}
                          </Badge>
                        ))}
                        {game.genres.length > 3 && (
                          <Badge
                            variant="outline"
                            className="text-xs px-2 py-1 text-muted-foreground border-border/40"
                          >
                            +{game.genres.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Platforms */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {platforms.map((platform, index) => (
                        <span
                          key={platform.platform.id}
                          className="text-xs text-muted-foreground"
                        >
                          {platform.platform.name}
                          {index < platforms.length - 1 && platforms.length > 1 && (
                            <span className="mx-1">•</span>
                          )}
                        </span>
                      ))}
                      {game.platforms && game.platforms.length > 4 && (
                        <span className="text-xs text-muted-foreground">
                          +{game.platforms.length - 4} more
                        </span>
                      )}
                    </div>

                    {/* Developer */}
                    {game.developers && game.developers.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        by {game.developers[0].name}
                        {game.publishers && game.publishers.length > 0 && game.publishers[0].name !== game.developers[0].name && (
                          <span> • {game.publishers[0].name}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons - Positioned in bottom right corner */}
                <div className="absolute bottom-2 right-2 flex flex-col gap-1">
                  {/* Add/Remove Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className={`text-xs h-7 px-2 bg-background/90 backdrop-blur-sm border-border/60 transition-all ${
                      selectedGames.has(game.id)
                        ? 'bg-primary/90 hover:bg-primary text-primary-foreground border-primary/60'
                        : 'hover:bg-background/95 hover:border-border'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGameSelection(game.id);
                    }}
                  >
                    <Plus className={`w-3 h-3 mr-1 ${selectedGames.has(game.id) ? 'rotate-45' : ''} transition-transform`} />
                    {selectedGames.has(game.id) ? 'Remove' : 'Add'}
                  </Button>

                  {/* Favorite Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className={`text-xs h-7 px-2 bg-background/90 backdrop-blur-sm border-border/60 transition-all ${
                      isFavorited(game.id)
                        ? 'bg-red-500/90 hover:bg-red-500 text-white border-red-500/60'
                        : 'hover:bg-background/95 hover:border-border'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(game);
                    }}
                  >
                    <Heart className={`w-3 h-3 mr-1 ${isFavorited(game.id) ? 'fill-current' : ''} transition-all`} />
                    {isFavorited(game.id) ? 'Loved' : 'Love'}
                  </Button>

                  {/* More Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2 bg-background/90 backdrop-blur-sm border-border/60 hover:bg-background/95 hover:border-border transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      openGameDetails(game);
                    }}
                  >
                    <Info className="w-3 h-3 mr-1" />
                    More
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

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

      {/* Selection Actions */}
      {selectedGames.size > 0 && (
        <Card className="fixed bottom-4 right-4 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {selectedGames.size} games selected
            </span>
            <Button size="sm" onClick={() => {
              setSelectedGames(new Set());
              setSelectedGamesData(new Map());
            }}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setIsTournamentModalOpen(true)}>
              Create Competition
            </Button>
          </div>
        </Card>
      )}

      {/* Game Details Modal */}
      <GameDetailsModal
        game={detailedGame}
        isOpen={isModalOpen}
        onClose={closeModal}
      />

      {/* Create Tournament Modal */}
      <CreateTournamentModal
        isOpen={isTournamentModalOpen}
        onClose={() => {
          setIsTournamentModalOpen(false);
          // Clear selected games after tournament creation
          setSelectedGames(new Set());
          setSelectedGamesData(new Map());
        }}
        initialGames={getSelectedGamesForTournament}
      />
    </div>
  );
};

export default RAWGGamesBrowser;