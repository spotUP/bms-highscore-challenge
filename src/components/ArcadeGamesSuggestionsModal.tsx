import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Gamepad2, Star, Users, Calendar, Loader2, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface ArcadeGame {
  id: string;
  name: string;
  release_year?: number;
  community_rating?: number;
  developer?: string;
  overview?: string;
  platform_name: string;
  genres?: string[];
  max_players?: number;
}

interface ArcadeGamesSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGames: (gameNames: string[]) => void;
}

export const ArcadeGamesSuggestionsModal: React.FC<ArcadeGamesSuggestionsModalProps> = ({
  isOpen,
  onClose,
  onSelectGames
}) => {
  const [games, setGames] = useState<ArcadeGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchArcadeGames = async () => {
    setLoading(true);
    try {
      // Get competitive games using name-based matching and genre filtering
      const { data, error } = await api
        .from('games_database')
        .select('*')
        .eq('platform_name', 'Arcade')
        .not('genres', 'cs', '{"Fighting"}') // Exclude fighting games (separate modal)
        .not('cooperative', 'is', true) // Exclude cooperative games
        .eq('max_players', 2) // Exactly 2 players for head-to-head
        .or('genres.cs.{"Racing"},genres.cs.{"Sports"},name.ilike."%vs.%",name.ilike."%versus%",name.ilike."%battle%"')
        .not('community_rating', 'is', null)
        .not('community_rating_count', 'is', null)
        .gte('community_rating', 3.0)
        .gte('community_rating_count', 3)
        .order('community_rating', { ascending: false })
        .limit(150);

      if (error) throw error;

      // Weight games by composite score: rating * log(rating_count + 1)
      const allGames = (data || []).map(game => ({
        ...game,
        composite_score: (game.community_rating || 0) * Math.log((game.community_rating_count || 0) + 1)
      }));

      // Sort by composite score (higher is better), then randomly shuffle within tiers
      const sortedGames = allGames.sort((a, b) => b.composite_score - a.composite_score);

      // Create weighted random selection favoring higher scores
      const selectedGames = [];
      const availableGames = [...sortedGames];

      for (let i = 0; i < Math.min(30, availableGames.length); i++) {
        // Weight selection towards top games but allow randomness
        const maxIndex = Math.min(availableGames.length, 20 + i * 5); // Expand pool as we pick
        const randomIndex = Math.floor(Math.random() * maxIndex);
        selectedGames.push(availableGames[randomIndex]);
        availableGames.splice(randomIndex, 1);
      }

      setGames(selectedGames);
    } catch (error) {
      console.error('Error fetching arcade games:', error);
      toast({
        title: 'Error',
        description: 'Failed to load arcade games from database',
        variant: 'destructive'
      });

      // Fallback to hardcoded list of classic arcade 2-player versus games (non-fighting, non-coop)
      const fallbackGames: ArcadeGame[] = [
        { id: 'pong', name: 'Pong', release_year: 1972, community_rating: 4.0, developer: 'Atari', platform_name: 'Arcade', overview: 'The original arcade versus game - table tennis simulation', max_players: 2 },
        { id: 'joust', name: 'Joust', release_year: 1982, community_rating: 4.3, developer: 'Williams Electronics', platform_name: 'Arcade', overview: 'Flying ostrich knights battle for supremacy', max_players: 2 },
        { id: 'mario_bros', name: 'Mario Bros.', release_year: 1983, community_rating: 4.2, developer: 'Nintendo', platform_name: 'Arcade', overview: 'Mario and Luigi compete to clear pipes of creatures', max_players: 2 },
        { id: 'spy_vs_spy', name: 'Spy vs. Spy', release_year: 1984, community_rating: 4.1, developer: 'First Star Software', platform_name: 'Arcade', overview: 'Black and white spies sabotage each other', max_players: 2 },
        { id: 'warlords', name: 'Warlords', release_year: 1980, community_rating: 4.4, developer: 'Atari', platform_name: 'Arcade', overview: 'Defend your castle while attacking others with fireballs', max_players: 2 },
        { id: 'wizard_of_wor', name: 'Wizard of Wor', release_year: 1981, community_rating: 4.0, developer: 'Midway', platform_name: 'Arcade', overview: 'Maze-based competitive dungeon crawler', max_players: 2 },
        { id: 'combat', name: 'Combat', release_year: 1977, community_rating: 3.9, developer: 'Atari', platform_name: 'Arcade', overview: 'Tank and biplane dogfight battles', max_players: 2 },
        { id: 'outlaw', name: 'Outlaw', release_year: 1976, community_rating: 3.8, developer: 'Atari', platform_name: 'Arcade', overview: 'Wild West gunfighter duels with obstacles', max_players: 2 },
        { id: 'surround', name: 'Surround', release_year: 1977, community_rating: 3.7, developer: 'Atari', platform_name: 'Arcade', overview: 'Tron-like light cycle competitive racing', max_players: 2 },
        { id: 'video_olympics', name: 'Video Olympics', release_year: 1977, community_rating: 3.8, developer: 'Atari', platform_name: 'Arcade', overview: 'Collection of competitive sports mini-games', max_players: 2 }
      ];
      setGames(fallbackGames);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchArcadeGames();
      setSelectedGames(new Set());
    }
  }, [isOpen]);

  const handleGameToggle = (gameName: string) => {
    const newSelected = new Set(selectedGames);
    if (newSelected.has(gameName)) {
      newSelected.delete(gameName);
    } else {
      newSelected.add(gameName);
    }
    setSelectedGames(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedGames.size === games.length) {
      setSelectedGames(new Set());
    } else {
      setSelectedGames(new Set(games.map(g => g.name)));
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col bg-gray-900 text-white border-white/20">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center text-xl font-bold text-white">
            <Gamepad2 className="w-6 h-6 mr-2" />
            Best Arcade 2-Player vs. Games (Non-Fighting)
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Browse the most comprehensive collection of competitive arcade versus games including soccer/football games (Virtua Striker, Super Sidekicks), racing (Virtua Racing, Daytona), puzzle battles (Puzzle Bobble, Tetris), classic arcade battles (Pong, Joust, Asteroids), and many more verified competitive 2-player games.
            These are suggestions only - manually copy any game names you want to use in your tournament.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col space-y-4">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading arcade games...</span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-400">
                  {selectedGames.size} of {games.length} games selected
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  {selectedGames.size === games.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="flex-1 overflow-auto space-y-2">
                {games.map((game) => (
                  <Card
                    key={game.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      selectedGames.has(game.name)
                        ? 'bg-green-900/50 border-green-500/50'
                        : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                    }`}
                    onClick={() => handleGameToggle(game.name)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-white truncate">{game.name}</h3>
                            <a
                              href={`https://gamesdb.launchbox-app.com/games/results/${encodeURIComponent(game.name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                              title={`Search for ${game.name} on LaunchBox Games Database`}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            {selectedGames.has(game.name) && (
                              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs">✓</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                            {game.release_year && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {game.release_year}
                              </div>
                            )}
                            {game.community_rating && (
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-500" />
                                {game.community_rating.toFixed(1)}
                              </div>
                            )}
                            {game.max_players && (
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {game.max_players} Players
                              </div>
                            )}
                          </div>

                          {game.developer && (
                            <div className="text-sm text-gray-500 mb-2">
                              by {game.developer}
                            </div>
                          )}

                          {game.overview && (
                            <p className="text-sm text-gray-300 line-clamp-2">
                              {game.overview}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          <div className="flex-shrink-0 flex flex-col justify-center gap-2 pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400 text-center mb-2">
              💡 Tip: Select game names and copy them manually to your tournament setup
            </p>
            <Button
              onClick={onClose}
              className="self-center bg-gray-600 hover:bg-gray-700 text-white"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};