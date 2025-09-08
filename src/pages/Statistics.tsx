import React, { useState, useEffect, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Medal, Award, Users, Gamepad2, Target, Calendar, ArrowLeft, BarChart3 } from 'lucide-react';
import { formatScore } from '@/lib/utils';
import { useOptimizedData } from '@/hooks/useOptimizedData';
import { LazyCharts } from '@/utils/dynamicImports';

interface CompetitionHistory {
  id: string;
  competition_name: string;
  start_date: string;
  end_date: string;
  total_players: number;
  total_games: number;
  total_scores: number;
}

interface CompetitionPlayer {
  player_name: string;
  total_score: number;
  total_ranking_points: number;
  games_played: number;
  best_rank: number;
  final_rank: number;
}

interface CompetitionScore {
  player_name: string;
  game_name: string;
  score: number;
  rank_in_game: number;
  ranking_points: number;
}

const Statistics = () => {
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState<CompetitionHistory[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [players, setPlayers] = useState<CompetitionPlayer[]>([]);
  const [scores, setScores] = useState<CompetitionScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoresLoading, setScoresLoading] = useState(false);
  // Use optimized data hook
  const { 
    games: currentGames, 
    scores: currentScores, 
    achievements, 
    playerAchievements,
    loading: dataLoading 
  } = useOptimizedData({ refetchInterval: 30000 }); // Refetch every 30 seconds

  useEffect(() => {
    loadCompetitions();
  }, []);

  useEffect(() => {
    if (selectedCompetition) {
      loadCompetitionData(selectedCompetition);
    }
  }, [selectedCompetition]);

  const loadCompetitions = async () => {
    try {
      const { data, error } = await supabase
        .from('competition_history')
        .select('*')
        .order('end_date', { ascending: false });

      if (error) throw error;
      setCompetitions(data || []);
      
      // Auto-select the most recent competition
      if (data && data.length > 0) {
        setSelectedCompetition(data[0].id);
      }
    } catch (error) {
      console.error('Error loading competitions:', error);
    } finally {
      setLoading(false);
    }
  };


  const loadCompetitionData = async (competitionId: string) => {
    setScoresLoading(true);
    try {
      // Load players
      const { data: playersData, error: playersError } = await supabase
        .from('competition_players')
        .select('*')
        .eq('competition_id', competitionId)
        .order('final_rank', { ascending: true });

      if (playersError) throw playersError;
      setPlayers(playersData || []);

      // Load scores
      const { data: scoresData, error: scoresError } = await supabase
        .from('competition_scores')
        .select('*')
        .eq('competition_id', competitionId)
        .order('game_name, rank_in_game', { ascending: true });

      if (scoresError) throw scoresError;
      setScores(scoresData || []);
    } catch (error) {
      console.error('Error loading competition data:', error);
    } finally {
      setScoresLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-300" />;
      case 3:
        return <Award className="w-5 h-5 text-orange-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-white">#{rank}</span>;
    }
  };

  const getSelectedCompetition = () => {
    return competitions.find(c => c.id === selectedCompetition);
  };

  const getGameStats = () => {
    const gameStats: Record<string, { totalScores: number; topPlayer: string; topScore: number }> = {};
    
    scores.forEach(score => {
      if (!gameStats[score.game_name]) {
        gameStats[score.game_name] = {
          totalScores: 0,
          topPlayer: score.player_name,
          topScore: score.score
        };
      }
      gameStats[score.game_name].totalScores++;
      if (score.score > gameStats[score.game_name].topScore) {
        gameStats[score.game_name].topPlayer = score.player_name;
        gameStats[score.game_name].topScore = score.score;
      }
    });
    
    return gameStats;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10"
           style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
        <div className="text-white text-xl">Loading statistics...</div>
      </div>
    );
  }

  const selectedComp = getSelectedCompetition();
  const gameStats = getGameStats();

  return (
    <div className="min-h-screen text-white p-4 relative z-10"
         style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
      
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="border-white text-white hover:bg-white hover:text-black"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Main
            </Button>
            <h1 className="text-3xl font-bold text-arcade-neonYellow">Competition Statistics</h1>
          </div>
        </div>

        {/* Competition Selector */}
        <Card className="bg-black/30 border-white/15 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-arcade-neonCyan" />
              Select Competition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a competition" />
              </SelectTrigger>
              <SelectContent>
                {competitions.map((comp) => (
                  <SelectItem key={comp.id} value={comp.id}>
                    {comp.competition_name} ({new Date(comp.start_date).toLocaleDateString()} - {new Date(comp.end_date).toLocaleDateString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedComp && (
          <>
            {/* Competition Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-black/30 border-white/15">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-sm text-gray-400">Total Players</p>
                      <p className="text-2xl font-bold text-white">{selectedComp.total_players}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-black/30 border-white/15">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-sm text-gray-400">Games Played</p>
                      <p className="text-2xl font-bold text-white">{selectedComp.total_games}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-black/30 border-white/15">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-sm text-gray-400">Total Scores</p>
                      <p className="text-2xl font-bold text-white">{selectedComp.total_scores}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-black/30 border-white/15">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-orange-400" />
                    <div>
                      <p className="text-sm text-gray-400">Duration</p>
                      <p className="text-lg font-bold text-white">
                        {Math.ceil((new Date(selectedComp.end_date).getTime() - new Date(selectedComp.start_date).getTime()) / (1000 * 60 * 60 * 24))} days
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Players */}
              <Card className="bg-black/30 border-white/15">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-arcade-neonYellow" />
                    Top Players
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {scoresLoading ? (
                    <div className="text-center text-gray-400">Loading...</div>
                  ) : (
                    <div className="space-y-3">
                      {players.slice(0, 10).map((player, index) => (
                        <div key={player.player_name} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                          <div className="flex items-center gap-3">
                            {getRankIcon(player.final_rank)}
                            <div>
                              <p className="font-semibold text-white">{player.player_name}</p>
                              <p className="text-sm text-gray-400">{player.games_played} games</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-arcade-neonYellow">{player.total_ranking_points} pts</p>
                            <p className="text-sm text-gray-400">{formatScore(player.total_score)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Game Statistics */}
              <Card className="bg-black/30 border-white/15">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Gamepad2 className="w-5 h-5 text-arcade-neonCyan" />
                    Game Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {scoresLoading ? (
                    <div className="text-center text-gray-400">Loading...</div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(gameStats).map(([gameName, stats]) => (
                        <div key={gameName} className="p-3 bg-white/5 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">{gameName}</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-gray-400">Top Player:</p>
                              <p className="text-white font-medium">{stats.topPlayer}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Top Score:</p>
                              <p className="text-arcade-neonYellow font-bold">{formatScore(stats.topScore)}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-gray-400">Total Scores:</p>
                              <p className="text-white">{stats.totalScores}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Visual Analytics Section */}
        <div className="mt-8">
          <Card className="bg-black/30 border-white/15 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-arcade-neonCyan" />
                Visual Analytics
              </CardTitle>
              <p className="text-gray-400 text-sm">
                Interactive charts and graphs showing current game data and player performance
              </p>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Suspense fallback={<div className="h-80 bg-gray-800 rounded-lg animate-pulse" />}>
              <LazyCharts.ScoreDistributionChart scores={currentScores} games={currentGames} />
            </Suspense>
            <Suspense fallback={<div className="h-80 bg-gray-800 rounded-lg animate-pulse" />}>
              <LazyCharts.GamePopularityChart scores={currentScores} games={currentGames} />
            </Suspense>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Suspense fallback={<div className="h-80 bg-gray-800 rounded-lg animate-pulse" />}>
              <LazyCharts.PlayerPerformanceChart scores={currentScores} games={currentGames} />
            </Suspense>
            <Suspense fallback={<div className="h-80 bg-gray-800 rounded-lg animate-pulse" />}>
              <LazyCharts.AchievementProgressChart 
                achievements={achievements} 
                playerAchievements={playerAchievements} 
              />
            </Suspense>
          </div>
        </div>

        {competitions.length === 0 && (
          <Card className="bg-black/30 border-white/15">
            <CardContent className="p-8 text-center">
              <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Competitions Yet</h3>
              <p className="text-gray-400">
                No competitions have been completed yet. Start playing and complete a competition to see statistics here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Statistics;
