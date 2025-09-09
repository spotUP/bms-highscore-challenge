import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';
import { useTournament } from '@/contexts/TournamentContext';

interface Game {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  include_in_challenge: boolean;
}

interface Score {
  id: string;
  player_name: string;
  score: number;
  game_id: string;
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

interface GameDataState {
  games: Game[];
  scores: Score[];
  leaders: PlayerScore[];
  achievementHunters: AchievementHunter[];
  demolitionManScores: DemolitionManScore[];
  loading: boolean;
  error: string | null;
}

// Global state to share across components
let globalState: GameDataState = {
  games: [],
  scores: [],
  leaders: [],
  achievementHunters: [],
  demolitionManScores: [],
  loading: true,
  error: null,
};

// Subscribers list
const subscribers: Array<(state: GameDataState) => void> = [];

// Subscription manager
let isSubscribed = false;
let subscriptionChannels: any[] = [];

const notifySubscribers = () => {
  subscribers.forEach(callback => callback({ ...globalState }));
};

const updateState = (updates: Partial<GameDataState>) => {
  globalState = { ...globalState, ...updates };
  notifySubscribers();
};

// Data loading functions
const loadGames = async () => {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('id, name, logo_url, is_active, include_in_challenge')
      .eq('is_active', true)
      .eq('include_in_challenge', true)
      .order('name', { ascending: true });

    if (error) throw error;
    updateState({ games: data || [] });
  } catch (error) {
    console.error('Error loading games:', error);
    updateState({ error: 'Failed to load games' });
  }
};

const loadScores = async () => {
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('id, player_name, score, game_id, created_at')
      .order('score', { ascending: false })
      .limit(200); // Increased limit for better leaderboard calculations

    if (error) throw error;
    updateState({ scores: data || [] });
  } catch (error) {
    console.error('Error loading scores:', error);
    updateState({ error: 'Failed to load scores' });
  }
};

const loadOverallLeaders = async () => {
  try {
    const { data: scores, error } = await supabase
      .from('scores')
      .select(`
        player_name, 
        score,
        game_id,
        games!inner(include_in_challenge, name)
      `)
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
        const points = Math.max(0, 100 - (index * 10));
        
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

    const leadersList: PlayerScore[] = Object.entries(playerStats)
      .map(([player_name, stats]) => ({
        player_name,
        total_score: stats.total_score,
        total_ranking_points: stats.total_ranking_points,
        game_count: stats.games.size
      }))
      .sort((a, b) => {
        if (b.total_ranking_points !== a.total_ranking_points) {
          return b.total_ranking_points - a.total_ranking_points;
        }
        return b.total_score - a.total_score;
      })
      .slice(0, 10);

    updateState({ leaders: leadersList });
  } catch (error) {
    console.error('Error loading overall leaders:', error);
  }
};

const loadAchievementHunters = async () => {
  try {
    const { data: achievementData, error } = await supabase
      .from('player_achievements')
      .select(`
        player_name,
        achievements!inner(points)
      `);

    if (error) throw error;

    const playerAchievements: Record<string, { achievement_count: number; total_points: number }> = {};

    achievementData?.forEach((item: any) => {
      if (!playerAchievements[item.player_name]) {
        playerAchievements[item.player_name] = {
          achievement_count: 0,
          total_points: 0
        };
      }
      playerAchievements[item.player_name].achievement_count++;
      playerAchievements[item.player_name].total_points += item.achievements.points;
    });

    const sortedHunters = Object.entries(playerAchievements)
      .map(([player_name, stats]) => ({
        player_name,
        achievement_count: stats.achievement_count,
        total_points: stats.total_points
      }))
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, 5);

    updateState({ achievementHunters: sortedHunters });
  } catch (error) {
    console.error('Error loading achievement hunters:', error);
    updateState({ achievementHunters: [] });
  }
};

const loadDemolitionManScores = async () => {
  try {
    // First ensure Demolition Man game exists
    const { data: gameId, error: ensureError } = await supabase
      .rpc('ensure_demolition_man_game');

    if (ensureError) {
      console.error('Error ensuring Demolition Man game:', ensureError);
    }

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

    const demolitionScores = scoreData?.map(item => ({
      player_name: item.player_name,
      score: item.score,
      created_at: item.created_at
    })) || [];

    updateState({ demolitionManScores: demolitionScores });
  } catch (error) {
    console.error('Error loading Demolition Man scores:', error);
    updateState({ demolitionManScores: [] });
  }
};

const setupSubscriptions = () => {
  if (isSubscribed) return;

  // Single scores subscription
  const scoresChannel = supabase
    .channel('global-scores')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'scores' 
      }, 
      () => {
        // Reload all score-dependent data
        loadScores();
        loadOverallLeaders();
        loadDemolitionManScores();
      }
    )
    .subscribe();

  // Single games subscription
  const gamesChannel = supabase
    .channel('global-games')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'games' 
      }, 
      () => {
        loadGames();
        loadOverallLeaders();
      }
    )
    .subscribe();

  // Single achievements subscription
  const achievementsChannel = supabase
    .channel('global-achievements')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'player_achievements' 
      }, 
      () => {
        loadAchievementHunters();
      }
    )
    .subscribe();

  subscriptionChannels = [scoresChannel, gamesChannel, achievementsChannel];
  isSubscribed = true;
};

const cleanupSubscriptions = () => {
  subscriptionChannels.forEach(channel => {
    supabase.removeChannel(channel);
  });
  subscriptionChannels = [];
  isSubscribed = false;
};

// Main hook
export const useGameData = () => {
  const [state, setState] = useState<GameDataState>(globalState);
  const { refreshInterval } = usePerformanceMode();

  useEffect(() => {
    // Subscribe to state changes
    const callback = (newState: GameDataState) => setState(newState);
    subscribers.push(callback);

    // Initial data load if not already loaded
    if (globalState.loading) {
      const loadAllData = async () => {
        updateState({ loading: true, error: null });
        await Promise.all([
          loadGames(),
          loadScores(),
          loadOverallLeaders(),
          loadAchievementHunters(),
          loadDemolitionManScores()
        ]);
        updateState({ loading: false });
      };
      loadAllData();
    }

    // Setup subscriptions
    setupSubscriptions();

    // Cleanup on unmount
    return () => {
      const index = subscribers.indexOf(callback);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
      
      // Only cleanup subscriptions if no more subscribers
      if (subscribers.length === 0) {
        cleanupSubscriptions();
      }
    };
  }, []);

  // Memoized values for performance
  const activeGames = useMemo(() => 
    state.games.filter(game => game.include_in_challenge), 
    [state.games]
  );

  const gameScores = useMemo(() => {
    const scoresByGame: Record<string, Score[]> = {};
    state.scores.forEach(score => {
      if (!scoresByGame[score.game_id]) {
        scoresByGame[score.game_id] = [];
      }
      scoresByGame[score.game_id].push(score);
    });
    
    // Sort scores for each game
    Object.keys(scoresByGame).forEach(gameId => {
      scoresByGame[gameId].sort((a, b) => b.score - a.score);
    });
    
    return scoresByGame;
  }, [state.scores]);

  const refetch = useCallback(() => {
    updateState({ loading: true, error: null });
    Promise.all([
      loadGames(),
      loadScores(),
      loadOverallLeaders(),
      loadAchievementHunters(),
      loadDemolitionManScores()
    ]).then(() => {
      updateState({ loading: false });
    });
  }, []);

  return {
    ...state,
    activeGames,
    gameScores,
    refetch
  };
};
