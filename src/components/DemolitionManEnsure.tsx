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
        .eq('name', 'Standing Competition')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

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
      // Create Standing Competition game manually since the function doesn't exist in types
      const { data: existingGame, error: findError } = await supabase
        .from('games')
        .select('id')
        .eq('name', 'Standing Competition')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      let gameId;
      
      if (existingGame && !findError) {
        gameId = existingGame.id;
      } else {
        // Game doesn't exist, create it
        const { data: newGame, error: createError } = await supabase
          .from('games')
          .insert({
            name: 'Standing Competition',
            is_active: true
          })
          .select('id')
          .single();

        if (createError || !newGame) {
          throw new Error('Failed to create Standing Competition game: ' + (createError?.message || 'Unknown error'));
        }

        gameId = newGame.id;
      }


      setGameExists(true);
      const action = existingGame ? 'verified' : 'created';
      toast({
        title: "Success!",
        description: `Standing Competition game ${action} successfully (ID: ${gameId})`,
      });

    } catch (error: any) {
      console.error('Error ensuring Standing Competition game:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to ensure Standing Competition game exists",
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
          Standing Competition Eternal Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-300">
            Ensure the Standing Competition game exists in the database for the eternal leaderboard
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
          The Standing Competition game will be automatically created when needed, but you can manually ensure it exists here.
        </div>
      </CardContent>
    </Card>
  );
};

export default DemolitionManEnsure;
