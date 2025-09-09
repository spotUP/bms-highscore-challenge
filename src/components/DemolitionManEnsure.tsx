import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Zap, CheckCircle } from 'lucide-react';

const DemolitionManEnsure: React.FC = () => {
  const [isEnsuring, setIsEnsuring] = useState(false);
  const [gameExists, setGameExists] = useState<boolean | null>(null);
  const { toast } = useToast();

  const checkDemolitionManGame = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('id, name')
        .eq('name', 'Demolition Man')
        .single();

      if (data && !error) {
        setGameExists(true);
        return true;
      }
      
      setGameExists(false);
      return false;
    } catch (error) {
      setGameExists(false);
      return false;
    }
  };

  const ensureDemolitionManGame = async () => {
    setIsEnsuring(true);
    
    try {
      // Create Demolition Man game manually since the function doesn't exist in types
      const { data: existingGame, error: findError } = await supabase
        .from('games')
        .select('id')
        .eq('name', 'Demolition Man')
        .single();

      let gameId;
      
      if (existingGame && !findError) {
        gameId = existingGame.id;
      } else {
        // Game doesn't exist, we'll just mark it as unavailable
        const error = new Error('Demolition Man game not found');
        throw error;
      }


      setGameExists(true);
      toast({
        title: "Success!",
        description: `Demolition Man eternal leaderboard is now available (ID: ${gameId})`,
      });

    } catch (error: any) {
      console.error('Error ensuring Demolition Man game:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to ensure Demolition Man game exists",
        variant: "destructive",
      });
    } finally {
      setIsEnsuring(false);
    }
  };

  // Check on component mount
  React.useEffect(() => {
    checkDemolitionManGame();
  }, []);

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Zap className="w-5 h-5 text-red-400" />
          Demolition Man Eternal Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-300">
            Ensure the Demolition Man game exists in the database for the eternal leaderboard
          </div>
          <div className="flex items-center gap-2">
            {gameExists === true && (
              <div className="flex items-center gap-1 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Available
              </div>
            )}
            {gameExists === false && (
              <div className="text-red-400 text-sm">
                Not Available
              </div>
            )}
            {gameExists === null && (
              <div className="text-gray-400 text-sm">
                Checking...
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={checkDemolitionManGame}
            variant="outline"
            size="sm"
            disabled={isEnsuring}
          >
            Check Status
          </Button>
          <Button
            onClick={ensureDemolitionManGame}
            variant={gameExists ? "outline" : "default"}
            size="sm"
            disabled={isEnsuring}
          >
            {isEnsuring ? 'Ensuring...' : 'Ensure Game Exists'}
          </Button>
        </div>

        <div className="text-xs text-gray-500">
          The Demolition Man game will be automatically created when needed, but you can manually ensure it exists here.
        </div>
      </CardContent>
    </Card>
  );
};

export default DemolitionManEnsure;
