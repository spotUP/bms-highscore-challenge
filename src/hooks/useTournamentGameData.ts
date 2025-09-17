import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';
import { useTournament } from '@/contexts/TournamentContext';
import { usePi5Polling } from '@/hooks/usePi5Polling';
import { dlog } from '@/lib/debug';

interface Game {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  include_in_challenge: boolean;
  tournament_id: string;
}

interface Score {
  id: string;
  player_name: string;
  score: number;
  game_id: string;
  tournament_id: string;
  created_at: string;
}

interface PlayerScore {
  player_name: string;
  total_score: number;
  total_ranking_points: number;
  game_count: number;
}

interface AchievementHunter {
  player_name: string;
  achievement_count: number;
  total_points: number;
}

interface DemolitionManScore {
  player_name: string;
  score: number;
  created_at: string;
}

interface TournamentGameDataState {
  games: Game[];
  scores: Score[];
  leaders: PlayerScore[];
  achievementHunters: AchievementHunter[];
  demolitionManScores: DemolitionManScore[];
  loading: boolean;
  error: string | null;
}

export const useTournamentGameData = () => {
  const { currentTournament } = useTournament();
  const { refreshInterval } = usePerformanceMode();
  
  const [state, setState] = useState<TournamentGameDataState>({
    games: [],
    scores: [],
    leaders: [],
    achievementHunters: [],
    demolitionManScores: [],
    loading: true,
    error: null,
  });

  // Load games for current tournament
  const loadGames = useCallback(async () => {
    dlog('useTournamentGameData: loadGames called, currentTournament:', currentTournament);
    if (!currentTournament) {
      dlog('useTournamentGameData: No current tournament, skipping');
      return;
    }

    try {
      dlog('useTournamentGameData: Loading games for tournament:', currentTournament.id);
      // Load games with tournament_id filter
      const { data, error } = await supabase
        .from('games')
        .select('id, name, logo_url, is_active, include_in_challenge, tournament_id')
        .eq('tournament_id', currentTournament.id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      dlog('useTournamentGameData: Games query result:', { data, error });

      if (error) throw error;

      setState(prev => ({ ...prev, games: data || [] }));
      dlog('useTournamentGameData: Successfully loaded', data?.length || 0, 'games');
    } catch (error) {
      console.error('Error loading games:', error);
      setState(prev => ({ ...prev, error: 'Failed to load games' }));
    }
  }, [currentTournament]);

  // Load scores for current tournament
  const loadScores = useCallback(async () => {
    dlog('useTournamentGameData: loadScores called, currentTournament:', currentTournament);
    if (!currentTournament) {
      dlog('useTournamentGameData: No current tournament, skipping scores');
      return;
    }

    try {
      dlog('useTournamentGameData: Loading scores for tournament:', currentTournament.id);
      // Load scores with tournament_id filter
      const { data, error } = await supabase
        .from('scores')
        .select('id, player_name, score, game_id, tournament_id, created_at')
        .eq('tournament_id', currentTournament.id)
        .order('score', { ascending: false })
        .limit(500);

      dlog('useTournamentGameData: Scores query result:', { data: data?.slice(0, 3), error, totalCount: data?.length });

      if (error) throw error;

      setState(prev => ({ ...prev, scores: data || [] }));
      dlog('useTournamentGameData: Successfully loaded', data?.length || 0, 'scores');
    } catch (error) {
      console.error('Error loading scores:', error);
      setState(prev => ({ ...prev, error: 'Failed to load scores' }));
    }
  }, [currentTournament]);

  // Load overall leaders for current tournament
  const loadOverallLeaders = useCallback(async () => {
    if (!currentTournament) return;

    try {
      // Load scores with tournament_id filter
      const { data: scores, error } = await supabase
        .from('scores')
        .select(`
          player_name, 
          score,
          game_id,
          games!inner(include_in_challenge, name)
        `)
        .eq('tournament_id', currentTournament.id)
        .eq('games.include_in_challenge', true)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Group scores by game and calculate points
      const scoresByGame = scores?.reduce((acc: Record<string, any[]>, score) => {
        if (!acc[score.game_id]) acc[score.game_id] = [];
        acc[score.game_id].push(score);
        return acc;
      }, {}) || {};

      // Calculate ranking points for each player
      const playerStats: Record<string, { total_score: number; total_ranking_points: number; games: Set<string> }> = {};

      Object.values(scoresByGame).forEach((gameScores: any[]) => {
        const sortedScores = gameScores.sort((a, b) => b.score - a.score);
        const playerBestScores = new Map();

        sortedScores.forEach(score => {
          if (!playerBestScores.has(score.player_name) || 
              playerBestScores.get(score.player_name).score < score.score) {
            playerBestScores.set(score.player_name, score);
          }
        });

        const rankedPlayers = Array.from(playerBestScores.values())
          .sort((a, b) => b.score - a.score);

        rankedPlayers.forEach((score, index) => {
          const points = Math.max(10 - index, 1);
          if (!playerStats[score.player_name]) {
            playerStats[score.player_name] = { 
              total_score: 0, 
              total_ranking_points: 0, 
              games: new Set() 
            };
          }
          playerStats[score.player_name].total_score += score.score;
          playerStats[score.player_name].total_ranking_points += points;
          playerStats[score.player_name].games.add(score.game_id);
        });
      });

      const leaders = Object.entries(playerStats)
        .map(([player_name, stats]) => ({
          player_name,
          total_score: stats.total_score,
          total_ranking_points: stats.total_ranking_points,
          game_count: stats.games.size,
        }))
        .sort((a, b) => b.total_ranking_points - a.total_ranking_points)
        .slice(0, 5);

      setState(prev => ({ ...prev, leaders }));
    } catch (error) {
      console.error('Error loading overall leaders:', error);
      setState(prev => ({ ...prev, error: 'Failed to load leaders' }));
    }
  }, [currentTournament]);

  // Load achievement hunters for current tournament
  const loadAchievementHunters = useCallback(async () => {
    if (!currentTournament) return;

    try {
      // Load achievements with tournament_id filter
      const { data, error } = await supabase
        .from('player_achievements')
        .select(`
          player_name,
          achievements!inner(points)
        `)
        .eq('tournament_id', currentTournament.id);

      if (error) throw error;

      const achievementStats = data?.reduce((acc: Record<string, { count: number; total_points: number }>, item) => {
        if (!acc[item.player_name]) {
          acc[item.player_name] = { count: 0, total_points: 0 };
        }
        acc[item.player_name].count += 1;
        acc[item.player_name].total_points += item.achievements.points;
        return acc;
      }, {} as Record<string, { count: number; total_points: number }>) || {};

      const achievementHunters = Object.entries(achievementStats)
        .map(([player_name, stats]: [string, { count: number; total_points: number }]) => ({
          player_name,
          achievement_count: stats.count,
          total_points: stats.total_points,
        }))
        .sort((a, b) => b.achievement_count - a.achievement_count)
        .slice(0, 5);

      setState(prev => ({ ...prev, achievementHunters }));
    } catch (error) {
      console.error('Error loading achievement hunters:', error);
      setState(prev => ({ ...prev, error: 'Failed to load achievement hunters' }));
    }
  }, [currentTournament]);

  // Load Demolition Man scores for current tournament
  const loadDemolitionManScores = useCallback(async () => {
    if (!currentTournament) return;

    try {
      // Load Demolition Man scores with tournament_id filter
      const { data: scoreData, error } = await supabase
        .from('scores')
        .select(`
          player_name,
          score,
          created_at,
          games!inner(name)
        `)
        .eq('tournament_id', currentTournament.id)
        .eq('games.name', 'Standing Competition')
        .order('score', { ascending: false })
        .limit(5);

      if (error) throw error;

      const demolitionScores = scoreData?.map(item => ({
        player_name: item.player_name,
        score: item.score,
        created_at: item.created_at
      })) || [];

      setState(prev => ({ ...prev, demolitionManScores: demolitionScores }));
    } catch (error) {
      console.error('Error loading Demolition Man scores:', error);
      setState(prev => ({ ...prev, error: 'Failed to load Demolition Man scores' }));
    }
  }, [currentTournament]);

  // Load all data
  const loadAllData = useCallback(async () => {
    if (!currentTournament) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      await Promise.all([
        loadGames(),
        loadScores(),
        loadOverallLeaders(),
        loadAchievementHunters(),
        loadDemolitionManScores(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setState(prev => ({ ...prev, error: 'Failed to load tournament data' }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [currentTournament, loadGames, loadScores, loadOverallLeaders, loadAchievementHunters, loadDemolitionManScores]);

  // Refresh function
  const refetch = useCallback(() => {
    loadAllData();
  }, [loadAllData]);

  // Pi 5 aggressive polling for Firefox compatibility
  const { forcePoll, isPi5 } = usePi5Polling({
    enabled: !!currentTournament,
    interval: 5000, // Poll every 5 seconds on Pi 5 with Firefox (more aggressive)
    onPoll: () => {
      refetch();
    },
    onVisibilityChange: () => {
      refetch();
    }
  });

  // Debounced refetch to avoid burst updates from realtime events
  const debouncedRef = useRef<number | null>(null);
  const debouncedRefetch = useCallback(() => {
    // Skip updates during tests to prevent animations
    if (window.localStorage.getItem('suppressAnimations') === 'true') {
      return;
    }

    if (debouncedRef.current) {
      clearTimeout(debouncedRef.current);
    }
    // Batch multiple events within 300ms into a single reload
    debouncedRef.current = window.setTimeout(() => {
      debouncedRef.current = null;
      refetch();
    }, 300);
  }, [refetch]);

  // Set up subscriptions for real-time updates
  useEffect(() => {
    if (!currentTournament) return;

    const scoresChannel = supabase
      .channel(`scores-${currentTournament.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
          filter: `tournament_id=eq.${currentTournament.id}`,
        },
        () => {
          debouncedRefetch();
        }
      )
      .subscribe();

    const gamesChannel = supabase
      .channel(`games-${currentTournament.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `tournament_id=eq.${currentTournament.id}`,
        },
        () => {
          debouncedRefetch();
        }
      )
      .subscribe();

    const achievementsChannel = supabase
      .channel(`achievements-${currentTournament.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_achievements',
          filter: `tournament_id=eq.${currentTournament.id}`,
        },
        () => {
          debouncedRefetch();
        }
      )
      .subscribe();

    return () => {
      scoresChannel.unsubscribe();
      gamesChannel.unsubscribe();
      achievementsChannel.unsubscribe();
      if (debouncedRef.current) {
        clearTimeout(debouncedRef.current);
        debouncedRef.current = null;
      }
    };
  }, [currentTournament?.id, debouncedRefetch]); // Only depend on tournament ID and debouncedRefetch

  // Load data when tournament changes
  useEffect(() => {
    loadAllData();
  }, [currentTournament?.id]); // Only depend on tournament ID, not the loadAllData function

  // Get Pi detection at hook level
  const { isRaspberryPi } = usePerformanceMode();

  // Periodic refresh based on performance settings - more frequent for Pi
  useEffect(() => {
    if (!currentTournament) return;

    // Use more aggressive refresh for Pi devices
    const actualRefreshInterval = isRaspberryPi ? Math.min(refreshInterval, 10000) : refreshInterval;

    const interval = setInterval(() => {
      // Skip periodic refresh during tests to prevent animations
      if (window.localStorage.getItem('suppressAnimations') === 'true') {
        return;
      }
      loadAllData();
    }, actualRefreshInterval);

    return () => clearInterval(interval);
  }, [currentTournament?.id, refreshInterval, isRaspberryPi]); // Don't depend on loadAllData function

  // Memoized derived data
  const activeGames = useMemo(() => {
    return state.games.filter(game => game.is_active && game.include_in_challenge);
  }, [state.games]);

  const gameScores = useMemo(() => {
    const scoresByGame: Record<string, Score[]> = {};
    
    state.scores.forEach(score => {
      if (!scoresByGame[score.game_id]) {
        scoresByGame[score.game_id] = [];
      }
      scoresByGame[score.game_id].push(score);
    });

    // Sort scores for each game and keep only top 5
    Object.keys(scoresByGame).forEach(gameId => {
      scoresByGame[gameId] = scoresByGame[gameId]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    });

    return scoresByGame;
  }, [state.scores]);

  return {
    ...state,
    activeGames,
    gameScores,
    refetch,
  };
};
