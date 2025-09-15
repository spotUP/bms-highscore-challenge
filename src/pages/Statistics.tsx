import React, { useState, useEffect, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePageTransitions } from '@/hooks/usePageTransitions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Medal, Award, Users, Gamepad2, Target, Calendar, ArrowLeft, BarChart3 } from 'lucide-react';
import { formatScore } from '@/lib/utils';
import { useOptimizedData } from '@/hooks/useOptimizedData';
import { LazyCharts } from '@/utils/dynamicImports';
import { getPageLayout, getCardStyle, getButtonStyle, getTypographyStyle, PageHeader, PageContainer, LoadingSpinner } from '@/utils/designSystem';
import { useTournament } from '@/contexts/TournamentContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend
} from 'recharts';

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

interface StatisticsProps {
  isExiting?: boolean;
}

const Statistics: React.FC<StatisticsProps> = ({ isExiting = false }) => {
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
    loading: dataLoading,
    refetch
  } = useOptimizedData({ refetchInterval: 10000 }); // Faster refresh every 10 seconds

  // Tournament context for filters
  const { currentTournament, userTournaments, switchTournament } = useTournament();
  // Top-level tournament selection for this page. 'all' by default.
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('all');

  // Player achievements filters
  const [achvTournamentFilter, setAchvTournamentFilter] = useState<string>('all');
  const [achvSearch, setAchvSearch] = useState<string>('');
  const [achvFrom, setAchvFrom] = useState<string>('');
  const [achvTo, setAchvTo] = useState<string>('');
  const [achvShowCount, setAchvShowCount] = useState<number>(25);
  // Monthly analytics controls
  const [windowType, setWindowType] = useState<'last30' | 'this_month' | 'prev_month'>('last30');
  const [topN, setTopN] = useState<5 | 10>(5);

  // URL search params for deep-linkable filters
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters from URL once on mount
  useEffect(() => {
    const t = searchParams.get('t');
    if (t) {
      setSelectedTournamentId(t);
      setAchvTournamentFilter(t);
    }
    const w = searchParams.get('w') as 'last30' | 'this_month' | 'prev_month' | null;
    if (w === 'last30' || w === 'this_month' || w === 'prev_month') {
      setWindowType(w);
    }
    const nStr = searchParams.get('n');
    const n = nStr ? Number(nStr) : undefined;
    if (n === 10) setTopN(10);
    if (n === 5) setTopN(5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep URL in sync when filters change
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('t', selectedTournamentId);
    next.set('w', windowType);
    next.set('n', String(topN));
    setSearchParams(next, { replace: true });
  }, [selectedTournamentId, windowType, topN, searchParams, setSearchParams]);

  useEffect(() => {
    loadCompetitions();
  }, []);

  useEffect(() => {
    if (selectedCompetition) {
      loadCompetitionData(selectedCompetition);
    }
  }, [selectedCompetition]);

  // Continuous updates: periodically refresh competition data and list
  useEffect(() => {
    const scoresTimer = setInterval(() => {
      if (selectedCompetition) {
        loadCompetitionData(selectedCompetition);
      }
    }, 15000); // every 15s

    const compsTimer = setInterval(() => {
      loadCompetitions();
    }, 60000); // every 60s

    return () => {
      clearInterval(scoresTimer);
      clearInterval(compsTimer);
    };
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
        return <Trophy className="w-12 h-12 text-yellow-400" />;
      case 2:
        return <Medal className="w-12 h-12 text-gray-300" />;
      case 3:
        return <Award className="w-12 h-12 text-orange-600" />;
      default:
        return <span className="w-12 h-12 flex items-center justify-center text-3xl font-bold text-white">#{rank}</span>;
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

  // Filtered data by selected tournament (for achievements-related sections)
  const isAllTournaments = selectedTournamentId === 'all';
  const filteredAchievements = React.useMemo(() => {
    if (isAllTournaments) return achievements || [];
    return (achievements || []).filter((a: any) => a?.tournament_id === selectedTournamentId);
  }, [achievements, selectedTournamentId, isAllTournaments]);
  const filteredPlayerAchievements = React.useMemo(() => {
    if (isAllTournaments) return playerAchievements || [];
    return (playerAchievements || []).filter((pa: any) => pa?.tournament_id === selectedTournamentId);
  }, [playerAchievements, selectedTournamentId, isAllTournaments]);
  const filteredScores = React.useMemo(() => {
    if (isAllTournaments) return currentScores || [];
    return (currentScores || []).filter((s: any) => s?.tournament_id === selectedTournamentId);
  }, [currentScores, selectedTournamentId, isAllTournaments]);
  const filteredGames = React.useMemo(() => {
    if (isAllTournaments) return currentGames || [];
    return (currentGames || []).filter((g: any) => g?.tournament_id === selectedTournamentId);
  }, [currentGames, selectedTournamentId, isAllTournaments]);

  // Tournament-based Top Players and Game Statistics
  const topPlayers = React.useMemo(() => {
    const map = new Map<string, { player_name: string; total_score: number; games_played: number; best_score: number }>();
    (filteredScores || []).forEach((s: any) => {
      const key = s.player_name;
      const entry = map.get(key) || { player_name: key, total_score: 0, games_played: 0, best_score: 0 };
      entry.total_score += Number(s.score) || 0;
      entry.games_played += 1;
      entry.best_score = Math.max(entry.best_score, Number(s.score) || 0);
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.total_score - a.total_score).slice(0, 10);
  }, [filteredScores]);

  const gameStatsTournament = React.useMemo(() => {
    const nameById = new Map<string, string>();
    (filteredGames || []).forEach((g: any) => nameById.set(g.id, g.name));
    const stats: Record<string, { totalScores: number; topPlayer: string; topScore: number }> = {};
    (filteredScores || []).forEach((s: any) => {
      const gameName = nameById.get(s.game_id) || 'Unknown Game';
      if (!stats[gameName]) {
        stats[gameName] = { totalScores: 0, topPlayer: s.player_name, topScore: Number(s.score) || 0 };
      }
      stats[gameName].totalScores += 1;
      if ((Number(s.score) || 0) > stats[gameName].topScore) {
        stats[gameName].topPlayer = s.player_name;
        stats[gameName].topScore = Number(s.score) || 0;
      }
    });
    return stats;
  }, [filteredScores, filteredGames]);

  // Build player achievement summaries (similar to Achievements page cards) from filtered data
  const playerSummaries = React.useMemo(() => {
    try {
      const map = new Map<string, { player_name: string; achievement_count: number; total_points: number; latest_achievement: string | null; latest_achievement_date: string | null }>();
      const achById = new Map<string, any>();
      (filteredAchievements || []).forEach((a: any) => achById.set(a.id, a));
      (filteredPlayerAchievements || []).forEach((pa: any) => {
        const name = pa.player_name;
        const ach = achById.get(pa.achievement_id);
        const pts = ach?.points || 0;
        const existing = map.get(name);
        const ts = new Date(pa.unlocked_at || pa.created_at || Date.now()).toISOString();
        if (existing) {
          existing.achievement_count += 1;
          existing.total_points += pts;
          // keep most recent
          if (!existing.latest_achievement_date || ts > existing.latest_achievement_date) {
            existing.latest_achievement = ach?.name || existing.latest_achievement;
            existing.latest_achievement_date = ts;
          }
        } else {
          map.set(name, {
            player_name: name,
            achievement_count: 1,
            total_points: pts,
            latest_achievement: ach?.name || null,
            latest_achievement_date: ts,
          });
        }
      });
      return Array.from(map.values()).sort((a, b) => b.total_points - a.total_points);
    } catch {
      return [] as any[];
    }
  }, [filteredPlayerAchievements, filteredAchievements]);
  const selectedComp = getSelectedCompetition();
  const gameStats = getGameStats();

  const pageLayout = getPageLayout();

  // Animation state - only animate once on initial load
  const [hasAnimated, setHasAnimated] = useState(false);
  const shouldAnimate = !loading && !dataLoading;

  useEffect(() => {
    if (shouldAnimate && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [shouldAnimate, hasAnimated]);

  // Deterministic Tron edge runner style per card (desync animation)
  const getRunnerStyle = (seed: string) => {
    try {
      let h = 0;
      for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
      const delay = (h % 2000) / 1000; // 0-2s
      const duration = 7 + ((h >> 3) % 4000) / 1000; // 7-11s
      return {
        ['--runner-delay' as any]: `${delay}s`,
        ['--runner-duration' as any]: `${duration}s`,
      } as React.CSSProperties;
    } catch {
      return {} as React.CSSProperties;
    }
  };
  
  // --- Tournament summary (name, date window from filtered scores, totals) ---
  const tournamentSummary = React.useMemo(() => {
    const isAll = selectedTournamentId === 'all';
    const name = isAll ? 'All Tournaments' : (userTournaments?.find(t => t.id === selectedTournamentId)?.name || 'Tournament');
    const dates = (filteredScores || []).map((s: any) => new Date(s.created_at).getTime());
    const start = dates.length ? new Date(Math.min(...dates)) : null;
    const end = dates.length ? new Date(Math.max(...dates)) : null;
    const totalScores = (filteredScores || []).length;
    const totalPlayers = Array.from(new Set((filteredScores || []).map((s: any) => s.player_name))).length;
    return { name, start, end, totalScores, totalPlayers };
  }, [filteredScores, selectedTournamentId, userTournaments]);

  // --- Achievement leaderboards (by points and by count) ---
  const leaderboardByPoints = React.useMemo(() => {
    const pointsByAch = new Map<string, number>();
    (filteredAchievements || []).forEach((a: any) => pointsByAch.set(a.id, Number(a.points) || 0));
    const map = new Map<string, number>();
    (filteredPlayerAchievements || []).forEach((pa: any) => {
      const p = pointsByAch.get(pa.achievement_id) || 0;
      map.set(pa.player_name, (map.get(pa.player_name) || 0) + p);
    });
    return Array.from(map.entries()).map(([player, pts]) => ({ player, pts }))
      .sort((a, b) => b.pts - a.pts).slice(0, 10);
  }, [filteredPlayerAchievements, filteredAchievements]);

  const leaderboardByCount = React.useMemo(() => {
    const map = new Map<string, number>();
    (filteredPlayerAchievements || []).forEach((pa: any) => {
      map.set(pa.player_name, (map.get(pa.player_name) || 0) + 1);
    });
    return Array.from(map.entries()).map(([player, count]) => ({ player, count }))
      .sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filteredPlayerAchievements]);

  
  
  // --- Monthly window helpers ---
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const last30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const inWindow = (d: Date) => {
    if (windowType === 'this_month') return d >= startOfThisMonth && d <= now;
    if (windowType === 'prev_month') return d >= startOfPrevMonth && d <= endOfPrevMonth;
    return d >= last30Start && d <= now; // last30
  };
  const inPrevWindow = (d: Date) => {
    if (windowType === 'this_month') return d >= startOfPrevMonth && d <= endOfPrevMonth;
    if (windowType === 'prev_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - 1, 0);
      return d >= start && d <= end;
    }
    // last30 previous window
    const prevEnd = new Date(last30Start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - 30 * 24 * 60 * 60 * 1000 + 1);
    return d >= prevStart && d <= prevEnd;
  };

  // Windowed datasets
  const windowedScores = React.useMemo(() => {
    return (filteredScores || []).filter((s: any) => inWindow(new Date(s.created_at)));
  }, [filteredScores, windowType]);
  const prevWindowScores = React.useMemo(() => {
    return (filteredScores || []).filter((s: any) => inPrevWindow(new Date(s.created_at)));
  }, [filteredScores, windowType]);
  const windowedPlayerAchievements = React.useMemo(() => {
    return (filteredPlayerAchievements || []).filter((pa: any) => inWindow(new Date(pa.unlocked_at)));
  }, [filteredPlayerAchievements, windowType]);

  // --- CSV Exports (placed after windowed datasets to avoid TDZ) ---
  const downloadCSV = React.useCallback((filename: string, headers: string[], rows: (string | number)[][]) => {
    const escape = (v: any) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const csv = [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportScores = React.useCallback(() => {
    const rows = (windowedScores || []).map((s: any) => [
      s.player_name,
      s.game_id || '',
      s.score,
      s.created_at,
      s.tournament_id || ''
    ]);
    const t = selectedTournamentId === 'all' ? 'all' : selectedTournamentId.slice(0, 8);
    downloadCSV(`scores_${t}_${windowType}.csv`, ['player_name','game_id','score','created_at','tournament_id'], rows);
  }, [windowedScores, selectedTournamentId, windowType, downloadCSV]);

  const handleExportAchievements = React.useCallback(() => {
    const rows = (windowedPlayerAchievements || []).map((pa: any) => [
      pa.player_name,
      pa.achievement_id,
      (filteredAchievements || []).find((a: any) => a.id === pa.achievement_id)?.name || '',
      (filteredAchievements || []).find((a: any) => a.id === pa.achievement_id)?.points || 0,
      pa.unlocked_at,
      pa.tournament_id || ''
    ]);
    const t = selectedTournamentId === 'all' ? 'all' : selectedTournamentId.slice(0, 8);
    downloadCSV(`achievements_${t}_${windowType}.csv`, ['player_name','achievement_id','achievement_name','points','unlocked_at','tournament_id'], rows);
  }, [windowedPlayerAchievements, filteredAchievements, selectedTournamentId, windowType, downloadCSV]);

  // Player score improvement (deltas)
  const improvementData = React.useMemo(() => {
    const sumBy = (arr: any[]) => {
      const m = new Map<string, number>();
      arr.forEach((s: any) => m.set(s.player_name, (m.get(s.player_name) || 0) + Number(s.score || 0)));
      return m;
    };
    const cur = sumBy(windowedScores);
    const prev = sumBy(prevWindowScores);
    const players = new Set<string>([...cur.keys(), ...prev.keys()]);
    const rows = Array.from(players).map(name => ({
      player: name,
      delta: (cur.get(name) || 0) - (prev.get(name) || 0)
    })).sort((a, b) => b.delta - a.delta).slice(0, 15);
    return rows;
  }, [windowedScores, prevWindowScores]);

  // Leaderboard volatility: daily ranks (lower is better)
  const volatilitySeries = React.useMemo(() => {
    // Build per-day totals per player
    const byDayPlayer = new Map<string, Map<string, number>>();
    windowedScores.forEach((s: any) => {
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
      const inner = byDayPlayer.get(key) || new Map<string, number>();
      inner.set(s.player_name, (inner.get(s.player_name) || 0) + Number(s.score || 0));
      byDayPlayer.set(key, inner);
    });
    const days = Array.from(byDayPlayer.keys()).sort();
    // Select topN players by total in window
    const totals = new Map<string, number>();
    windowedScores.forEach((s: any) => totals.set(s.player_name, (totals.get(s.player_name) || 0) + Number(s.score || 0)));
    const topPlayers = Array.from(totals.entries()).sort((a,b)=>b[1]-a[1]).slice(0, topN).map(e=>e[0]);
    // Build rank lines
    const series: Record<string, { day: string; rank: number }[]> = {};
    days.forEach(day => {
      const inner = byDayPlayer.get(day)!;
      const ranked = Array.from(inner.entries()).sort((a,b)=>b[1]-a[1]).map(([name], idx)=>({name, rank: idx+1}));
      const rankMap = new Map<string, number>(ranked.map(r=>[r.name, r.rank] as [string, number]));
      topPlayers.forEach(p => {
        const arr = series[p] || [];
        arr.push({ day, rank: rankMap.get(p) || ranked.length + 1 });
        series[p] = arr;
      });
    });
    return { days, series, players: topPlayers };
  }, [windowedScores, topN]);

  // Heatmap: 7x24 scoring activity
  const heatmap = React.useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    windowedScores.forEach((s: any) => {
      const d = new Date(s.created_at);
      const dow = d.getDay(); // 0=Sun
      const hr = d.getHours();
      grid[dow][hr] += 1;
    });
    const max = grid.flat().reduce((m, v) => Math.max(m, v), 0) || 1;
    return { grid, max };
  }, [windowedScores]);

  // Player achievement progression: cumulative per player
  const progression = React.useMemo(() => {
    // Build per-day cumulative counts for topN players by unlock count
    const counts = new Map<string, number>();
    windowedPlayerAchievements.forEach((pa: any) => counts.set(pa.player_name, (counts.get(pa.player_name) || 0) + 1));
    const top = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0, topN).map(e=>e[0]);
    const byDay = new Map<string, Map<string, number>>();
    windowedPlayerAchievements.forEach((pa: any) => {
      const d = new Date(pa.unlocked_at);
      const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
      const m = byDay.get(key) || new Map<string, number>();
      m.set(pa.player_name, (m.get(pa.player_name) || 0) + 1);
      byDay.set(key, m);
    });
    const days = Array.from(byDay.keys()).sort();
    const cum: Record<string, number> = {};
    const rows = days.map(day => {
      const inner = byDay.get(day)!;
      const row: any = { day };
      top.forEach(p => {
        cum[p] = (cum[p] || 0) + (inner.get(p) || 0);
        row[p] = cum[p];
      });
      return row;
    });
    return { days, rows, players: top };
  }, [windowedPlayerAchievements, topN]);
  
  // Guard after all hooks are declared to preserve hook order
  if (loading) {
    return null;
  }
  
  return (
    <div {...pageLayout} className={`${pageLayout.className || ''}`}>
      <PageContainer className="max-w-6xl mx-auto">
        <div className={`${isExiting ? 'animate-slide-out-bottom' : hasAnimated ? 'animate-slide-in-bottom' : 'opacity-0'}`}>
        <PageHeader 
          title="Competition Statistics"
          subtitle="Detailed analytics and performance metrics"
        >
          <Button
            onClick={() => navigate('/')}
            variant="outline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Main
          </Button>
        </PageHeader>

        {/* Tournament Selector (replaces Competition Selector) */}
        <Card className={getCardStyle('primary')}>
          <CardHeader>
            <CardTitle className={getTypographyStyle('h4') + " flex items-center gap-2"}>
              <Calendar className="w-5 h-5 text-arcade-neonCyan" />
              Select Tournament
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedTournamentId}
              onValueChange={async (value) => {
                setSelectedTournamentId(value);
                // Keep the Admin/global active tournament in sync when a specific one is chosen
                if (value !== 'all') {
                  const target = (userTournaments || []).find(t => t.id === value);
                  if (target && (!currentTournament || target.id !== currentTournament.id)) {
                    await switchTournament(target);
                  }
                }
                // Sync the achievements tournament filter as well
                setAchvTournamentFilter(value);
                // Ensure data reflects latest schema/fields (e.g., tournament_id) after selection changes
                refetch();
              }}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="All Tournaments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tournaments</SelectItem>
                {(userTournaments || []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Summary badge */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-300">
              <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                {tournamentSummary.name}
              </span>
              {tournamentSummary.start && tournamentSummary.end && (
                <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                  {new Date(tournamentSummary.start).toLocaleDateString()} — {new Date(tournamentSummary.end).toLocaleDateString()}
                </span>
              )}
              <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                Players: <b className="ml-1 text-white">{tournamentSummary.totalPlayers}</b>
              </span>
              <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                Scores: <b className="ml-1 text-white">{tournamentSummary.totalScores}</b>
              </span>
            </div>
          </CardContent>
        </Card>

        {selectedComp && (
          <>
            {/* Competition Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className={getCardStyle('primary')} style={getRunnerStyle('overview-total-players')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-arcade-neonCyan" />
                    <div>
                      <p className="text-sm text-gray-400">Total Players</p>
                      <p className="text-2xl font-bold text-white">{selectedComp.total_players}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className={getCardStyle('primary')} style={getRunnerStyle('overview-games-played')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="w-5 h-5 text-arcade-neonYellow" />
                    <div>
                      <p className="text-sm text-gray-400">Games Played</p>
                      <p className="text-2xl font-bold text-white">{selectedComp.total_games}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className={getCardStyle('primary')} style={getRunnerStyle('overview-total-scores')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-arcade-neonPink" />
                    <div>
                      <p className="text-sm text-gray-400">Total Scores</p>
                      <p className="text-2xl font-bold text-white">{selectedComp.total_scores}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className={getCardStyle('primary')} style={getRunnerStyle('overview-duration')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-arcade-neonYellow" />
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
              <Card className={getCardStyle('primary')} style={getRunnerStyle('panel-top-players')}>
                <CardHeader>
                  <CardTitle className={getTypographyStyle('h4') + " flex items-center gap-2"}>
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
                              <p className="font-semibold text-white text-2xl">{player.player_name}</p>
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
              <Card className={getCardStyle('primary')} style={getRunnerStyle('panel-game-stats')}>
                <CardHeader>
                  <CardTitle className={getTypographyStyle('h4') + " flex items-center gap-2"}>
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
          <Card className={`${getCardStyle('primary')} mb-4`} style={getRunnerStyle('panel-visual-analytics')}>
            <CardHeader>
              <CardTitle className={getTypographyStyle('h3') + " flex items-center gap-2"}>
                <BarChart3 className="w-5 h-5 text-arcade-neonCyan" />
                Visual Analytics
              </CardTitle>
              <p className="text-gray-400 text-sm">
                Interactive charts and graphs showing current game data and player performance
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleExportScores}>Export Scores (CSV)</Button>
                <Button variant="outline" onClick={handleExportAchievements}>Export Achievements (CSV)</Button>
              </div>
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

          {/* Monthly Analytics Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Window</label>
              <select
                className="h-8 bg-secondary/40 border-white/20 text-white rounded px-2"
                value={windowType}
                onChange={(e) => setWindowType(e.target.value as any)}
              >
                <option value="last30">Last 30 days</option>
                <option value="this_month">This month</option>
                <option value="prev_month">Previous month</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Top N</label>
              <select
                className="h-8 bg-secondary/40 border-white/20 text-white rounded px-2"
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value) as any)}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>
          </div>

          {/* Monthly Analytics Row 1: Improvement + Volatility */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Player Score Improvement (Monthly Deltas) */}
          <Card className={getCardStyle('primary')} style={getRunnerStyle('panel-improvement')}>
            <CardHeader>
              <CardTitle className={getTypographyStyle('h4')}>Player Score Improvement (Monthly)</CardTitle>
            </CardHeader>
            <CardContent style={{ height: 380 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={improvementData} layout="vertical" margin={{ left: 80, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" tick={{ fill: '#ccc', fontSize: 12 }} />
                  <YAxis type="category" dataKey="player" width={120} tick={{ fill: '#ccc', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.2)' }} />
                  <Bar dataKey="delta" fill="#00ffff" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Leaderboard Volatility (Monthly Rank Trends) */}
          <Card className={getCardStyle('primary')} style={getRunnerStyle('panel-volatility')}>
            <CardHeader>
              <CardTitle className={getTypographyStyle('h4')}>Leaderboard Volatility (Monthly)</CardTitle>
            </CardHeader>
            <CardContent style={{ height: 380 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={volatilitySeries.days.map((day, i) => {
                  const row: any = { day };
                  (volatilitySeries.players || []).forEach((p) => {
                    row[p] = volatilitySeries.series[p]?.[i]?.rank ?? null;
                  });
                  return row;
                })} margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="day" tick={{ fill: '#ccc', fontSize: 12 }} />
                  <YAxis reversed tick={{ fill: '#ccc', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.2)' }} />
                  <Legend />
                  {(volatilitySeries.players || []).map((p, idx) => (
                    <Line key={p} type="monotone" dataKey={p} stroke={["#00ffff", "#ff00ff", "#ffff00", "#4ade80", "#60a5fa", "#f472b6", "#f59e0b", "#a78bfa", "#34d399", "#fb7185"][idx % 10]} dot={false} strokeWidth={2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          </div>

          {/* Monthly Analytics Row 2: Heatmap + Progression */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Scoring Activity Heatmap (Monthly) */}
          <Card className={getCardStyle('primary')} style={getRunnerStyle('panel-heatmap')}>
            <CardHeader>
              <CardTitle className={getTypographyStyle('h4')}>Scoring Activity Heatmap (Monthly)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="grid grid-cols-25 gap-1" style={{ gridTemplateColumns: 'repeat(25, minmax(0, 1fr))' }}>
                  <div></div>
                  {Array.from({ length: 24 }).map((_, hr) => (
                    <div key={`h-${hr}`} className="text-[10px] text-gray-400 text-center">{hr}</div>
                  ))}
                  {heatmap.grid.map((row, dow) => (
                    <React.Fragment key={`r-${dow}`}>
                      <div className="text-[10px] text-gray-400 pr-2">
                        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow]}
                      </div>
                      {row.map((val, hr) => {
                        const intensity = val / (heatmap.max || 1);
                        const bg = `rgba(0,255,255,${Math.max(0.1, intensity)})`;
                        return (
                          <div key={`c-${dow}-${hr}`} className="h-4 w-full rounded" title={`${val} scores`} style={{ backgroundColor: bg }} />
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Player Achievement Progression (Monthly) */}
          <Card className={getCardStyle('primary')} style={getRunnerStyle('panel-progression')}>
            <CardHeader>
              <CardTitle className={getTypographyStyle('h4')}>Player Achievement Progression (Monthly)</CardTitle>
            </CardHeader>
            <CardContent style={{ height: 380 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progression.rows} margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="day" tick={{ fill: '#ccc', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#ccc', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.2)' }} />
                  <Legend />
                  {(progression.players || []).map((p, idx) => (
                    <Line key={p} type="monotone" dataKey={p} stroke={["#00ffff", "#ff00ff", "#ffff00", "#4ade80", "#60a5fa", "#f472b6", "#f59e0b", "#a78bfa", "#34d399", "#fb7185"][idx % 10]} dot={false} strokeWidth={2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          </div>

          {/* Player Achievement Summary Cards (from Achievements page style) */}
          <Card className={getCardStyle('primary')} style={getRunnerStyle('panel-achievements')}>
            <CardHeader>
              <CardTitle className={getTypographyStyle('h3') + " flex items-center gap-2"}>
                <Award className="w-5 h-5 text-arcade-neonYellow" />
                Player Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Filter: Search only (tournament is controlled by the top selector) */}
              <div className="grid grid-cols-1 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-400">Search Players</label>
                  <Input
                    placeholder="Search players..."
                    value={achvSearch}
                    onChange={(e) => setAchvSearch(e.target.value)}
                    className="bg-secondary/40 border-white/20 text-white"
                  />
                </div>
              </div>

              {dataLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-arcade-neonCyan"></div>
                </div>
              ) : playerSummaries.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {playerSummaries
                    .filter((p) => p.player_name.toLowerCase().includes(achvSearch.toLowerCase()))
                    .slice(0, 60)
                    .map((player) => (
                      <Card key={player.player_name} className="bg-gray-800/50 border-gray-600">
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
                                  {player.latest_achievement_date && new Date(player.latest_achievement_date).toLocaleDateString()}
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No player achievements yet.</div>
              )}
            </CardContent>
          </Card>

          {/* Achievement Leaderboards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card className={getCardStyle('primary')} style={getRunnerStyle('panel-lb-points')}>
              <CardHeader>
                <CardTitle className={getTypographyStyle('h4')}>Top Achievers by Points</CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboardByPoints.length > 0 ? (
                  <div className="space-y-2">
                    {leaderboardByPoints.map((row, idx) => (
                      <div key={row.player} className="flex items-center justify-between p-2 bg-white/5 rounded">
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-right text-gray-400">{idx + 1}.</span>
                          <span className="font-medium text-white">{row.player}</span>
                        </div>
                        <span className="font-semibold text-arcade-neonYellow">{row.pts} pts</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500">No data</div>
                )}
              </CardContent>
            </Card>

            <Card className={getCardStyle('primary')} style={getRunnerStyle('panel-lb-count')}>
              <CardHeader>
                <CardTitle className={getTypographyStyle('h4')}>Top Achievers by Count</CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboardByCount.length > 0 ? (
                  <div className="space-y-2">
                    {leaderboardByCount.map((row, idx) => (
                      <div key={row.player} className="flex items-center justify-between p-2 bg-white/5 rounded">
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-right text-gray-400">{idx + 1}.</span>
                          <span className="font-medium text-white">{row.player}</span>
                        </div>
                        <span className="font-semibold text-arcade-neonCyan">{row.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500">No data</div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
        </div>
      </PageContainer>
    </div>
  );
};

export default Statistics;
