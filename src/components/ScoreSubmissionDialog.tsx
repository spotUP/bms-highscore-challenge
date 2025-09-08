import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAchievements } from "@/hooks/useAchievements";
import { getGameLogoUrl } from "@/lib/utils";
import PlayerInsult from "./PlayerInsult";

interface Game {
  id: string;
  name: string;
  logo_url: string | null;
}

interface ScoreSubmissionDialogProps {
  game: Game | null;
  isOpen: boolean;
  onClose: () => void;
  onScoreSubmitted: () => void;
}

const ScoreSubmissionDialog = ({ game, isOpen, onClose, onScoreSubmitted }: ScoreSubmissionDialogProps) => {
  const [name, setName] = useState("");
  const [score, setScore] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPlayerInsult, setShowPlayerInsult] = useState(false);
  const [insultPlayerName, setInsultPlayerName] = useState('');
  const { toast } = useToast();
  const { checkForNewAchievements } = useAchievements();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !score || !game) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
      toast({
        title: "Error",
        description: "Player name must be 50 characters or less",
        variant: "destructive"
      });
      return;
    }

    const scoreValue = parseInt(score);
    if (isNaN(scoreValue) || scoreValue <= 0 || scoreValue > 999999999) {
      toast({
        title: "Error",
        description: "Please enter a valid score (1-999,999,999)",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // First check if player already has a score for this game
      const { data: existingScore, error: fetchError } = await supabase
        .from('scores')
        .select('*')
        .eq('player_name', trimmedName.toUpperCase())
        .eq('game_id', game.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      if (existingScore) {
        // Player already has a score for this game
        if (scoreValue <= existingScore.score) {
          toast({
            title: "Score Not Improved",
            description: `Your current best score for ${game.name} is ${existingScore.score.toLocaleString()}. Submit a higher score to improve your record.`,
            variant: "destructive"
          });
          setIsSubmitting(false);
          return;
        }
        
        // Update existing score with higher score
        const { error } = await supabase
          .from('scores')
          .update({
            score: scoreValue,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingScore.id);

        if (error) throw error;

        // Post to webhook via edge function for score improvement
        try {
          console.log('🚀 Calling webhook for score improvement:', {
            player_name: trimmedName.toUpperCase(),
            score: scoreValue,
            game_name: game.name,
            game_id: game.id,
            type: 'score_improved',
            previous_score: existingScore.score
          });
          
          const webhookResponse = await supabase.functions.invoke('send-score-webhook', {
            body: {
              player_name: trimmedName.toUpperCase(),
              score: scoreValue,
              game_name: game.name,
              game_id: game.id,
              type: 'score_improved',
              previous_score: existingScore.score,
              timestamp: new Date().toISOString()
            }
          });
          
          if (webhookResponse.error) {
            console.error('❌ Webhook error:', webhookResponse.error);
          } else {
            console.log('✅ Webhook sent successfully:', webhookResponse.data);
            console.log('📊 Full webhook response:', webhookResponse);
          }
        } catch (webhookError) {
          console.error('❌ Webhook call failed:', webhookError);
        }

        toast({
          title: "Score Improved!",
          description: `New best score for ${game.name}: ${scoreValue.toLocaleString()} (previous: ${existingScore.score.toLocaleString()})`
        });

        // Show message for all players
        setInsultPlayerName(trimmedName);
        setShowPlayerInsult(true);
      } else {
        // Insert new score for this player/game combination
        const { error } = await supabase
          .from('scores')
          .insert({
            player_name: trimmedName.toUpperCase(),
            score: scoreValue,
            game_id: game.id
          });

        if (error) throw error;
        
        // Post to webhook via edge function for new score
        try {
          console.log('🚀 Calling webhook for new score:', {
            player_name: trimmedName.toUpperCase(),
            score: scoreValue,
            game_name: game.name,
            game_id: game.id,
            type: 'new_score'
          });
          
          const webhookResponse = await supabase.functions.invoke('send-score-webhook', {
            body: {
              player_name: trimmedName.toUpperCase(),
              score: scoreValue,
              game_name: game.name,
              game_id: game.id,
              type: 'new_score',
              timestamp: new Date().toISOString()
            }
          });
          
          if (webhookResponse.error) {
            console.error('❌ Webhook error:', webhookResponse.error);
          } else {
            console.log('✅ Webhook sent successfully:', webhookResponse.data);
            console.log('📊 Full webhook response:', webhookResponse);
          }
        } catch (webhookError) {
          console.error('❌ Webhook call failed:', webhookError);
        }
        
        toast({
          title: "New Score Recorded!",
          description: `First score for ${game.name}: ${scoreValue.toLocaleString()}`
        });

        // Show message for all players
        setInsultPlayerName(trimmedName);
        setShowPlayerInsult(true);
      }
      
      setName("");
      setScore("");
      onScoreSubmitted();
      
      // Check for new achievements after a short delay to allow database triggers to complete
      setTimeout(() => {
        checkForNewAchievements(trimmedName);
      }, 1000);
      
      onClose();
      
    } catch (error: any) {
      console.error('Error submitting score:', error);
      
      // Handle specific constraint violations
      if (error.message?.includes('score_positive')) {
        toast({
          title: "Invalid Score",
          description: "Score must be a positive number",
          variant: "destructive",
        });
      } else if (error.message?.includes('score_reasonable')) {
        toast({
          title: "Invalid Score", 
          description: "Score is too high (maximum: 999,999,999)",
          variant: "destructive",
        });
      } else if (error.message?.includes('player_name_length')) {
        toast({
          title: "Invalid Player Name",
          description: "Player name must be between 1 and 50 characters",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to submit score. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!game) return null;

  return (
    <>
      <PlayerInsult 
        isVisible={showPlayerInsult} 
        playerName={insultPlayerName}
        onComplete={() => setShowPlayerInsult(false)} 
      />
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-black/30 border-white/20 max-w-md backdrop-blur-sm">
        <DialogHeader className="pb-3">
          <DialogTitle className="sr-only">Submit Score for {game.name}</DialogTitle>
          {/* Game logo header */}
          <div className="flex justify-center mb-4">
            <div className="transition-transform duration-200">
              {getGameLogoUrl(game.logo_url) ? (
                <img 
                  src={getGameLogoUrl(game.logo_url)!} 
                  alt={game.name} 
                  className="h-16 w-auto object-contain"
                />
              ) : (
                <div className="h-16 flex items-center justify-center bg-black/30 rounded-lg px-4 transition-colors">
                  <span className="text-white font-bold text-lg">{game.name}</span>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 justify-center mb-4">
            <Trophy className="animate-glow text-arcade-neonYellow" />
            <span className="text-lg font-semibold text-white">Enter Your Score</span>
          </div>
          
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Player Name (max 50 characters)"
              value={name}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= 50) {
                  setName(value);
                }
              }}
              maxLength={50}
              className="bg-black/50 border-arcade-neonCyan text-white text-center"
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
              className="bg-black/50 border-arcade-neonPink text-white text-center"
            />
            
            <div className="flex gap-2">
              <Button 
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                variant="outline"
                className="flex-1"
                disabled={!name || !score || isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Score"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default ScoreSubmissionDialog;