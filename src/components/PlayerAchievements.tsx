import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api-client';
import AchievementBadge from './AchievementBadge';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/contexts/TournamentContext';

interface Achievement {
  id: string;
  name: string;
  description: string;
  type: string;
  badge_icon: string;
  badge_color: string;
  criteria: any;
  points: number;
  is_active: boolean;
}

interface PlayerAchievement {
  id: string;
  player_name: string;
  achievement_id: string;
  unlocked_at: string;
  game_id: string | null;
  score: number | null;
  metadata: any;
  achievements: Achievement;
}

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

interface PlayerAchievementsProps {
  playerName: string;
}

const PlayerAchievements: React.FC<PlayerAchievementsProps> = ({ playerName }) => {
  const { user } = useAuth();
  const { userTournaments } = useTournament();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [playerAchievements, setPlayerAchievements] = useState<PlayerAchievement[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAchievementData();
  }, [playerName, userTournaments]);

  // Listen for achievement updates
  useEffect(() => {
    const handleAchievementsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { playerName: updatedPlayerName } = customEvent.detail;
      if (updatedPlayerName.toUpperCase() === playerName.toUpperCase()) {
        console.log('PlayerAchievements: Reloading data for updated player:', playerName);
        loadAchievementData();
      }
    };

    // Listen for local events
    window.addEventListener('achievementsUpdated', handleAchievementsUpdated);

    // Listen for cross-tab broadcasts
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      broadcastChannel = new BroadcastChannel('achievement-updates');
      broadcastChannel.onmessage = (event) => {
        const { playerName: updatedPlayerName } = event.data;
        if (updatedPlayerName.toUpperCase() === playerName.toUpperCase()) {
          console.log('PlayerAchievements: Broadcast reload for updated player:', playerName);
          loadAchievementData();
        }
      };
    } catch (error) {
      console.warn('BroadcastChannel not supported in PlayerAchievements');
    }

    // Listen for localStorage fallback
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'achievementUpdate' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          const { playerName: updatedPlayerName } = data;
          if (updatedPlayerName.toUpperCase() === playerName.toUpperCase()) {
            console.log('PlayerAchievements: localStorage reload for updated player:', playerName);
            loadAchievementData();
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
  }, [playerName]);

  const loadAchievementData = async () => {
    try {
      // Get tournament IDs created by the current user
      const userTournamentIds = userTournaments
        .filter(tournament => tournament.created_by === user?.id)
        .map(tournament => tournament.id);

      if (userTournamentIds.length === 0) {
        setAchievements([]);
        setPlayerAchievements([]);
        setPlayerStats(null);
        setLoading(false);
        return;
      }

      console.log('Loading achievements for player:', playerName, 'in tournaments:', userTournamentIds);

      // Load all achievements from user's tournaments
      const { data: achievementsData, error: achievementsError } = await api
        .from('achievements')
        .select('*')
        .in('tournament_id', userTournamentIds)
        .eq('is_active', true)
        .order('name');

      if (achievementsError) {
        console.warn('Error loading achievements:', achievementsError);
        setAchievements([]);
      } else {
        setAchievements(achievementsData || []);
      }

      // Load player's achievements from user's tournaments
      const { data: playerAchievementsData, error: playerAchievementsError } = await api
        .from('player_achievements')
        .select(`
          *,
          achievements (*)
        `)
        .eq('player_name', playerName.toUpperCase())
        .in('achievements.tournament_id', userTournamentIds)
        .order('unlocked_at', { ascending: false });

      if (playerAchievementsError) {
        console.warn('Error loading player achievements:', playerAchievementsError);
        setPlayerAchievements([]);
      } else {
        setPlayerAchievements(playerAchievementsData || []);
      }

      // Try to load player stats from user's tournaments
      let statsData = null;
      try {
        const { data, error: statsError } = await api
          .from('player_stats')
          .select('*')
          .eq('player_name', playerName.toUpperCase())
          .in('tournament_id', userTournamentIds)
          .single();

        if (statsError && statsError.code !== 'PGRST116') {
          console.warn('Player stats error:', statsError);
        } else {
          statsData = data;
        }
      } catch (statsErr) {
        console.warn('Player stats table might not exist:', statsErr);
      }

      setPlayerStats(statsData);
    } catch (error) {
      console.error('Error loading achievement data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUnlockedAchievementIds = () => {
    return new Set(playerAchievements.map(pa => pa.achievement_id));
  };

  const getAchievementProgress = (achievement: Achievement) => {
    if (!playerStats) return 0;

    if (achievement.type === 'first_score') {
      return playerStats.total_scores > 0 ? 100 : 0;
    }
    if (achievement.type === 'first_place') {
      return Math.min(
        (playerStats.first_place_count / (achievement.criteria?.game_count || 1)) * 100,
        100
      );
    }
    if (achievement.type === 'score_milestone') {
      return Math.min(
        (playerStats.best_score / (achievement.criteria?.min_score || 0)) * 100,
        100
      );
    }
    if (achievement.type === 'game_master') {
      return Math.min(
        (playerStats.total_games_played / (achievement.criteria?.game_count || 1)) * 100,
        100
      );
    }
    if (achievement.type === 'consistent_player') {
      return Math.min(
        (playerStats.total_scores / (achievement.criteria?.min_scores || 1)) * 100,
        100
      );
    }
    return 0;
  };

  const getTotalPoints = () => {
    return playerAchievements.reduce((total, pa) => total + pa.achievements.points, 0);
  };

  const getUnlockedCount = () => {
    return playerAchievements.length;
  };

  if (loading) {
    return (
      <Card className="bg-gray-900 border-white/20">
        <CardContent className="p-6">
          <div className="text-center text-gray-400">Loading achievements...</div>
        </CardContent>
      </Card>
    );
  }

  const unlockedIds = getUnlockedAchievementIds();

  return (
    <Card className="bg-gray-900 border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span>Achievements</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-yellow-600 text-yellow-100">
              {getUnlockedCount()}/{achievements.length}
            </Badge>
            <Badge variant="outline" className="border-yellow-500 text-yellow-400">
              {getTotalPoints()} pts
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800">
            <TabsTrigger value="all" className="data-[state=active]:bg-yellow-600">
              All ({achievements.length})
            </TabsTrigger>
            <TabsTrigger value="unlocked" className="data-[state=active]:bg-yellow-600">
              Unlocked ({getUnlockedCount()})
            </TabsTrigger>
            <TabsTrigger value="locked" className="data-[state=active]:bg-yellow-600">
              Locked ({achievements.length - getUnlockedCount()})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {achievements.map((achievement) => {
                const isUnlocked = unlockedIds.has(achievement.id);
                const progress = getAchievementProgress(achievement);
                const playerAchievement = playerAchievements.find(pa => pa.achievement_id === achievement.id);

                return (
                  <div key={achievement.id} className="text-center">
                    <AchievementBadge
                      name={achievement.name}
                      description={achievement.description}
                      badgeIcon={achievement.badge_icon}
                      badgeColor={achievement.badge_color}
                      points={achievement.points}
                      isUnlocked={isUnlocked}
                      unlockedAt={playerAchievement?.unlocked_at}
                      size="md"
                    />
                    <div className="mt-2">
                      <div className="text-xs text-gray-400 mb-1">
                        {achievement.name}
                      </div>
                      {!isUnlocked && progress > 0 && (
                        <Progress 
                          value={progress} 
                          className="h-1 bg-gray-700"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="unlocked" className="mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {playerAchievements.map((playerAchievement) => (
                <div key={playerAchievement.id} className="text-center">
                  <AchievementBadge
                    name={playerAchievement.achievements.name}
                    description={playerAchievement.achievements.description}
                    badgeIcon={playerAchievement.achievements.badge_icon}
                    badgeColor={playerAchievement.achievements.badge_color}
                    points={playerAchievement.achievements.points}
                    isUnlocked={true}
                    unlockedAt={playerAchievement.unlocked_at}
                    size="md"
                  />
                  <div className="mt-2">
                    <div className="text-xs text-gray-400 mb-1">
                      {playerAchievement.achievements.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(playerAchievement.unlocked_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="locked" className="mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {achievements
                .filter(achievement => !unlockedIds.has(achievement.id))
                .map((achievement) => {
                  const progress = getAchievementProgress(achievement);
                  
                  return (
                    <div key={achievement.id} className="text-center">
                      <AchievementBadge
                        name={achievement.name}
                        description={achievement.description}
                        badgeIcon={achievement.badge_icon}
                        badgeColor={achievement.badge_color}
                        points={achievement.points}
                        isUnlocked={false}
                        size="md"
                      />
                      <div className="mt-2">
                        <div className="text-xs text-gray-400 mb-1">
                          {achievement.name}
                        </div>
                        {progress > 0 && (
                          <Progress 
                            value={progress} 
                            className="h-1 bg-gray-700"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PlayerAchievements;
