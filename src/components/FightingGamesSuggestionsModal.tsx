import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Gamepad2, Star, Users, Calendar, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FightingGame {
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

interface FightingGamesSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGames: (gameNames: string[]) => void;
}

export const FightingGamesSuggestionsModal: React.FC<FightingGamesSuggestionsModalProps> = ({
  isOpen,
  onClose,
  onSelectGames
}) => {
  const [games, setGames] = useState<FightingGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchFightingGames = async () => {
    setLoading(true);
    try {
      // Get a larger pool of quality fighting games (50 games with rating >= 3.0)
      const { data, error } = await supabase
        .from('games_database')
        .select('*')
        .eq('platform_name', 'Arcade')
        .contains('genres', ['Fighting'])
        .gte('max_players', 2)
        .not('community_rating', 'is', null)
        .not('community_rating_count', 'is', null)
        .gte('community_rating', 3.0) // Lower threshold for more variety
        .gte('community_rating_count', 3) // At least 3 ratings for confidence
        .order('community_rating', { ascending: false })
        .limit(75); // Get larger pool

      if (error) throw error;

      // Weight games by composite score: rating * log(rating_count + 1)
      const allGames = (data || []).map(game => ({
        ...game,
        composite_score: (game.community_rating || 0) * Math.log((game.community_rating_count || 0) + 1)
      }));

      // Sort by composite score (higher is better)
      const sortedGames = allGames.sort((a, b) => b.composite_score - a.composite_score);

      // Create weighted random selection favoring higher scores
      const selectedGames = [];
      const availableGames = [...sortedGames];

      for (let i = 0; i < Math.min(30, availableGames.length); i++) {
        // Weight selection towards top games but allow randomness
        const maxIndex = Math.min(availableGames.length, 15 + i * 3); // Smaller pool for fighting games
        const randomIndex = Math.floor(Math.random() * maxIndex);
        selectedGames.push(availableGames[randomIndex]);
        availableGames.splice(randomIndex, 1);
      }

      setGames(selectedGames);
    } catch (error) {
      console.error('Error fetching fighting games:', error);
      toast({
        title: 'Error',
        description: 'Failed to load fighting games from database',
        variant: 'destructive'
      });

      // Fallback to hardcoded list of classic fighting games
      const fallbackGames: FightingGame[] = [
        { id: 'sf2', name: 'Street Fighter II', release_year: 1991, community_rating: 4.8, developer: 'Capcom', platform_name: 'Arcade', overview: 'The legendary fighting game that defined the genre', max_players: 2 },
        { id: 'mk', name: 'Mortal Kombat', release_year: 1992, community_rating: 4.6, developer: 'Midway', platform_name: 'Arcade', overview: 'Brutal fighting with iconic Fatalities', max_players: 2 },
        { id: 'tekken3', name: 'Tekken 3', release_year: 1998, community_rating: 4.9, developer: 'Namco', platform_name: 'Arcade', overview: '3D fighting at its finest', max_players: 2 },
        { id: 'kof98', name: 'The King of Fighters \'98', release_year: 1998, community_rating: 4.7, developer: 'SNK', platform_name: 'Arcade', overview: 'Team-based fighting perfection', max_players: 2 },
        { id: 'sf3_3s', name: 'Street Fighter III: 3rd Strike', release_year: 1999, community_rating: 4.8, developer: 'Capcom', platform_name: 'Arcade', overview: 'The pinnacle of 2D fighting games', max_players: 2 },
        { id: 'ggx', name: 'Guilty Gear X', release_year: 2000, community_rating: 4.5, developer: 'Arc System Works', platform_name: 'Arcade', overview: 'Rock-and-roll fighting with incredible style', max_players: 2 },
        { id: 'mvc2', name: 'Marvel vs. Capcom 2', release_year: 2000, community_rating: 4.7, developer: 'Capcom', platform_name: 'Arcade', overview: '3-on-3 tag team fighting mayhem', max_players: 2 },
        { id: 'darkstalkers', name: 'Darkstalkers: The Night Warriors', release_year: 1994, community_rating: 4.4, developer: 'Capcom', platform_name: 'Arcade', overview: 'Horror-themed fighting with unique characters', max_players: 2 },
        { id: 'samsho2', name: 'Samurai Shodown II', release_year: 1994, community_rating: 4.6, developer: 'SNK', platform_name: 'Arcade', overview: 'Weapon-based fighting in feudal Japan', max_players: 2 },
        { id: 'vf2', name: 'Virtua Fighter 2', release_year: 1994, community_rating: 4.5, developer: 'Sega', platform_name: 'Arcade', overview: 'Realistic 3D fighting simulation', max_players: 2 }
      ];
      setGames(fallbackGames);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFightingGames();
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

  const handleUseSelected = () => {
    if (selectedGames.size === 0) {
      toast({
        title: 'No games selected',
        description: 'Please select at least one fighting game',
        variant: 'destructive'
      });
      return;
    }

    onSelectGames(Array.from(selectedGames));
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col bg-gray-900 text-white border-white/20">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center text-xl font-bold text-white">
            <Gamepad2 className="w-6 h-6 mr-2" />
            Best Arcade 2-Player Fighting Games
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Select from 30 of the greatest arcade 2-player versus fighting games ever made, curated from our game database.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col space-y-4">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading fighting games...</span>
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
                        ? 'bg-blue-900/50 border-blue-500/50'
                        : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                    }`}
                    onClick={() => handleGameToggle(game.name)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-white truncate">{game.name}</h3>
                            {game.launchbox_id && (
                              <a
                                href={`https://gamesdb.launchbox-app.com/games/details/${game.launchbox_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            {selectedGames.has(game.name) && (
                              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
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

          <div className="flex-shrink-0 flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-gray-700">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUseSelected}
              disabled={selectedGames.size === 0 || loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Use Selected Games ({selectedGames.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};