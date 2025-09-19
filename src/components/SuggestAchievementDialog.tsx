import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, RefreshCw, Plus } from "lucide-react";
import { useTournament } from "@/contexts/TournamentContext";

interface SuggestedAchievement {
  name: string;
  description: string;
  type: string;
  badge_icon: string;
  badge_color: string;
  criteria: any;
  points: number;
  reasoning: string;
}

interface SuggestAchievementDialogProps {
  onAchievementAdded: () => void;
}

const achievementTypes = [
  'first_score', 'first_place', 'score_milestone', 'game_master',
  'high_scorer', 'consistent_player', 'perfectionist', 'streak_master',
  'competition_winner', 'speed_demon'
];

const icons = ['🏆', '🥇', '🎯', '⭐', '💎', '🔥', '⚡', '🎮', '👑', '🏅', '🌟', '💫', '🚀', '🎪', '🎭', '🎨'];
const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'];

const generateAchievementSuggestion = (
  existingAchievements: any[],
  games: any[]
): SuggestedAchievement => {
  const random = Math.random;

  // Get random type that's not overused
  const typeUsage = existingAchievements.reduce((acc, ach) => {
    acc[ach.type] = (acc[ach.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const availableTypes = achievementTypes.filter(type =>
    (typeUsage[type] || 0) < 3 // Limit each type to 3 achievements
  );

  const type = availableTypes[Math.floor(random() * availableTypes.length)] ||
                achievementTypes[Math.floor(random() * achievementTypes.length)];

  const icon = icons[Math.floor(random() * icons.length)];
  const color = colors[Math.floor(random() * colors.length)];

  // Generate different suggestions based on type
  switch (type) {
    case 'score_milestone':
      const milestones = [5000, 15000, 30000, 75000, 150000, 250000, 500000];
      const milestone = milestones[Math.floor(random() * milestones.length)];
      return {
        name: `${milestone.toLocaleString()} Club`,
        description: `Score ${milestone.toLocaleString()} or more points in any game`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: { min_score: milestone },
        points: Math.max(25, Math.floor(milestone / 2000)),
        reasoning: `Milestone achievements motivate players to reach specific score targets and provide clear progression goals.`
      };

    case 'game_master':
      const gameCounts = [7, 8, 12, 15, 20];
      const gameCount = gameCounts[Math.floor(random() * gameCounts.length)];
      return {
        name: `${gameCount}-Game Expert`,
        description: `Submit scores to ${gameCount} different games`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: { game_count: gameCount },
        points: gameCount * 10,
        reasoning: `Encourages players to explore different games rather than focusing on just one.`
      };

    case 'consistent_player':
      const scoreCounts = [5, 15, 35, 75, 100];
      const scoreCount = scoreCounts[Math.floor(random() * scoreCounts.length)];
      return {
        name: `${scoreCount}-Score Veteran`,
        description: `Submit ${scoreCount} scores total`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: { min_scores: scoreCount },
        points: scoreCount * 3,
        reasoning: `Rewards consistent engagement and regular play across the tournament.`
      };

    case 'perfectionist':
      const perfectScores = [100000, 250000, 500000, 1000000];
      const perfectScore = perfectScores[Math.floor(random() * perfectScores.length)];
      return {
        name: `${perfectScore.toLocaleString()} Perfect`,
        description: `Score exactly ${perfectScore.toLocaleString()} points`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: { exact_score: perfectScore },
        points: 150,
        reasoning: `Fun challenge achievement that requires precision and skill to hit exact scores.`
      };

    case 'streak_master':
      const streaks = [3, 5, 7, 10];
      const streak = streaks[Math.floor(random() * streaks.length)];
      return {
        name: `${streak}-Day Streak`,
        description: `Submit scores on ${streak} consecutive days`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: { consecutive_days: streak },
        points: streak * 20,
        reasoning: `Encourages regular daily engagement and builds playing habits.`
      };

    case 'first_place':
      return {
        name: `Champion Status`,
        description: `Achieve first place on any leaderboard`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: { max_rank: 1 },
        points: 200,
        reasoning: `Recognizes competitive excellence and motivates players to achieve top scores.`
      };

    case 'speed_demon':
      return {
        name: `Lightning Fast`,
        description: `Submit 5 scores within 1 hour`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: { scores_in_timeframe: 5, timeframe_hours: 1 },
        points: 100,
        reasoning: `Rewards intense gaming sessions and rapid-fire play.`
      };

    default:
      return {
        name: `Special Achievement`,
        description: `Complete a unique challenge`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: {},
        points: 50,
        reasoning: `A flexible achievement that can be customized for special events or challenges.`
      };
  }
};

export const SuggestAchievementDialog: React.FC<SuggestAchievementDialogProps> = ({
  onAchievementAdded
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestedAchievement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();
  const { currentTournament } = useTournament();

  const generateSuggestion = async () => {
    if (!currentTournament) return;

    setIsGenerating(true);

    try {
      // Fetch existing achievements and games to inform the suggestion
      const [achievementsResponse, gamesResponse] = await Promise.all([
        fetch(`/api/tournaments/${currentTournament.id}/achievements`),
        fetch(`/api/tournaments/${currentTournament.id}/games`)
      ]);

      let existingAchievements = [];
      let games = [];

      // Fallback to direct Supabase queries if API routes don't exist
      try {
        const { supabase } = await import("@/integrations/supabase/client");

        const [achResult, gamesResult] = await Promise.all([
          supabase
            .from('achievements')
            .select('*')
            .eq('tournament_id', currentTournament.id)
            .eq('is_active', true),
          supabase
            .from('games')
            .select('id, name')
            .eq('tournament_id', currentTournament.id)
            .eq('is_active', true)
        ]);

        existingAchievements = achResult.data || [];
        games = gamesResult.data || [];
      } catch (error) {
        console.warn('Could not fetch data for suggestion:', error);
      }

      const newSuggestion = generateAchievementSuggestion(existingAchievements, games);
      setSuggestion(newSuggestion);

    } catch (error) {
      console.error('Error generating suggestion:', error);
      toast({
        title: "Error",
        description: "Failed to generate achievement suggestion",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const addSuggestedAchievement = async () => {
    if (!suggestion || !currentTournament) return;

    setIsAdding(true);

    try {
      const { supabase } = await import("@/integrations/supabase/client");

      const { error } = await supabase
        .from('achievements')
        .insert({
          tournament_id: currentTournament.id,
          name: suggestion.name,
          description: suggestion.description,
          type: suggestion.type,
          badge_icon: suggestion.badge_icon,
          badge_color: suggestion.badge_color,
          criteria: suggestion.criteria,
          points: suggestion.points,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Achievement "${suggestion.name}" has been added to the tournament.`
      });

      setIsOpen(false);
      setSuggestion(null);
      onAchievementAdded();

    } catch (error: any) {
      console.error('Error adding achievement:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add achievement",
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !suggestion) {
      generateSuggestion();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="ml-2">
          <Sparkles className="w-4 h-4 mr-2" />
          Suggest Achievement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="w-5 h-5 mr-2" />
            AI Achievement Suggestion
          </DialogTitle>
          <DialogDescription>
            Let AI suggest a new achievement for your tournament based on existing achievements and games.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isGenerating ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating achievement suggestion...</span>
                </div>
              </CardContent>
            </Card>
          ) : suggestion ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span className="text-2xl mr-2">{suggestion.badge_icon}</span>
                  {suggestion.name}
                  <span
                    className="ml-auto px-2 py-1 rounded text-white text-sm font-medium"
                    style={{ backgroundColor: suggestion.badge_color }}
                  >
                    {suggestion.points} pts
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{suggestion.description}</p>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Type:</strong> {suggestion.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  <div>
                    <strong>Criteria:</strong> {JSON.stringify(suggestion.criteria)}
                  </div>
                </div>

                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm">
                    <strong>Why this achievement?</strong> {suggestion.reasoning}
                  </p>
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={generateSuggestion}
                    disabled={isGenerating}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Generate New Suggestion
                  </Button>

                  <Button
                    onClick={addSuggestedAchievement}
                    disabled={isAdding}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {isAdding ? 'Adding...' : 'Add This Achievement'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">
                    Click the button below to generate your first achievement suggestion.
                  </p>
                  <Button onClick={generateSuggestion} disabled={isGenerating}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Suggestion
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};