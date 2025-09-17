import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Search, Filter, Star, Users, Calendar, Gamepad2, Shuffle, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { GameLogo } from "@/components/GameLogo";

interface Game {
  id: string;
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
}

const GamesBrowser: React.FC = () => {
  console.log('🎮 LaunchBox GamesBrowser component loaded');
  const { user } = useAuth();
  const { toast } = useToast();

  const [games, setGames] = useState<Game[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [totalGames, setTotalGames] = useState(0);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    platform: 'all',
    genre: 'all',
    yearRange: [1970, 2024],
    minPlayers: 1,
    minRating: 0,
    esrbRating: 'all',
    cooperative: 'all'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const gamesPerPage = 12; // Reduced from 24 to 12 for better performance

  // Extract unique values for filters - load these separately for better performance
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [allESRBRatings, setAllESRBRatings] = useState<string[]>([]);

  // Server-side pagination
  const totalPages = Math.ceil(totalGames / gamesPerPage);

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        // Load unique genres
        const { data: genresData } = await supabase
          .from('games_database')
          .select('genres')
          .not('genres', 'is', null);

        if (genresData) {
          const genreSet = new Set<string>();
          genresData.forEach(row => {
            row.genres?.forEach((genre: string) => genreSet.add(genre));
          });
          setAllGenres(Array.from(genreSet).sort());
        }

        // Load unique ESRB ratings
        const { data: ratingsData } = await supabase
          .from('games_database')
          .select('esrb_rating')
          .not('esrb_rating', 'is', null);

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
  }, []);

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

  // Debounce search to avoid too many requests
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadGames();
    }, filters.search ? 500 : 0); // 500ms delay for search, immediate for other filters

    return () => clearTimeout(timeoutId);
  }, [filters, currentPage]);

  const loadGames = async () => {
    // Use searchLoading for search operations, loading for initial load
    if (filters.search || filters.platform !== 'all' || filters.yearRange[0] > 1970 || filters.yearRange[1] < 2024) {
      setSearchLoading(true);
    } else {
      setLoading(true);
    }

    try {
      let query = supabase
        .from('games_database')
        .select(`
          id,
          name,
          platform_name,
          database_id,
          release_year,
          overview,
          max_players,
          cooperative,
          community_rating,
          community_rating_count,
          esrb_rating,
          genres,
          developer,
          publisher,
          video_url,
          screenshot_url,
          cover_url,
          logo_url
        `); // Removed count: 'exact' to improve performance

      // Apply search filter - use prefix search for better performance on large datasets
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        // Use prefix search (starts with) for better performance than wildcard search
        // This will work with a simple index on LOWER(name)
        query = query.ilike('name', `${searchTerm}%`);
      }

      // Apply platform filter
      if (filters.platform !== 'all') {
        query = query.eq('platform_name', filters.platform);
      }

      // Apply year filter
      if (filters.yearRange[0] > 1970 || filters.yearRange[1] < 2024) {
        query = query.gte('release_year', filters.yearRange[0]).lte('release_year', filters.yearRange[1]);
      }

      // Apply pagination
      const startIndex = (currentPage - 1) * gamesPerPage;
      query = query.range(startIndex, startIndex + gamesPerPage - 1).order('name');

      const { data: gamesData, error: gamesError } = await query;

      if (gamesError) throw gamesError;

      setGames(gamesData || []);

      // Log how many games have stored logos vs need LaunchBox API
      const gamesWithLogos = gamesData?.filter(g => g.logo_url) || [];
      console.log(`📊 Games loaded: ${gamesData?.length || 0}, with stored logos: ${gamesWithLogos.length}, need API: ${(gamesData?.length || 0) - gamesWithLogos.length}`);

      // Set approximate total for pagination (estimate based on page size)
      if (gamesData && gamesData.length === gamesPerPage) {
        // More pages likely exist
        setTotalGames(Math.max(totalGames, currentPage * gamesPerPage + 1));
      } else {
        // This is likely the last page
        setTotalGames((currentPage - 1) * gamesPerPage + (gamesData?.length || 0));
      }
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
    }
  };

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
    setFilters({
      search: '',
      platform: 'all',
      genre: 'all',
      yearRange: [1970, 2024],
      minPlayers: 1,
      minRating: 0,
      esrbRating: 'all',
      cooperative: 'all'
    });
    setCurrentPage(1);
  }, []);

  const getRandomGames = async (count: number = 10) => {
    try {
      // Get random games from database
      const { data: randomGames, error } = await supabase
        .from('games_database')
        .select('id')
        .limit(count)
        .order('name', { ascending: false }); // This is a simple way to get different results

      if (error) throw error;

      if (randomGames) {
        const gameIds = new Set(randomGames.map(g => g.id));
        setSelectedGames(gameIds);

        toast({
          title: "Random Selection",
          description: `Selected ${randomGames.length} random games`,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Games Database</h1>
          <p className="text-muted-foreground">
            Browse {totalGames.toLocaleString()} games from the LaunchBox database
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search games by name..."
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="pl-10"
                      disabled={searchLoading}
                    />
                    {searchLoading && (
                      <div className="absolute right-3 top-3">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Platform</label>
                  <Select
                    value={filters.platform}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, platform: value }))}
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
                  <label className="text-sm font-medium mb-2 block">Min Rating: {filters.minRating}</label>
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
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {games.length} of {totalGames.toLocaleString()} games
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
              disabled={currentPage === 1}
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
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {games.map(game => (
          <Card
            key={game.id}
            className={`cursor-pointer transition-all hover:shadow-lg overflow-hidden ${
              selectedGames.has(game.id) ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => toggleGameSelection(game.id)}
          >
            {/* Game Logo - Use stored URL or fallback to LaunchBox */}
            <div className="relative aspect-video w-full overflow-hidden">
              {game.logo_url ? (
                <img
                  src={game.logo_url}
                  alt={`${game.name} logo`}
                  className="w-full h-full object-contain bg-gray-900 p-2"
                  onError={() => handleImageError(game.id)}
                />
              ) : (
                <GameLogo
                  gameName={game.name}
                  className="w-full h-full"
                  onError={() => handleImageError(game.id)}
                />
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
                <CardTitle className="text-lg leading-tight">{game.name}</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Ratings and Players */}
              <div className="flex items-center gap-4 text-sm">
                {game.community_rating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span>{game.community_rating.toFixed(1)}</span>
                    {game.community_rating_count && (
                      <span className="text-muted-foreground">({game.community_rating_count})</span>
                    )}
                  </div>
                )}

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
            </CardContent>
          </Card>
        ))}
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
            <Button size="sm" onClick={() => setSelectedGames(new Set())}>
              Clear
            </Button>
            <Button size="sm">
              Create Competition
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default GamesBrowser;