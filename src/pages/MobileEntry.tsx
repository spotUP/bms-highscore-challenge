import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAchievements } from "@/hooks/useAchievements";
import { getGameLogoUrl } from "@/lib/utils";
import PlayerInsult from "@/components/PlayerInsult";
import { useTournament } from "@/contexts/TournamentContext";
import { reportSubmissionFailure } from "@/utils/submissionMonitoring";
// import pacmanLogo from "@/assets/pacman-logo.png";
// import spaceInvadersLogo from "@/assets/space-invaders-logo.png";
// import tetrisLogo from "@/assets/tetris-logo.png";
// import donkeyKongLogo from "@/assets/donkey-kong-logo.png";
import { getPageLayout, getCardStyle, getButtonStyle, getTypographyStyle, PageHeader, PageContainer } from "@/utils/designSystem";

// Fallback logo mapping for backwards compatibility
// const LOGO_MAP: Record<string, string> = {
//   "pacman": pacmanLogo,
//   "pac-man": pacmanLogo,
//   "spaceinvaders": spaceInvadersLogo,
//   "space invaders": spaceInvadersLogo,
//   "tetris": tetrisLogo,
//   "donkeykong": donkeyKongLogo,
//   "donkey kong": donkeyKongLogo,
// };

interface Game {
  id: string;
  name: string;
  logo_url: string | null;
}

const MobileEntry = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gameId = searchParams.get("game");
  const [name, setName] = useState("");
  const [score, setScore] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlayerInsult, setShowPlayerInsult] = useState(false);
  const [insultPlayerName, setInsultPlayerName] = useState('');
  const { checkForNewAchievements } = useAchievements();
  const { currentTournament } = useTournament();

  // Load game from database
  useEffect(() => {
    const loadGame = async () => {
      if (!gameId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();

        if (error) throw error;
        setGame(data);
      } catch (error) {
        console.error('Error loading game:', error);
        setGame(null);
        // If game is not found or not in challenge, redirect to main page
        if (error.code === 'PGRST116') {
          toast.error("This game is no longer available for score submission.");
          setTimeout(() => navigate("/"), 2000);
        }
      } finally {
        setLoading(false);
      }
    };

    loadGame();
  }, [gameId]);

  // Remove annoying loading screen - show content immediately
  // if (loading) {
  //   return (
  //     <div className="min-h-screen text-white p-4 flex items-center justify-center relative z-10"
  //          style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
  //       <div className="text-center">
  //         <div className="text-xl">Loading...</div>
  //       </div>
  //     </div>
  //   );
  // }

  if (!game) {
    return (
      <div className="min-h-screen text-white p-4 flex items-center justify-center relative z-10"
           style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-arcade-neonPink mb-4">Invalid Game</h1>
          <p className="text-gray-400">Game not found.</p>
        </div>
      </div>
    );
  }

  // Get logo URL - convert local paths to Supabase Storage URLs
  const logoUrl = getGameLogoUrl(game.logo_url);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !score || !game) {
      toast.error("Please fill in all fields");
      return;
    }

    const scoreValue = parseInt(score);
    if (isNaN(scoreValue) || scoreValue <= 0 || scoreValue > 999999999) {
      toast.error("Please enter a valid score (1-999,999,999)");
      return;
    }

    if (name.trim().length > 16) {
      toast.error("Player name must be 16 characters or less");
      return;
    }

    if (!currentTournament) {
      toast.error("No tournament selected. Please select a tournament first.");
      setIsSubmitting(false);
      return;
    }

    // Check if score submissions are locked for this tournament
    if (currentTournament.scores_locked) {
      toast.error("Score submissions are currently locked for this tournament.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);

    // Get current user for user_id field
    const { data: { user } } = await supabase.auth.getUser();

    try {
      console.log('MobileEntry: Starting score submission for', name, 'score:', scoreValue);

      // First check if player already has a score for this game
      const { data: existingScore, error: fetchError } = await supabase
        .from('scores')
        .select('*')
        .eq('player_name', name.toUpperCase())
        .eq('game_id', game.id)
        .maybeSingle();

      if (fetchError) {
        console.error('MobileEntry: Error checking existing score:', fetchError);
        throw fetchError;
      }

      console.log('MobileEntry: Existing score check result:', existingScore);

      let isHighScore = false;
      let previousHighScore = null;

      if (existingScore) {
        // Player already has a score for this game
        if (scoreValue <= existingScore.score) {
          toast.error(`Your current best score for ${game.name} is ${existingScore.score.toLocaleString()}. Submit a higher score to improve your record.`);
          setIsSubmitting(false);
          return;
        }
        
        // Update existing score with higher score
        const { error } = await supabase
          .from('scores')
          .update({
            score: scoreValue,
            updated_at: new Date().toISOString(),
            user_id: user?.id || null
          })
          .eq('id', existingScore.id);

        if (error) throw error;

        isHighScore = true;
        previousHighScore = existingScore.score;

        // Post to webhook via edge function for score improvement
        try {
          await supabase.functions.invoke('send-score-webhook', {
            body: {
              player_name: name.toUpperCase(),
              score: scoreValue,
              game_name: game.name,
              game_id: game.id,
              type: 'score_improved',
              previous_score: existingScore.score,
              timestamp: new Date().toISOString()
            }
          });
        } catch (webhookError) {
          console.error('Webhook call failed:', webhookError);
        }

        toast.success(`Score improved! New best: ${scoreValue.toLocaleString()} (previous: ${existingScore.score.toLocaleString()})`);
      } else {
        // Insert new score for this player/game combination
        const { error } = await supabase
          .from('scores')
          .insert({
            player_name: name.toUpperCase(),
            score: scoreValue,
            game_id: game.id,
            tournament_id: currentTournament?.id,
            user_id: user?.id || null
          });

        if (error) throw error;

        isHighScore = true;
        
        // Post to webhook via edge function for new score
        try {
          await supabase.functions.invoke('send-score-webhook', {
            body: {
              player_name: name.toUpperCase(),
              score: scoreValue,
              game_name: game.name,
              game_id: game.id,
              type: 'new_score',
              timestamp: new Date().toISOString()
            }
          });
        } catch (webhookError) {
          console.error('Webhook call failed:', webhookError);
        }
        
        toast.success(`New score recorded: ${scoreValue.toLocaleString()}`);
      }

      // Record the score submission for real-time notifications
      console.log('MobileEntry: Recording score submission for realtime:', {
        player_name: name.toUpperCase(),
        score: scoreValue,
        game_id: game.id,
        tournament_id: currentTournament?.id,
        is_high_score: isHighScore,
        previous_high_score: previousHighScore
      });
      
      const { error: submissionError } = await supabase
        .from('score_submissions')
        .insert({
          player_name: name.toUpperCase(),
          score: scoreValue,
          game_id: game.id,
          tournament_id: currentTournament?.id,
          is_high_score: isHighScore,
          previous_high_score: previousHighScore
        });
        
      if (submissionError) {
        console.error('MobileEntry: Error recording score submission:', submissionError);
      } else {
        console.log('MobileEntry: Score submission recorded successfully');
      }
      
      // Show message for all players
      setInsultPlayerName(name.trim());
      setShowPlayerInsult(true);
      
      // Reset form
      setName("");
      setScore("");
      
      // Check for new achievements after a short delay to allow database triggers to complete
      setTimeout(() => {
        checkForNewAchievements(name);
      }, 1000);
      
    } catch (error: any) {
      console.error('MobileEntry: Error submitting score:', error);
      console.error('MobileEntry: Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });

      // Report submission failure for monitoring
      await reportSubmissionFailure({
        playerName: name,
        score: scoreValue,
        gameName: game?.name || 'Unknown Game',
        error: error.message || 'Unknown error',
        userAgent: navigator.userAgent,
        location: 'mobile'
      });

      toast.error(`Failed to submit score: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pageLayout = getPageLayout();
  
  return (
    <>
      <PlayerInsult
        isVisible={showPlayerInsult}
        playerName={insultPlayerName}
        onComplete={() => {
          setShowPlayerInsult(false);
          // Navigate back after modal completes
          setTimeout(() => {
            navigate("/", { replace: true });
          }, 1000);
        }}
      />
      <div {...pageLayout}>
        <PageContainer className="max-w-md mx-auto space-y-3 pt-8">
          <div className="text-center">
            <h1 className={getTypographyStyle('h2') + " mb-1"}>
              Submit Score
            </h1>
          <div className="flex justify-center">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={game.name} 
                className="h-24 w-auto object-contain"
              />
            ) : (
              <div className="h-24 flex items-center justify-center bg-black/30 rounded-lg px-4">
                <span className="text-white font-bold">{game.name}</span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-black/20 rounded-lg backdrop-blur-sm">
          <div className="flex items-center gap-2 justify-center mb-4">
            <Trophy className="animate-glow text-arcade-neonYellow" />
            <span className="text-lg font-semibold">Enter Your Score</span>
          </div>
          
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Player Name (max 16 characters)"
              value={name}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= 16) {
                  setName(value);
                }
              }}
              maxLength={16}
              className="bg-black/30 border-arcade-neonCyan text-white text-center text-lg"
              autoFocus
            />
            <Input
              type="number"
              placeholder="Score (1-999,999,999)"
              value={score}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                if (value <= 999999999) {
                  setScore(e.target.value);
                }
              }}
              min="1"
              max="999999999"
              className="bg-black/30 border-arcade-neonPink text-white text-center text-lg"
            />
            <Button 
              type="submit"
              variant="outline"
              className="w-full text-lg py-3"
              disabled={!name || !score || isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Score"}
            </Button>
          </div>
        </form>

        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="border-arcade-neonCyan text-arcade-neonCyan hover:bg-arcade-neonCyan hover:text-black"
          >
            Back to Leaderboard
          </Button>
        </div>
        </PageContainer>
      </div>
    </>
  );
};

export default MobileEntry;