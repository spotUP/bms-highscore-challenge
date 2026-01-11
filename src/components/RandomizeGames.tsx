import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import misterGames from '@/data/mister-games.json';

interface RandomizeGamesProps {
  onGamesUpdated?: () => void;
}

const RandomizeGames: React.FC<RandomizeGamesProps> = ({ onGamesUpdated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [excludeUsedGames, setExcludeUsedGames] = useState(true);
  const { toast } = useToast();

  const handleRandomizeGames = async () => {
    setIsLoading(true);
    
    try {
      // Check if user is authenticated and has admin role
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to randomize games",
          variant: "destructive",
        });
        return;
      }
      
      // Check if user has admin role
      const { data: userRoles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin');
      
      if (roleError || !userRoles || userRoles.length === 0) {
        toast({
          title: "Admin Access Required",
          description: "Only administrators can randomize games",
          variant: "destructive",
        });
        return;
      }
      
      let availableGames = misterGames;

      // Only exclude used games if the switch is enabled
      if (excludeUsedGames) {
        // Get list of previously used games from competition history
        const { data: previousGames, error: previousGamesError } = await supabase
          .from('competition_games')
          .select('game_name');

        if (previousGamesError) {
          console.error('Error fetching previous games:', previousGamesError);
          toast({
            title: "Error",
            description: `Failed to fetch previous games: ${previousGamesError.message}`,
            variant: "destructive",
          });
          return;
        }

        // Create a set of previously used game names for efficient lookup
        const usedGameNames = new Set(previousGames?.map(g => g.game_name) || []);

        // Filter out previously used games from the MiSTer games list
        availableGames = misterGames.filter(game => !usedGameNames.has(game.name));

        // Check if we have enough games available
        if (availableGames.length < 5) {
          toast({
            title: "Not Enough Games Available",
            description: `Only ${availableGames.length} games haven't been used in previous competitions. Need at least 5 games to randomize. Try disabling "Exclude previously used games" option.`,
            variant: "destructive",
          });
          return;
        }
      }

      // Check if we have enough games available
      if (availableGames.length < 5) {
        toast({
          title: "Not Enough Games Available",
          description: `Only ${availableGames.length} games available in the MiSTer collection. Need at least 5 games to randomize.`,
          variant: "destructive",
        });
        return;
      }

      // Select 5 random games from the available games list
      const shuffled = [...availableGames].sort(() => 0.5 - Math.random());
      const selectedGames = shuffled.slice(0, 5);
      
      console.log('Selected games:', selectedGames);
      
      // First, get all existing scores to delete them individually
      const { data: existingScores, error: fetchError } = await supabase
        .from('scores')
        .select('id');
      
      if (fetchError) {
        console.error('Error fetching scores:', fetchError);
        toast({
          title: "Error",
          description: `Failed to fetch existing scores: ${fetchError.message}`,
          variant: "destructive",
        });
        return;
      }
      
      console.log('Found scores to delete:', existingScores?.length || 0);
      
      // Delete scores one by one if there are any
      if (existingScores && existingScores.length > 0) {
        const deletePromises = existingScores.map(score => 
          supabase.from('scores').delete().eq('id', score.id)
        );
        
        const deleteResults = await Promise.all(deletePromises);
        const hasDeleteErrors = deleteResults.some(result => result.error);
        
        if (hasDeleteErrors) {
          console.error('Error deleting scores:', deleteResults);
          toast({
            title: "Error",
            description: "Failed to clear some existing scores. You may need admin permissions.",
            variant: "destructive",
          });
          return;
        }
        
        console.log('Successfully deleted all scores');
      }
      
      // Get current games to update them
      const { data: currentGames, error: gamesError } = await supabase
        .from('games')
        .select('id')
        .order('created_at', { ascending: true });
      
      if (gamesError) {
        console.error('Error fetching current games:', gamesError);
        toast({
          title: "Error",
          description: "Failed to fetch current games",
          variant: "destructive",
        });
        return;
      }
      
      console.log('Found games to update:', currentGames?.length || 0);
      
      // Update existing games with new random games
      const updatePromises = currentGames.map(async (game, index) => {
        const selectedGame = selectedGames[index];
        if (!selectedGame) return Promise.resolve();
        
        // No legacy logo handling - let the clear logo service handle this
        const logoUrl = null;
        
        return supabase
          .from('games')
          .update({
            name: selectedGame.name,
            logo_url: logoUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', game.id);
      });
      
      const updateResults = await Promise.all(updatePromises);
      
      // Check for any update errors
      const hasErrors = updateResults.some(result => result && 'error' in result && result.error);
      if (hasErrors) {
        console.error('Error updating games:', updateResults);
        toast({
          title: "Error",
          description: "Failed to update some games",
          variant: "destructive",
        });
        return;
      }
      
      // Success!
      const newGameNames = selectedGames.map(game => game.name);

      const exclusionText = excludeUsedGames ? " (excluding previously used games)" : " (including all games)";

      toast({
        title: "Games Randomized!",
        description: `New games selected${exclusionText}: ${newGameNames.join(', ')}. Use Competition Manager to start the competition.`,
      });

      // Games are now ready for competition - use Competition Manager to start
      
      // Close dialog and notify parent component
      setIsOpen(false);
      onGamesUpdated?.();
      
    } catch (error) {
      console.error('Error randomizing games:', error);
      toast({
        title: "Error",
        description: "Failed to randomize games. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-red-600 hover:bg-red-700 text-white border-red-500">
          Randomize Games
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-900 text-white border-white/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-arcade-neonYellow text-xl">
            Randomize Games
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-gray-300">
            This will randomly select 5 new games from the MiSTer arcade cores collection
            and replace the current games in your highscore challenge. High-quality local game logos will be used when available.
          </p>

          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="exclude-used-games" className="text-sm font-medium text-gray-300">
              Exclude previously used games
            </Label>
            <Switch
              id="exclude-used-games"
              checked={excludeUsedGames}
              onCheckedChange={setExcludeUsedGames}
            />
          </div>

          <p className="text-gray-400 text-xs">
            {excludeUsedGames
              ? "Only games that haven't been used in previous competitions will be selected."
              : "All games from the collection are available for selection, including previously used ones."
            }
          </p>

          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-yellow-200 text-sm font-semibold">
              ⚠️ Warning: This will clear all existing scores!
            </p>
            <p className="text-yellow-100 text-xs mt-1">
              All current high scores will be deleted when you randomize the games.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={handleRandomizeGames}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 text-white flex-1"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Randomizing...</span>
                </div>
              ) : (
                'Randomize Games'
              )}
            </Button>
            
            <Button
              onClick={() => setIsOpen(false)}
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-black flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RandomizeGames;
