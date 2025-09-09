import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Zap, RefreshCw, ArrowLeft, Trophy } from 'lucide-react';
import DemolitionManLeaderboard from '@/components/DemolitionManLeaderboard';

const DemolitionManSubmit = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [score, setScore] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demolitionManGameId, setDemolitionManGameId] = useState<string | null>(null);

  // Find or create Demolition Man game ID
  useEffect(() => {
    const findOrCreateDemolitionManGame = async () => {
      try {
        // First try to find existing game
        const { data: games, error } = await supabase
          .from('games')
          .select('id, name')
          .eq('name', 'Demolition Man')
          .single();

        if (games && !error) {
          setDemolitionManGameId(games.id);
          return;
        }

        // If not found, try to call the function to ensure it exists
        const { data: gameId, error: createError } = await supabase
          .rpc('ensure_demolition_man_game');

        if (createError) {
          console.error('Error ensuring Demolition Man game exists:', createError);
          console.log('The ensure_demolition_man_game function may not be deployed yet');
          // Still set to null so user gets helpful error message
          setDemolitionManGameId(null);
          return;
        }

        setDemolitionManGameId(gameId);
        console.log('Demolition Man game ensured in database with ID:', gameId);
      } catch (error) {
        console.error('Error with Demolition Man game setup:', error);
      }
    };

    findOrCreateDemolitionManGame();
  }, []);

  const handleSubmitScore = async () => {
    if (!playerName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a player name.",
        variant: "destructive",
      });
      return;
    }

    if (!score.trim() || isNaN(Number(score)) || Number(score) < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid score.",
        variant: "destructive",
      });
      return;
    }

    if (!demolitionManGameId) {
      toast({
        title: "⚠️ Setup Required",
        description: "Demolition Man game needs to be added to the database first. Please contact an admin.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('scores')
        .insert({
          player_name: playerName.trim().toUpperCase(),
          score: Number(score),
          game_id: demolitionManGameId,
          tournament_id: demolitionManGameId, // Use game_id as tournament_id for eternal leaderboard
        });

      if (error) throw error;

      toast({
        title: "🏆 Score Submitted!",
        description: `${playerName}'s score of ${Number(score).toLocaleString()} has been added to the Demolition Man eternal leaderboard!`,
      });

      // Clear form
      setPlayerName('');
      setScore('');

      // Redirect to main page after 2 seconds
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);
    } catch (error: any) {
      console.error('Error submitting score:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit score. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmitScore();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-arcade-darkBlue via-black to-arcade-darkPurple p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-white hover:text-arcade-neonCyan"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Main
          </Button>
          <h1 className="text-3xl font-bold text-white">🔥 Demolition Man</h1>
          <div></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Submission Form */}
        <div className="flex items-center justify-center">
          <div className="w-full max-w-md">
        <Card className="bg-black/30 border-white/15 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex flex-col items-center gap-4">
              {/* Demolition Man Logo */}
              <img 
                src="https://images.launchbox-app.com/c84bf29b-1b54-4310-9290-9b52f587f442.png"
                alt="Demolition Man"
                className="w-64 h-auto rounded-lg"
              />
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span>Submit Your Score</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="playerName" className="text-white">Player Name</Label>
                <Input
                  id="playerName"
                  type="text"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="bg-black/50 border-white/20 text-white placeholder:text-gray-400 text-lg"
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="score" className="text-white">Score</Label>
                <Input
                  id="score"
                  type="number"
                  placeholder="Enter your score"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="bg-black/50 border-white/20 text-white placeholder:text-gray-400 text-lg"
                  min="0"
                />
              </div>

              <Button
                onClick={handleSubmitScore}
                disabled={isSubmitting || !demolitionManGameId}
                className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-lg"
              >
                {isSubmitting ? (
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-5 w-5" />
                )}
                Submit to Eternal Leaderboard
              </Button>

              {!demolitionManGameId && (
                <div className="text-amber-400 text-center p-3 bg-amber-400/10 rounded-lg border border-amber-400/30">
                  <p className="text-sm">
                    ⚠️ Demolition Man game needs to be added to the database first
                  </p>
                </div>
              )}
            </div>

            <hr className="border-white/20" />

            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Main Page
            </Button>

            <div className="text-center text-xs text-gray-500">
              Scan QR code or visit directly to submit scores quickly
            </div>
          </CardContent>
        </Card>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="flex items-stretch">
          <DemolitionManLeaderboard />
        </div>
      </div>
    </div>
  );
};

export default DemolitionManSubmit;
