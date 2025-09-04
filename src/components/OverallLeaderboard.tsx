import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award } from "lucide-react";

interface PlayerScore {
  player_name: string;
  total_score: number;
  game_count: number;
}

const OverallLeaderboard = () => {
  const [leaders, setLeaders] = useState<PlayerScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOverallLeaders = async () => {
      try {
        const { data: scores, error } = await supabase
          .from('scores')
          .select('player_name, score');

        if (error) throw error;

        // Group scores by player name and calculate totals
        const playerTotals = scores?.reduce((acc: Record<string, PlayerScore>, score) => {
          const playerName = score.player_name;
          if (!acc[playerName]) {
            acc[playerName] = {
              player_name: playerName,
              total_score: 0,
              game_count: 0
            };
          }
          acc[playerName].total_score += score.score;
          acc[playerName].game_count += 1;
          return acc;
        }, {}) || {};

        // Convert to array and sort by total score
        const leadersList = Object.values(playerTotals)
          .sort((a, b) => b.total_score - a.total_score)
          .slice(0, 10); // Top 10 players

        setLeaders(leadersList);
      } catch (error) {
        console.error('Error loading overall leaders:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOverallLeaders();
  }, []);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-5 h-5 text-arcade-neonYellow" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-300" />;
      case 2:
        return <Award className="w-5 h-5 text-orange-400" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-white">#{index + 1}</span>;
    }
  };

  if (loading) {
    return (
      <Card className="bg-black/50 border-white/20">
        <CardContent className="p-6">
          <div className="text-center text-white">Loading leaders...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/50 border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-arcade-neonYellow" />
          Overall Leaders
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {leaders.map((player, index) => (
            <div
              key={player.player_name}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                index === 0
                  ? 'bg-arcade-neonYellow/10 border-arcade-neonYellow/30'
                  : index === 1
                  ? 'bg-gray-500/10 border-gray-500/30'
                  : index === 2
                  ? 'bg-orange-400/10 border-orange-400/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                {getRankIcon(index)}
                <div>
                  <div className="text-white font-mono font-bold text-sm">
                    {player.player_name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {player.game_count} game{player.game_count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div className={`text-right ${
                index === 0
                  ? 'text-arcade-neonYellow'
                  : index === 1
                  ? 'text-gray-300'
                  : index === 2
                  ? 'text-orange-400'
                  : 'text-white'
              } font-bold`}>
                {player.total_score.toLocaleString()}
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