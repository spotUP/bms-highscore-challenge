import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseOptimizedDataOptions {
  enabled?: boolean;
  refetchInterval?: number;
  staleTime?: number;
}

interface Game {
  id: string;
  name: string;
  logo_url: string | null;
  include_in_challenge: boolean;
  is_active: boolean;
  tournament_id?: string | null;
}

interface Score {
  id: string;
  game_id: string;
  player_name: string;
  score: number;
  created_at: string;
  tournament_id?: string | null;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  badge_icon: string;
  badge_color: string;
  points: number;
  type: string;
  tournament_id?: string | null;
}

interface PlayerAchievement {
  player_name: string;
  achievement_id: string;
  unlocked_at: string;
  tournament_id?: string | null;
  game_id?: string | null;
}

// Cache for storing fetched data
const dataCache = new Map<string, { data: any; timestamp: number; staleTime: number }>();

export const useOptimizedData = (options: UseOptimizedDataOptions = {}) => {
  const { enabled = true, refetchInterval, staleTime = 5 * 60 * 1000 } = options; // 5 minutes default stale time
  
  const [games, setGames] = useState<Game[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [playerAchievements, setPlayerAchievements] = useState<PlayerAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getCachedData = useCallback((key: string) => {
    const cached = dataCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.staleTime) {
      return cached.data;
    }
    return null;
  }, []);

  const setCachedData = useCallback((key: string, data: any, staleTimeMs: number) => {
    dataCache.set(key, {
      data,
      timestamp: Date.now(),
      staleTime: staleTimeMs
    });
  }, []);

  const fetchGames = useCallback(async () => {
    const cacheKey = 'games';
    const cached = getCachedData(cacheKey);
    if (cached) {
      setGames(cached);
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('games')
        .select('id, name, logo_url, include_in_challenge, is_active, tournament_id')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      setCachedData(cacheKey, data || [], staleTime);
      setGames(data || []);
      return data || [];
    } catch (err) {
      console.error('Error fetching games:', err);
      setError('Failed to fetch games');
      return [];
    }
  }, [getCachedData, setCachedData, staleTime]);

  const fetchScores = useCallback(async () => {
    const cacheKey = 'scores';
    const cached = getCachedData(cacheKey);
    if (cached) {
      setScores(cached);
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('scores')
        .select('id, game_id, player_name, score, created_at, tournament_id')
        .order('created_at', { ascending: false })
        .limit(1000); // Limit to prevent excessive data

      if (error) throw error;
      
      setCachedData(cacheKey, data || [], staleTime);
      setScores(data || []);
      return data || [];
    } catch (err) {
      console.error('Error fetching scores:', err);
      setError('Failed to fetch scores');
      return [];
    }
  }, [getCachedData, setCachedData, staleTime]);

  const fetchAchievements = useCallback(async () => {
    const cacheKey = 'achievements';
    const cached = getCachedData(cacheKey);
    if (cached) {
      setAchievements(cached);
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('achievements')
        .select('id, name, description, badge_icon, badge_color, points, type, tournament_id')
        .order('points', { ascending: false });

      if (error) throw error;
      
      setCachedData(cacheKey, data || [], staleTime * 2); // Achievements change less frequently
      setAchievements(data || []);
      return data || [];
    } catch (err) {
      console.error('Error fetching achievements:', err);
      setError('Failed to fetch achievements');
      return [];
    }
  }, [getCachedData, setCachedData, staleTime]);

  const fetchPlayerAchievements = useCallback(async () => {
    const cacheKey = 'player_achievements';
    const cached = getCachedData(cacheKey);
    if (cached) {
      setPlayerAchievements(cached);
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('player_achievements')
        .select('player_name, achievement_id, unlocked_at, created_at, tournament_id')
        .order('unlocked_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setCachedData(cacheKey, data || [], staleTime);
      setPlayerAchievements(data || []);
      return data || [];
    } catch (err) {
      console.error('Error fetching player achievements:', err);
      setError('Failed to fetch player achievements');
      return [];
    }
  }, [getCachedData, setCachedData, staleTime]);

  const loadAllData = useCallback(async () => {
    if (!enabled) return;
    
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchGames(),
        fetchScores(),
        fetchAchievements(),
        fetchPlayerAchievements()
      ]);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchGames, fetchScores, fetchAchievements, fetchPlayerAchievements]);

  // Memoized computed values
  const activeGames = useMemo(() => 
    games.filter(game => game.include_in_challenge), 
    [games]
  );

  const recentScores = useMemo(() => 
    scores.slice(0, 50), // Only keep recent 50 scores for performance
    [scores]
  );

  const topPlayers = useMemo(() => {
    const playerTotals = scores.reduce((acc, score) => {
      acc[score.player_name] = (acc[score.player_name] || 0) + score.score;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(playerTotals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [scores]);

  // Auto-refetch if interval is set
  useEffect(() => {
    if (!refetchInterval) return;

    const interval = setInterval(loadAllData, refetchInterval);
    return () => clearInterval(interval);
  }, [loadAllData, refetchInterval]);

  // Initial load
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const refetch = useCallback(() => {
    // Clear cache and reload
    dataCache.clear();
    loadAllData();
  }, [loadAllData]);

  return {
    games: activeGames,
    allGames: games,
    scores: recentScores,
    allScores: scores,
    achievements,
    playerAchievements,
    topPlayers,
    loading,
    error,
    refetch
  };
};
