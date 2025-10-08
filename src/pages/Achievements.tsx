import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Trophy, Target, TrendingUp, Gamepad2, Search, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PlayerAchievements from '@/components/PlayerAchievements';
import PlayerScoreHistoryChart from '@/components/charts/PlayerScoreHistoryChart';
import { getPageLayout, getCardStyle, getButtonStyle, getTypographyStyle, PageHeader, PageContainer, LoadingSpinner } from '@/utils/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/contexts/TournamentContext';

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

interface PlayerSummary {
  player_name: string;
  achievement_count: number;
  total_points: number;
  latest_achievement: string | null;
  latest_achievement_date: string | null;
}

const Achievements = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userTournaments } = useTournament();
  const selectedPlayer = searchParams.get('player');
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [recentAchievements, setRecentAchievements] = useState<PlayerAchievement[]>([]);
  const [playerList, setPlayerList] = useState<PlayerSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<Array<{ id: string; name: string }>>([]);
  const [scores, setScores] = useState<Array<{ game_id: string; player_name: string; score: number; created_at: string }>>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedPlayer) {
      loadPlayerData(selectedPlayer);
    }
  }, [selectedPlayer]);

  // Listen for achievement updates from score modifications
  useEffect(() => {
    const handleAchievementsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Achievements updated event received in Achievements page:', customEvent.detail);
      const { playerName } = customEvent.detail;

      // Refresh player list
      loadPlayerList();

      // If the updated player is currently selected, refresh their data
      if (selectedPlayer && playerName.toUpperCase() === selectedPlayer.toUpperCase()) {
        loadPlayerData(selectedPlayer);
      }
    };

    // Listen for local events
    window.addEventListener('achievementsUpdated', handleAchievementsUpdated);

    // Listen for cross-tab broadcasts
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      broadcastChannel = new BroadcastChannel('achievement-updates');
      broadcastChannel.onmessage = (event) => {
        console.log('Broadcast achievement update received in Achievements page:', event.data);
        const { playerName } = event.data;

        // Refresh player list
        loadPlayerList();

        // If the updated player is currently selected, refresh their data
        if (selectedPlayer && playerName.toUpperCase() === selectedPlayer.toUpperCase()) {
          loadPlayerData(selectedPlayer);
        }
      };
    } catch (error) {
      console.warn('BroadcastChannel not supported in Achievements page');
    }

    // Listen for localStorage fallback
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'achievementUpdate' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          console.log('localStorage achievement update received in Achievements page:', data);
          const { playerName } = data;

          // Refresh player list
          loadPlayerList();

          // If the updated player is currently selected, refresh their data
          if (selectedPlayer && playerName.toUpperCase() === selectedPlayer.toUpperCase()) {
            loadPlayerData(selectedPlayer);
          }
        } catch (error) {
          console.warn('Failed to parse achievement update from localStorage');
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('achievementsUpdated', handleAchievementsUpdated);
      window.removeEventListener('storage', handleStorage);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [selectedPlayer]);

  const loadInitialData = async () => {
    try {
      setError(null);
      console.log('Loading achievements page data...');
      
      // Load all players with achievement summaries
      await loadPlayerList();
      
      console.log('Achievements page data loaded successfully');
    } catch (error) {
      console.error('Critical error loading achievements data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const loadPlayerList = async () => {
    try {
      // Get tournament IDs created by the current user
      const userTournamentIds = userTournaments
        .filter(tournament => tournament.created_by === user?.id)
        .map(tournament => tournament.id);

      if (userTournamentIds.length === 0) {
        setPlayerList([]);
        return;
      }

      // Get all players with achievements from user's tournaments only
      const { data, error } = await supabase
        .from('player_achievements')
        .select(`
          player_name,
          unlocked_at,
          achievements!inner (
            name,
            points,
            tournament_id
          )
        `)
        .in('achievements.tournament_id', userTournamentIds)
        .order('unlocked_at', { ascending: false });

      if (error) {
        console.warn('Error loading player achievements:', error);
        setPlayerList([]);
        return;
      }

      // Group by player and calculate summaries across all user's tournaments
      const playerMap = new Map<string, PlayerSummary>();

      data?.forEach(item => {
        const playerName = item.player_name;
        const existing = playerMap.get(playerName);

        if (existing) {
          existing.achievement_count++;
          existing.total_points += item.achievements.points;
          // Update latest achievement if this one is more recent
          if (new Date(item.unlocked_at) > new Date(existing.latest_achievement_date || '')) {
            existing.latest_achievement = item.achievements.name;
            existing.latest_achievement_date = item.unlocked_at;
          }
        } else {
          playerMap.set(playerName, {
            player_name: playerName,
            achievement_count: 1,
            total_points: item.achievements.points,
            latest_achievement: item.achievements.name,
            latest_achievement_date: item.unlocked_at
          });
        }
      });

      const playerSummaries = Array.from(playerMap.values())
        .sort((a, b) => b.total_points - a.total_points);

      setPlayerList(playerSummaries);
    } catch (err) {
      console.warn('Error processing player list:', err);
      setPlayerList([]);
    }
  };

  const loadPlayerData = async (playerName: string) => {
    try {
      setError(null);
      console.log('Loading player data for:', playerName);

      // Get tournament IDs created by the current user
      const userTournamentIds = userTournaments
        .filter(tournament => tournament.created_by === user?.id)
        .map(tournament => tournament.id);

      if (userTournamentIds.length === 0) {
        setPlayerStats(null);
        setRecentAchievements([]);
        setGames([]);
        setScores([]);
        return;
      }

      // Try to load player stats (this might fail if table doesn't exist)
      let statsData = null;
      try {
        const { data, error: statsError } = await supabase
          .from('player_stats')
          .select('*')
          .eq('player_name', playerName.toUpperCase())
          .in('tournament_id', userTournamentIds)
          .single();

        console.log('Player stats result:', { data, statsError });

        if (statsError && statsError.code !== 'PGRST116') {
          console.warn('Player stats error (non-critical):', statsError);
        } else {
          statsData = data;
        }
      } catch (statsErr) {
        console.warn('Player stats table might not exist:', statsErr);
      }

      // Try to load achievements (this might fail if table doesn't exist)
      let achievementsData = [];
      try {
        const { data, error: achievementsError } = await supabase
          .from('player_achievements')
          .select(`
            *,
            achievements (*)
          `)
          .eq('player_name', playerName.toUpperCase())
          .in('achievements.tournament_id', userTournamentIds)
          .order('unlocked_at', { ascending: false })
          .limit(5);

        console.log('Player achievements result:', { data, achievementsError });

        if (achievementsError) {
          console.warn('Player achievements error (non-critical):', achievementsError);
        } else {
          achievementsData = data || [];
        }
      } catch (achievementsErr) {
        console.warn('Player achievements table might not exist:', achievementsErr);
      }

      // Load games and scores from user's tournaments only
      const [gamesResult, scoresResult] = await Promise.all([
        supabase
          .from('games')
          .select('id, name')
          .eq('is_active', true),
        supabase
          .from('scores')
          .select('game_id, player_name, score, created_at')
          .eq('player_name', playerName.toUpperCase())
          .in('tournament_id', userTournamentIds)
          .order('created_at', { ascending: false })
      ]);

      console.log('Games and scores results:', { gamesResult, scoresResult });

      if (gamesResult.error) {
        console.warn('Games error:', gamesResult.error);
      }
      if (scoresResult.error) {
        console.warn('Scores error:', scoresResult.error);
      }

      setPlayerStats(statsData);
      setRecentAchievements(achievementsData);
      setGames(gamesResult.data || []);
      setScores(scoresResult.data || []);
      
      console.log('Player dashboard data loaded successfully');
    } catch (error) {
      console.error('Critical error loading player data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  };

  const handlePlayerSelect = (playerName: string) => {
    setSearchParams({ player: playerName });
  };

  const handleBackToList = () => {
    setSearchParams({});
    setPlayerStats(null);
    setRecentAchievements([]);
    setGames([]);
    setScores([]);
  };

  const filteredPlayers = playerList.filter(player =>
    player.player_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner text="Loading achievements..." />;
  }

  if (error) {
    return (
      <div {...getPageLayout()}>
        <PageContainer>
          <div className="text-center">
            <h1 className={getTypographyStyle('h1')}>Error Loading Achievements</h1>
            <p className="text-red-400 mb-6">{error}</p>
            <div className="space-y-2">
              <Button
                onClick={() => loadInitialData()}
                variant="outline"
              >
                Retry
              </Button>
              <Button
                onClick={() => navigate('/')}
                variant="outline"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Main
              </Button>
            </div>
          </div>
        </PageContainer>
      </div>
    );
  }

  const pageLayout = getPageLayout();

  // Show individual player dashboard if selected
  if (selectedPlayer) {
    return (
      <div {...pageLayout}>
        <PageContainer className="max-w-6xl mx-auto">
          <PageHeader 
            title={`${selectedPlayer}'s Dashboard`}
            subtitle="Player statistics and achievement progress"
          >
            <div className="flex gap-2">
              <Button
                onClick={handleBackToList}
                variant="outline"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Players
              </Button>
              <Button
                onClick={() => navigate('/')}
                variant="outline"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Main
              </Button>
            </div>
          </PageHeader>
          
          {/* Stats Overview */}
          {playerStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className={getCardStyle('primary')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600/20 rounded-lg">
                      <Target className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Total Scores</p>
                      <p className="text-2xl font-bold text-white">{playerStats.total_scores || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={getCardStyle('primary')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-600/20 rounded-lg">
                      <Trophy className="w-6 h-6 text-arcade-neonYellow" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">First Places</p>
                      <p className="text-2xl font-bold text-white">{playerStats.first_place_count || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={getCardStyle('primary')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-600/20 rounded-lg">
                      <TrendingUp className="w-6 h-6 text-arcade-neonCyan" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Best Score</p>
                      <p className="text-2xl font-bold text-white">{playerStats.best_score?.toLocaleString() || '0'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={getCardStyle('primary')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-600/20 rounded-lg">
                      <Gamepad2 className="w-6 h-6 text-arcade-neonPink" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Games Played</p>
                      <p className="text-2xl font-bold text-white">{playerStats.total_games_played || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="bg-gray-800/50 rounded-lg p-8">
                <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-bold text-white mb-2">No Player Stats Available</h3>
                <p className="text-gray-400 mb-4">
                  This player hasn't submitted any scores yet, or the achievement system isn't set up.
                </p>
                <div className="space-y-2 text-sm text-gray-500">
                  <p>• Make sure the player has submitted scores</p>
                  <p>• Check if the achievement system is properly configured</p>
                  <p>• Try refreshing the page</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Achievements */}
            <Card className={getCardStyle('primary')}>
              <CardHeader>
                <CardTitle className={getTypographyStyle('h4') + " flex items-center gap-2"}>
                  <Trophy className="w-5 h-5 text-arcade-neonYellow" />
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
                        {playerStats.current_streak || 0} games
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Longest Streak</span>
                      <Badge variant="outline" className="border-purple-500 text-purple-400">
                        {playerStats.longest_streak || 0} games
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
              playerName={selectedPlayer || ''} 
            />
          </div>

          {/* All Achievements */}
          <PlayerAchievements playerName={selectedPlayer} />
        </PageContainer>
      </div>
    );
  }

  // Show player list view
  return (
    <div {...pageLayout}>
      <PageContainer className="max-w-6xl mx-auto">
        <PageHeader 
          title="Achievements"
          subtitle="Player dashboards and achievement progress"
        >
          <Button
            onClick={() => navigate('/')}
            variant="outline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Main
          </Button>
        </PageHeader>

        {/* Search */}
        <Card className={getCardStyle('primary')}>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
              />
            </div>
          </CardContent>
        </Card>

        {/* Player List */}
        <Card className={getCardStyle('primary')}>
          <CardHeader>
            <CardTitle className={getTypographyStyle('h4') + " flex items-center gap-2"}>
              <User className="w-5 h-5 text-arcade-neonCyan" />
              Players with Achievements ({filteredPlayers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPlayers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlayers.map((player) => (
                  <Card 
                    key={player.player_name} 
                    className="bg-gray-800/50 border-gray-600 transition-colors cursor-pointer"
                    onClick={() => handlePlayerSelect(player.player_name)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-white text-2xl truncate pr-2">
                          {player.player_name}
                        </h3>
                        <Badge variant="secondary" className="bg-yellow-600 text-yellow-100 shrink-0">
                          {player.total_points} pts
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Achievements</span>
                          <span className="text-white font-semibold">{player.achievement_count}</span>
                        </div>
                        {player.latest_achievement && (
                          <div className="space-y-1">
                            <span className="text-gray-400 text-xs">Latest Achievement:</span>
                            <p className="text-white font-medium text-sm truncate">
                              {player.latest_achievement}
                            </p>
                            <p className="text-gray-500 text-xs">
                              {player.latest_achievement_date && 
                                new Date(player.latest_achievement_date).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
                <h3 className="text-xl font-bold text-white mb-2">
                  {searchTerm ? 'No matching players found' : 'No achievements unlocked yet'}
                </h3>
                <p className="text-gray-400">
                  {searchTerm 
                    ? 'Try adjusting your search term'
                    : 'Players will appear here once they start unlocking achievements!'
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
};

export default Achievements;
