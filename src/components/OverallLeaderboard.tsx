import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award } from "lucide-react";
import { formatScore } from '@/lib/utils';

interface PlayerScore {
  player_name: string;
  total_score: number;
  total_ranking_points: number;
  game_count: number;
}

const OverallLeaderboard = () => {
  const [leaders, setLeaders] = useState<PlayerScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadOverallLeaders = async () => {
    try {
      console.log('Loading overall leaders...');
      // Get all scores with game information
      const { data: scores, error } = await supabase
        .from('scores')
        .select(`
          player_name, 
          score,
          game_id,
          games!inner(include_in_challenge, name)
        `)
        .eq('games.include_in_challenge', true);

      if (error) throw error;

      // Group scores by game
      const scoresByGame = scores?.reduce((acc: Record<string, any[]>, score) => {
        const gameId = score.game_id;
        if (!acc[gameId]) {
          acc[gameId] = [];
        }
        acc[gameId].push(score);
        return acc;
      }, {}) || {};

      // Function to calculate ranking points based on position
      const getRankingPoints = (position: number): number => {
        // Fixed points system: 1st=100, 2nd=80, 3rd=70, 4th=60, 5th=50, etc.
        // Linear scale: 100 - (position - 1) * 10, minimum 10 points
        return Math.max(100 - (position - 1) * 10, 10);
      };

      // Calculate ranking points for each player across all games
      const playerTotals = scores?.reduce((acc: Record<string, PlayerScore>, score) => {
        const playerName = score.player_name;
        if (!acc[playerName]) {
          acc[playerName] = {
            player_name: playerName,
            total_score: 0,
            total_ranking_points: 0,
            game_count: 0
          };
        }
        acc[playerName].total_score += score.score;
        acc[playerName].game_count += 1;
        return acc;
      }, {}) || {};

      // For each game, rank players and assign ranking points
      Object.values(scoresByGame).forEach(gameScores => {
        // Sort scores by score (descending) to get rankings
        const sortedScores = gameScores.sort((a, b) => b.score - a.score);
        
        // Assign ranking points based on position
        sortedScores.forEach((score, index) => {
          const position = index + 1;
          const rankingPoints = getRankingPoints(position);
          
          if (playerTotals[score.player_name]) {
            playerTotals[score.player_name].total_ranking_points += rankingPoints;
          }
        });
      });

      // Convert to array and sort by total ranking points (primary) and total score (secondary)
      const leadersList = Object.values(playerTotals)
        .sort((a, b) => {
          // Primary sort: by ranking points (descending)
          if (b.total_ranking_points !== a.total_ranking_points) {
            return b.total_ranking_points - a.total_ranking_points;
          }
          // Secondary sort: by total score (descending)
          return b.total_score - a.total_score;
        })
        .slice(0, 10); // Top 10 players

      setLeaders(leadersList);
      setLastUpdate(new Date());
      console.log('Overall leaders loaded successfully:', leadersList.length, 'players');
    } catch (error) {
      console.error('Error loading overall leaders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverallLeaders();
    
    // Set up periodic refresh as fallback (every 30 seconds)
    const refreshInterval = setInterval(() => {
      console.log('OverallLeaderboard: Periodic refresh triggered');
      loadOverallLeaders();
    }, 30000);
    
    // Set up real-time subscriptions for score and game changes
    const scoresChannel = supabase
      .channel('overall-leaderboard-scores')
      .on('postgres_changes', 
        { 
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public', 
          table: 'scores' 
        }, 
        (payload) => {
          console.log('OverallLeaderboard: Score change detected:', payload.eventType, payload);
          loadOverallLeaders(); // Reload leaders when scores change
        }
      )
      .subscribe((status) => {
        console.log('OverallLeaderboard: Scores subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('OverallLeaderboard: Successfully subscribed to score changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('OverallLeaderboard: Error subscribing to score changes');
        }
      });

    const gamesChannel = supabase
      .channel('overall-leaderboard-games')
      .on('postgres_changes', 
        { 
          event: '*', // INSERT, UPDATE, DELETE - in case games are added/removed
          schema: 'public', 
          table: 'games' 
        }, 
        (payload) => {
          console.log('OverallLeaderboard: Game change detected:', payload.eventType, payload);
          loadOverallLeaders(); // Reload leaders when games change
        }
      )
      .subscribe((status) => {
        console.log('OverallLeaderboard: Games subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('OverallLeaderboard: Successfully subscribed to game changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('OverallLeaderboard: Error subscribing to game changes');
        }
      });

    return () => {
      console.log('Cleaning up overall leaderboard subscriptions');
      clearInterval(refreshInterval);
      supabase.removeChannel(scoresChannel);
      supabase.removeChannel(gamesChannel);
    };
  }, []);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-5 h-5 text-yellow-400 animate-gold-shine" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-300 animate-silver-shine" />;
      case 2:
        return <Award className="w-5 h-5 text-orange-600 animate-bronze-shine" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-white">#{index + 1}</span>;
    }
  };

  if (loading) {
    return (
      <Card className="bg-black/30 border-white/15">
        <CardContent className="p-6">
          <div className="text-center text-white">Loading leaders...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/30 border-white/15 h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-arcade-neonYellow" />
          Overall Leaders
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {leaders.map((player, index) => (
            <div
              key={player.player_name}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                index === 0
                  ? 'bg-yellow-400/10 border-yellow-400/30'
                  : index === 1
                  ? 'bg-gray-300/10 border-gray-300/30'
                  : index === 2
                  ? 'bg-orange-600/10 border-orange-600/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                {getRankIcon(index)}
                <div>
                  <div 
                    className="font-arcade font-bold text-sm animated-gradient"
                    style={{ animationDelay: `${index * 0.15}s` }}
                  >
                    {player.player_name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {player.game_count} game{player.game_count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div 
                className="text-right font-bold font-arcade animated-gradient"
                style={{ animationDelay: `${index * 0.15 + 0.3}s` }}
              >
                {formatScore(player.total_ranking_points)}
              </div>
            </div>
          ))}
          {leaders.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              No scores found yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OverallLeaderboard;