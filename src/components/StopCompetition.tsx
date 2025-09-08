import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface StopCompetitionProps {
  onCompetitionStopped?: () => void;
  refreshTrigger?: number; // When this changes, refresh the games check
}

const StopCompetition: React.FC<StopCompetitionProps> = ({ onCompetitionStopped, refreshTrigger }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGames, setHasGames] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  // Check if there are any games in the highscore table
  useEffect(() => {
    const checkForGames = async () => {
      try {
        const { data, error } = await supabase
          .from('games')
          .select('id')
          .eq('include_in_challenge', true)
          .limit(1);

        if (error) {
          console.error('Error checking for games:', error);
          return;
        }

        setHasGames(data && data.length > 0);
      } catch (error) {
        console.error('Error checking for games:', error);
      }
    };

    checkForGames();
  }, [refreshTrigger]);

  const handleStopCompetition = async () => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only administrators can stop competitions.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Call the archive function
      const { data, error } = await supabase.rpc('archive_current_competition');

      if (error) {
        console.error('Error archiving competition:', error);
        throw error;
      }

      if (data && data.success) {
        toast({
          title: "Competition Archived!",
          description: `Competition "${data.competition_name}" has been successfully archived. ${data.total_players} players, ${data.total_games} games, ${data.total_scores} scores saved.`,
        });

        setIsOpen(false);
        setHasGames(false); // Hide button since games will be cleared
        onCompetitionStopped?.();
      } else if (data && data.error) {
        throw new Error(data.error);
      } else {
        throw new Error('Failed to archive competition - no data returned');
      }
    } catch (error) {
      console.error('Error stopping competition:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Error",
        description: `Failed to stop competition: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin || !hasGames) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-red-600 hover:bg-red-700 text-white border-red-500">
          Stop Competition
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-900 text-white border-white/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-400 text-xl">
            Stop Current Competition
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-gray-300">
            This will archive the current competition and save all data for historical analysis. 
            All current scores will be cleared to start fresh.
          </p>
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-yellow-200 text-sm font-semibold">
              Warning: This action cannot be undone!
            </p>
            <p className="text-yellow-100 text-xs mt-1">
              All current scores will be deleted, but historical data will be preserved.
            </p>
          </div>
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
            <p className="text-blue-200 text-sm font-semibold">
              What will be saved:
            </p>
            <ul className="text-blue-100 text-xs mt-1 list-disc list-inside">
              <li>All player names and scores</li>
              <li>Game information and rankings</li>
              <li>Competition statistics</li>
              <li>Historical data for analysis</li>
            </ul>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={handleStopCompetition}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 text-white flex-1"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Archiving...</span>
                </div>
              ) : (
                'Stop Competition'
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

export default StopCompetition;
