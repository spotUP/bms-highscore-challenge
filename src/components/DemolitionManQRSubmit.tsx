import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Zap, RefreshCw, ExternalLink } from 'lucide-react';
import { getCardStyle, getTypographyStyle } from '@/utils/designSystem';

const DemolitionManQRSubmit = () => {
  const { toast } = useToast();
  const [qrUrl, setQrUrl] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [score, setScore] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demolitionManGameId, setDemolitionManGameId] = useState<string | null>(null);

  // Get the current URL for QR code generation
  useEffect(() => {
    const baseUrl = window.location.origin;
    const qrSubmitUrl = `${baseUrl}/demolition-man-submit`;
    setQrUrl(qrSubmitUrl);
  }, []);

  // Find Standing Competition game ID
  useEffect(() => {
    const findOrCreateDemolitionManGame = async () => {
      try {
        // First try to find existing game
        const { data: games, error } = await supabase
          .from('games')
          .select('id, name')
          .eq('name', 'Standing Competition')
          .single();

        if (games && !error) {
          setDemolitionManGameId(games.id);
          return;
        }

        // If not found, we can't create it without the function
        console.log('Standing Competition game not found in database');
        setDemolitionManGameId(null);
        return;

      } catch (error) {
        console.error('Error with Standing Competition game setup:', error);
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
        description: "Standing Competition game needs to be added to the database first. Please contact an admin.",
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
        title: "Score Submitted!",
        description: `${playerName}'s score of ${Number(score).toLocaleString()} has been submitted to the Standing Competition eternal leaderboard!`,
      });

      // Clear form
      setPlayerName('');
      setScore('');
      
      // No page refresh needed - parent will handle data updates
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
    <Card className={getCardStyle('primary')}>
      <CardHeader>
        <CardTitle className={getTypographyStyle('h3') + " flex items-center gap-2"}>
          <Zap className="w-5 h-5 text-red-500" />
          Standing Competition QR Submit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code Section */}
        <div className="text-center space-y-4">
          <div className="bg-white p-4 rounded-lg inline-block">
            <QRCodeSVG 
              value={qrUrl}
              size={200}
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="M"
              includeMargin={true}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-400">
              Scan this QR code to quickly submit Standing Competition scores
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <ExternalLink className="w-3 h-3" />
              <span className="font-mono break-all">{qrUrl}</span>
            </div>
          </div>
        </div>

        <hr className="border-white/20" />

        {/* Manual Submit Section */}
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-white">Quick Submit</h4>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="playerName" className="text-white">Player Name</Label>
              <Input
                id="playerName"
                type="text"
                placeholder="Enter player name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={handleKeyPress}
                className="bg-black/50 border-white/20 text-white placeholder:text-gray-400"
              />
            </div>

            <div>
              <Label htmlFor="score" className="text-white">Score</Label>
              <Input
                id="score"
                type="number"
                placeholder="Enter score"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                onKeyPress={handleKeyPress}
                className="bg-black/50 border-white/20 text-white placeholder:text-gray-400"
                min="0"
              />
            </div>

            <Button
              onClick={handleSubmitScore}
              disabled={isSubmitting || !demolitionManGameId}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {isSubmitting ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Submit to Eternal Leaderboard
            </Button>

            {!demolitionManGameId && (
              <p className="text-xs text-amber-400 text-center">
                ⚠️ Standing Competition game needs to be added to the database first
              </p>
            )}
          </div>
        </div>

        {/* Standing Competition Header */}
        <div className="text-center">
          <img 
            src="https://images.launchbox-app.com/c84bf29b-1b54-4310-9290-9b52f587f442.png"
            alt="Standing Competition"
            className="w-full max-w-sm h-auto mx-auto rounded-lg"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default DemolitionManQRSubmit;
