import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award, Star } from "lucide-react";
import { formatScore } from '@/lib/utils';

interface PlayerScore {
  player_name: string;
  total_score: number;
  total_ranking_points: number;
  game_count: number;
}

interface AchievementHunter {
  player_name: string;
  total_points: number;
  achievement_count: number;
}

interface DemolitionManScore {
  player_name: string;
  score: number;
  created_at: string;
}

const OverallLeaderboard = () => {
  const [leaders, setLeaders] = useState<PlayerScore[]>([]);
  const [achievementHunters, setAchievementHunters] = useState<AchievementHunter[]>([]);
  const [demolitionManScores, setDemolitionManScores] = useState<DemolitionManScore[]>([]);
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

  const loadAchievementHunters = async () => {
    try {
      console.log('Loading achievement hunters...');
      // Get player achievements with achievement points
      const { data: achievementData, error } = await supabase
        .from('player_achievements')
        .select(`
          player_name,
          achievements!inner(points)
        `);

      if (error) throw error;

      // Calculate total points and achievement count per player
      const playerAchievements = achievementData?.reduce((acc: Record<string, AchievementHunter>, item) => {
        const playerName = item.player_name;
        if (!acc[playerName]) {
          acc[playerName] = {
            player_name: playerName,
            total_points: 0,
            achievement_count: 0
          };
        }
        acc[playerName].total_points += item.achievements.points;
        acc[playerName].achievement_count += 1;
        return acc;
      }, {}) || {};

      // Convert to array and sort by total points
      const sortedHunters = Object.values(playerAchievements)
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, 5); // Top 5

      setAchievementHunters(sortedHunters);
      console.log('Achievement hunters loaded successfully:', sortedHunters.length, 'hunters');
    } catch (error) {
      console.error('Error loading achievement hunters:', error);
      setAchievementHunters([]);
    }
  };

  const loadDemolitionManScores = async () => {
    try {
      console.log('Loading Demolition Man scores...');
      // Get scores for Demolition Man game (permanent leaderboard)
      const { data: scoreData, error } = await supabase
        .from('scores')
        .select(`
          player_name,
          score,
          created_at,
          games!inner(name)
        `)
        .eq('games.name', 'Demolition Man')
        .order('score', { ascending: false })
        .limit(5);

      if (error) throw error;

      // Transform the data
      const demolitionScores = scoreData?.map(item => ({
        player_name: item.player_name,
        score: item.score,
        created_at: item.created_at
      })) || [];

      setDemolitionManScores(demolitionScores);
      console.log('Demolition Man scores loaded successfully:', demolitionScores.length, 'scores');
    } catch (error) {
      console.error('Error loading Demolition Man scores:', error);
      setDemolitionManScores([]);
    }
  };

  useEffect(() => {
    loadOverallLeaders();
    loadAchievementHunters();
    loadDemolitionManScores();
    
    // Set up periodic refresh as fallback (every 30 seconds)
    const refreshInterval = setInterval(() => {
      console.log('OverallLeaderboard: Periodic refresh triggered');
      loadOverallLeaders();
      loadAchievementHunters();
      loadDemolitionManScores();
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
          loadAchievementHunters(); // Reload achievement hunters when scores change (as achievements might be unlocked)
          loadDemolitionManScores(); // Reload Demolition Man scores when scores change
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

    // Set up real-time subscription for achievement changes
    const achievementsChannel = supabase
      .channel('overall-leaderboard-achievements')
      .on('postgres_changes', 
        { 
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public', 
          table: 'player_achievements' 
        }, 
        (payload) => {
          console.log('OverallLeaderboard: Achievement change detected:', payload.eventType, payload);
          loadAchievementHunters(); // Reload achievement hunters when achievements change
        }
      )
      .subscribe((status) => {
        console.log('OverallLeaderboard: Achievements subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('OverallLeaderboard: Successfully subscribed to achievement changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('OverallLeaderboard: Error subscribing to achievement changes');
        }
      });

    return () => {
      console.log('Cleaning up overall leaderboard subscriptions');
      clearInterval(refreshInterval);
      supabase.removeChannel(scoresChannel);
      supabase.removeChannel(gamesChannel);
      supabase.removeChannel(achievementsChannel);
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

  const getAchievementRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Star className="w-4 h-4 text-pink-400" />;
      case 1:
        return <Star className="w-4 h-4 text-purple-300" />;
      case 2:
        return <Star className="w-4 h-4 text-indigo-600" />;
      default:
        return <span className="w-4 h-4 flex items-center justify-center text-xs font-bold text-white">#{index + 1}</span>;
    }
  };

  const getDemolitionRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-4 h-4 text-red-400" />;
      case 1:
        return <Medal className="w-4 h-4 text-orange-300" />;
      case 2:
        return <Award className="w-4 h-4 text-yellow-600" />;
      default:
        return <span className="w-4 h-4 flex items-center justify-center text-xs font-bold text-white">#{index + 1}</span>;
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
    <div className="space-y-4 h-full flex flex-col">
      {/* Overall Leaders */}
      <Card className="bg-black/30 border-white/15 flex-1">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-arcade-neonYellow" />
            Overall Leaders
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-y-auto">
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

      {/* Achievement Hunters */}
      <Card className="bg-black/30 border-white/15 flex-1">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-arcade-neonPink" />
            Achievement Hunters
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-y-auto">
          <div className="space-y-3">
            {achievementHunters.map((hunter, index) => (
              <div
                key={hunter.player_name}
                className={`flex items-center p-3 rounded-lg border ${
                  index === 0
                    ? 'bg-pink-400/10 border-pink-400/30'
                    : index === 1
                    ? 'bg-purple-300/10 border-purple-300/30'
                    : index === 2
                    ? 'bg-indigo-600/10 border-indigo-600/30'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getAchievementRankIcon(index)}
                  <div>
                    <div 
                      className="font-arcade font-bold text-sm animated-gradient"
                      style={{ animationDelay: `${index * 0.15}s` }}
                    >
                      {hunter.player_name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {hunter.achievement_count} achievement{hunter.achievement_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {achievementHunters.length === 0 && (
              <div className="text-center text-gray-400 py-4">
                No achievements yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Demolition Man Eternal Leaderboard */}
      <Card className="bg-black/30 border-white/15 flex-1">
        <CardHeader>
          <CardTitle className="text-white flex flex-col items-center gap-2">
            <div className="text-center">
              {/* Demolition Man Logo */}
              <img 
                src="https://images.launchbox-app.com/c84bf29b-1b54-4310-9290-9b52f587f442.png"
                alt="Demolition Man"
                className="w-40 h-auto rounded-lg mx-auto"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-y-auto">
          <div className="space-y-3">
            {demolitionManScores.map((score, index) => (
              <div
                key={`${score.player_name}-${score.created_at}`}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  index === 0
                    ? 'bg-red-400/10 border-red-400/30'
                    : index === 1
                    ? 'bg-orange-300/10 border-orange-300/30'
                    : index === 2
                    ? 'bg-yellow-600/10 border-yellow-600/30'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getDemolitionRankIcon(index)}
                  <div>
                    <div 
                      className="font-arcade font-bold text-sm animated-gradient"
                      style={{ animationDelay: `${index * 0.15}s` }}
                    >
                      {score.player_name}
                    </div>
                  </div>
                </div>
                <div 
                  className="text-right font-bold font-arcade animated-gradient"
                  style={{ animationDelay: `${index * 0.15 + 0.3}s` }}
                >
                  {formatScore(score.score)}
                </div>
              </div>
            ))}
            {demolitionManScores.length === 0 && (
              <div className="text-center text-gray-400 py-4">
                No Demolition Man scores yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OverallLeaderboard;