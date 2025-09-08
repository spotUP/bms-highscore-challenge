import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Target, TrendingUp, Gamepad2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PlayerAchievements from '@/components/PlayerAchievements';
import PlayerScoreHistoryChart from '@/components/charts/PlayerScoreHistoryChart';

interface PlayerStats {
  id: string;
  player_name: string;
  total_scores: number;
  total_games_played: number;
  first_place_count: number;
  total_score: number;
  best_score: number;
  current_streak: number;
  longest_streak: number;
  last_score_date: string | null;
}

interface PlayerAchievement {
  id: string;
  player_name: string;
  achievement_id: string;
  unlocked_at: string;
  achievements: {
    name: string;
    description: string;
    badge_icon: string;
    badge_color: string;
    points: number;
  };
}

const PlayerDashboard = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const playerName = searchParams.get('player');
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [recentAchievements, setRecentAchievements] = useState<PlayerAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<Array<{ id: string; name: string }>>([]);
  const [scores, setScores] = useState<Array<{ game_id: string; player_name: string; score: number; created_at: string }>>([]);

  useEffect(() => {
    if (playerName) {
      loadPlayerData();
    } else {
      navigate('/');
    }
  }, [playerName, navigate]);

  const loadPlayerData = async () => {
    try {
      // Load player stats
      const { data: statsData, error: statsError } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_name', playerName?.toUpperCase())
        .single();

      if (statsError && statsError.code !== 'PGRST116') {
        throw statsError;
      }

      // Load recent achievements (last 5)
      const { data: achievementsData, error: achievementsError } = await supabase
        .from('player_achievements')
        .select(`
          *,
          achievements (*)
        `)
        .eq('player_name', playerName?.toUpperCase())
        .order('unlocked_at', { ascending: false })
        .limit(5);

      if (achievementsError) {
        throw achievementsError;
      }

      // Load games and scores for chart
      const [gamesResult, scoresResult] = await Promise.all([
        supabase
          .from('games')
          .select('id, name')
          .eq('is_active', true),
        supabase
          .from('scores')
          .select('game_id, player_name, score, created_at')
          .order('created_at', { ascending: false })
      ]);

      if (gamesResult.error) throw gamesResult.error;
      if (scoresResult.error) throw scoresResult.error;

      setPlayerStats(statsData || null);
      setRecentAchievements(achievementsData || []);
      setGames(gamesResult.data || []);
      setScores(scoresResult.data || []);
    } catch (error) {
      console.error('Error loading player data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10"
           style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
        <div className="text-white text-xl">Loading player dashboard...</div>
      </div>
    );
  }

  if (!playerName) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10"
           style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
        <div className="text-white text-xl">Player not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-4 relative z-10"
         style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
      
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="border-white text-white hover:bg-white hover:text-black"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-arcade-neonPink via-arcade-neonCyan to-arcade-neonYellow text-transparent bg-clip-text">
            {playerName}'s Dashboard
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Stats Overview */}
        {playerStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gray-900 border-white/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600/20 rounded-lg">
                    <Target className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total Scores</p>
                    <p className="text-2xl font-bold text-white">{playerStats.total_scores}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-white/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-600/20 rounded-lg">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">First Places</p>
                    <p className="text-2xl font-bold text-white">{playerStats.first_place_count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-white/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-600/20 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Best Score</p>
                    <p className="text-2xl font-bold text-white">{playerStats.best_score.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-white/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-600/20 rounded-lg">
                    <Gamepad2 className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Games Played</p>
                    <p className="text-2xl font-bold text-white">{playerStats.total_games_played}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Achievements */}
          <Card className="bg-gray-900 border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Recent Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentAchievements.length > 0 ? (
                <div className="space-y-3">
                  {recentAchievements.map((achievement) => (
                    <div key={achievement.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                      <div 
                        className="w-10 h-10 rounded-full border-2 flex items-center justify-center"
                        style={{ 
                          borderColor: achievement.achievements.badge_color,
                          backgroundColor: `${achievement.achievements.badge_color}20`
                        }}
                      >
                        <span className="text-lg">{achievement.achievements.badge_icon}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-white">{achievement.achievements.name}</h4>
                        <p className="text-sm text-gray-400">{achievement.achievements.description}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(achievement.unlocked_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-yellow-600 text-yellow-100">
                        +{achievement.achievements.points}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No achievements unlocked yet</p>
                  <p className="text-sm">Start playing to unlock your first achievement!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Achievement Progress */}
          <Card className="bg-gray-900 border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Achievement Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {playerStats ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Total Points</span>
                    <Badge variant="outline" className="border-yellow-500 text-yellow-400">
                      {recentAchievements.reduce((total, a) => total + a.achievements.points, 0)} pts
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Achievements Unlocked</span>
                    <Badge variant="secondary" className="bg-yellow-600 text-yellow-100">
                      {recentAchievements.length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Current Streak</span>
                    <Badge variant="outline" className="border-green-500 text-green-400">
                      {playerStats.current_streak} games
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Longest Streak</span>
                    <Badge variant="outline" className="border-purple-500 text-purple-400">
                      {playerStats.longest_streak} games
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>No stats available yet</p>
                  <p className="text-sm">Submit your first score to see your progress!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Score History Chart */}
        <div className="mt-6">
          <PlayerScoreHistoryChart 
            scores={scores} 
            games={games} 
            playerName={playerName || ''} 
          />
        </div>

        {/* All Achievements */}
        <PlayerAchievements playerName={playerName} />
      </div>
    </div>
  );
};

export default PlayerDashboard;
