import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Shuffle, ChevronDown, ChevronUp, Users } from "lucide-react";
import { useTournament } from "@/contexts/TournamentContext";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from '@tanstack/react-query';
import { useUserRoles } from "@/hooks/useUserRoles";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { AchievementsTable } from "@/components/AchievementsTable";
import { PlayerAchievementsTable } from "@/components/PlayerAchievementsTable";
import { SuggestAchievementDialog } from "@/components/SuggestAchievementDialog";

type AchievementType = 
  | 'first_score' 
  | 'first_place' 
  | 'score_milestone' 
  | 'game_master' 
  | 'high_scorer' 
  | 'consistent_player' 
  | 'perfectionist' 
  | 'streak_master' 
  | 'competition_winner' 
  | 'speed_demon';

interface AchievementCriteria {
  game_id?: string | null;
  threshold?: number;
  count?: number;
  rank?: number;
  days?: number;
  [key: string]: any; // For any additional criteria
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  type: AchievementType;
  badge_icon: string;
  badge_color: string;
  criteria: AchievementCriteria;
  points: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  unlock_count?: number;
  tournament_id: string;
  created_by?: string;
}

// Using HighScoreTable from TournamentContext

const ACHIEVEMENT_TYPES = [
  {
    value: 'first_score',
    label: 'First Score',
    icon: '🎯',
    description: 'Awarded when a player submits their very first score',
    example: 'Welcome! - Submit your first score to any game'
  },
  {
    value: 'first_place',
    label: 'First Place',
    icon: '👑',
    description: 'Awarded for achieving the top score on any leaderboard',
    example: 'Champion - Reach #1 on any game leaderboard'
  },
  {
    value: 'score_milestone',
    label: 'Score Milestone',
    icon: '🏆',
    description: 'Awarded for reaching a specific score threshold',
    example: '50,000 Club - Score 50,000 or more points in any game'
  },
  {
    value: 'game_master',
    label: 'Game Master',
    icon: '🕹️',
    description: 'Awarded for playing a certain number of different games',
    example: '5-Game Expert - Submit scores to 5 different games'
  },
  {
    value: 'high_scorer',
    label: 'High Scorer',
    icon: '⭐',
    description: 'Awarded for being in the top rankings across games',
    example: 'Top 3 Player - Finish in the top 3 of any leaderboard'
  },
  {
    value: 'consistent_player',
    label: 'Consistent Player',
    icon: '🔥',
    description: 'Awarded for submitting many scores over time',
    example: '25-Score Veteran - Submit 25 total scores'
  },
  {
    value: 'perfectionist',
    label: 'Perfectionist',
    icon: '💎',
    description: 'Awarded for hitting exact score targets',
    example: '100,000 Perfect - Score exactly 100,000 points'
  },
  {
    value: 'streak_master',
    label: 'Streak Master',
    icon: '⚡',
    description: 'Awarded for playing consistently over multiple days',
    example: '7-Day Streak - Submit scores on 7 consecutive days'
  },
  {
    value: 'competition_winner',
    label: 'Competition Winner',
    icon: '🥇',
    description: 'Awarded for winning competitions or tournaments',
    example: 'Tournament Victor - Win a tournament competition'
  },
  {
    value: 'speed_demon',
    label: 'Speed Demon',
    icon: '💨',
    description: 'Awarded for rapid gaming sessions',
    example: 'Lightning Fast - Submit 5 scores within 1 hour'
  },
];

const DEFAULT_ICONS = ['🏆', '🥇', '🎯', '⭐', '💎', '🔥', '⚡', '🎮', '👑', '🏅', '🌟', '💫'];
const DEFAULT_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'];

const AchievementManagerV2 = ({ refreshTrigger }: { refreshTrigger?: number }) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [games, setGames] = useState<Array<{ id: string; name: string; logo_url: string | null }>>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('all');
  const [expandedGames, setExpandedGames] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [playerAchievements, setPlayerAchievements] = useState<any[]>([]);
  const [loadingPlayerAchievements, setLoadingPlayerAchievements] = useState(false);

  const { toast } = useToast();
  const { currentTournament, userTournaments, switchTournament, hasPermission } = useTournament();
  const { user } = useAuth();
  const { isAdmin } = useUserRoles();
  const queryClient = useQueryClient();

  // Check if current user is the tournament creator/owner or admin (either tournament-level or global)
  const isTournamentCreator = currentTournament && user &&
    (currentTournament.created_by === user.id || hasPermission('owner') || hasPermission('admin') || isAdmin);


  // Load games from the database
  const loadGames = useCallback(async () => {
    try {
      const { data, error } = await api
        .from('games')
        .select('id, name, logo_url')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('Error loading games:', error);
      toast({
        title: "Error",
        description: "Failed to load games",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Load current user id for author filtering
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data } = await api.auth.getUser();
        setCurrentUserId(data.user?.id ?? null);
      } catch (e) {
        console.error('Failed to get current user', e);
        setCurrentUserId(null);
      }
    };
    getUser();
  }, []);

  // Generate base achievements for new users
  const generateBaseAchievements = useCallback(async () => {
    if (!currentTournament || !currentUserId) return;

    const baseAchievements = [
      {
        name: 'Welcome Aboard',
        description: 'Submit your first score to any game',
        type: 'first_score' as const,
        badge_icon: '🎯',
        badge_color: '#4ECDC4',
        criteria: { is_first_score: true },
        points: 10,
      },
      {
        name: 'Getting Started',
        description: 'Score 5,000 points or more in any game',
        type: 'score_milestone' as const,
        badge_icon: '🎯',
        badge_color: '#4ECDC4',
        criteria: { min_score: 5000 },
        points: 25,
      },
      {
        name: 'Score Rookie',
        description: 'Score 10,000 points or more in any game',
        type: 'score_milestone' as const,
        badge_icon: '🏆',
        badge_color: '#FFD700',
        criteria: { min_score: 10000 },
        points: 50,
      },
      {
        name: 'Century Club',
        description: 'Score 100,000 points or more',
        type: 'score_milestone' as const,
        badge_icon: '💯',
        badge_color: '#FFD700',
        criteria: { min_score: 100000 },
        points: 100,
      },
      {
        name: 'Speed Runner',
        description: 'Submit 10 scores within 2 hours',
        type: 'speed_demon' as const,
        badge_icon: '⚡',
        badge_color: '#FF6B6B',
        criteria: { scores_in_timeframe: 10, timeframe_hours: 2 },
        points: 75,
      },
      {
        name: 'Dedicated Player',
        description: 'Submit scores for 7 days straight',
        type: 'streak_master' as const,
        badge_icon: '🔥',
        badge_color: '#FF6B6B',
        criteria: { consecutive_days: 7 },
        points: 125,
      },
      {
        name: 'Game Explorer',
        description: 'Play 10 different games',
        type: 'game_master' as const,
        badge_icon: '🗺️',
        badge_color: '#45B7D1',
        criteria: { game_count: 10 },
        points: 100,
      },
      {
        name: 'Champion',
        description: 'Achieve first place on any leaderboard',
        type: 'first_place' as const,
        badge_icon: '🏆',
        badge_color: '#FFD700',
        criteria: { max_rank: 1 },
        points: 200,
      },
      {
        name: 'Perfectionist',
        description: 'Score exactly 250,000 points',
        type: 'perfectionist' as const,
        badge_icon: '💎',
        badge_color: '#BB8FCE',
        criteria: { exact_score: 250000 },
        points: 150,
      },
      {
        name: 'Score Veteran',
        description: 'Submit 25 scores total',
        type: 'consistent_player' as const,
        badge_icon: '👥',
        badge_color: '#96CEB4',
        criteria: { min_scores: 25 },
        points: 75,
      },
      {
        name: 'Lightning Fast',
        description: 'Submit 5 scores within 1 hour',
        type: 'speed_demon' as const,
        badge_icon: '💨',
        badge_color: '#FF6B6B',
        criteria: { scores_in_timeframe: 5, timeframe_hours: 1 },
        points: 100,
      },
      {
        name: 'Marathon Player',
        description: 'Submit scores for 14 days straight',
        type: 'streak_master' as const,
        badge_icon: '🏃',
        badge_color: '#4ECDC4',
        criteria: { consecutive_days: 14 },
        points: 200,
      },
      {
        name: 'Game Master',
        description: 'Play 20 different games',
        type: 'game_master' as const,
        badge_icon: '🎮',
        badge_color: '#45B7D1',
        criteria: { game_count: 20 },
        points: 150,
      },
      {
        name: 'Score Legend',
        description: 'Score 500,000 points or more',
        type: 'score_milestone' as const,
        badge_icon: '⭐',
        badge_color: '#FFD700',
        criteria: { min_score: 500000 },
        points: 250,
      },
      {
        name: 'Consistent Champion',
        description: 'Submit 50 scores total',
        type: 'consistent_player' as const,
        badge_icon: '🔥',
        badge_color: '#FF6B6B',
        criteria: { min_scores: 50 },
        points: 125,
      },
      {
        name: 'Speed Demon',
        description: 'Submit 20 scores within 3 hours',
        type: 'speed_demon' as const,
        badge_icon: '⚡',
        badge_color: '#FF6B6B',
        criteria: { scores_in_timeframe: 20, timeframe_hours: 3 },
        points: 150,
      },
      {
        name: 'Ultimate Streak',
        description: 'Submit scores for 30 days straight',
        type: 'streak_master' as const,
        badge_icon: '🔥',
        badge_color: '#FFD700',
        criteria: { consecutive_days: 30 },
        points: 500,
      },
      {
        name: 'Perfect Score',
        description: 'Score exactly 1,000,000 points',
        type: 'perfectionist' as const,
        badge_icon: '💎',
        badge_color: '#BB8FCE',
        criteria: { exact_score: 1000000 },
        points: 1000,
      },
      {
        name: 'Tournament Veteran',
        description: 'Submit 100 scores total',
        type: 'consistent_player' as const,
        badge_icon: '🏆',
        badge_color: '#FFD700',
        criteria: { min_scores: 100 },
        points: 200,
      },
      {
        name: 'Ultimate Champion',
        description: 'Achieve first place 5 times',
        type: 'first_place' as const,
        badge_icon: '👑',
        badge_color: '#FFD700',
        criteria: { max_rank: 1, count: 5 },
        points: 300,
      },
    ];

    // Create achievements in database
    const createdAchievements = [];
    for (const achievement of baseAchievements) {
      try {
        const { data, error } = await api
          .from('achievements')
          .insert({
            tournament_id: currentTournament.id,
            name: achievement.name,
            description: achievement.description,
            type: achievement.type,
            badge_icon: achievement.badge_icon,
            badge_color: achievement.badge_color,
            criteria: achievement.criteria,
            points: achievement.points,
            is_active: true,
            created_by: currentUserId,
          })
          .select()
          .single();

        if (!error && data) {
          createdAchievements.push(data);
        }
      } catch (error) {
        console.error('Error creating base achievement:', achievement.name, error);
      }
    }

    return createdAchievements;
  }, [currentTournament, currentUserId]);

  // Load achievements for current tournament
  const loadAchievements = useCallback(async () => {
    if (!currentTournament) return;

    try {
      setLoading(true);

      // Load games first
      await loadGames();

      // Initialize expanded state for games
      const initialExpandedState = games.reduce((acc, game) => ({
        ...acc,
        [game.id]: false
      }), { general: true });
      setExpandedGames(initialExpandedState);

      // Always show only achievements created by the current user
      if (currentUserId) {
        // Check if user has any achievements in this tournament
        let rows: any[] | null = null;
        try {
          const { data, error } = await api
            .from('achievements')
            .select('id')
            .eq('tournament_id', currentTournament.id)
            .eq('created_by', currentUserId)
            .limit(1);
          if (error) throw error;
          rows = (data as unknown as any[]) || [];
        } catch (e: any) {
          // Column may not exist in older schemas
          rows = [];
        }

        // If no achievements exist, generate base achievements
        if (rows.length === 0) {
          console.log('Generating base achievements for new user...');
          await generateBaseAchievements();
        }

        // Load user's achievements
        try {
          const { data, error } = await api
            .from('achievements')
            .select(
              'id,name,description,type,badge_icon,badge_color,criteria,points,is_active,created_at,updated_at,tournament_id,created_by'
            )
            .eq('tournament_id', currentTournament.id)
            .eq('created_by', currentUserId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          rows = (data as unknown as any[]) || [];
        } catch (e: any) {
          // Column may not exist in older schemas – fall back without created_by filter
          const { data, error } = await api
            .from('achievements')
            .select(
              'id,name,description,type,badge_icon,badge_color,criteria,points,is_active,created_at,updated_at,tournament_id'
            )
            .eq('tournament_id', currentTournament.id)
            .order('created_at', { ascending: false });
          if (error) throw error;
          rows = (data as unknown as any[]) || [];
          // Client-side filter if the property exists
          rows = rows.filter((a: any) => a && typeof a === 'object' && 'created_by' in a ? a.created_by === currentUserId : true);
        }
        setAchievements((rows as unknown as Achievement[]) || []);
      } else {
        // Fallback to RPC (may include additional computed fields)
        const { data, error } = await api.rpc('get_tournament_achievements' as any, {
          p_tournament_id: currentTournament.id
        });
        if (error) throw error;
        setAchievements((data as unknown as Achievement[]) || []);
      }
      
    } catch (error) {
      console.error('Error loading achievements:', error);
      toast({
        title: "Error",
        description: "Failed to load achievements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentTournament, loadGames, toast, currentUserId, generateBaseAchievements]);

  // Load player achievements for current tournament (only for tournament creators)
  const loadPlayerAchievements = useCallback(async () => {
    if (!currentTournament || !isTournamentCreator) return;

    try {
      setLoadingPlayerAchievements(true);
      const { data, error } = await api
        .from('player_achievements')
        .select(`
          id,
          player_name,
          earned_at,
          achievements!inner(name, badge_icon, badge_color)
        `)
        .eq('tournament_id', currentTournament.id)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      setPlayerAchievements(data || []);
    } catch (error) {
      console.error('Error loading player achievements:', error);
      toast({
        title: "Error",
        description: "Failed to load player achievements",
        variant: "destructive",
      });
    } finally {
      setLoadingPlayerAchievements(false);
    }
  }, [currentTournament, isTournamentCreator, toast]);

  useEffect(() => {
    loadAchievements();
    if (isTournamentCreator) {
      loadPlayerAchievements();
    }
  }, [loadAchievements, loadPlayerAchievements, isTournamentCreator, refreshTrigger]);

  // Group achievements by game ID (or 'general' if no game_id)
  const groupedAchievements = achievements.reduce((acc, achievement) => {
    const gameId = achievement.criteria?.game_id || 'general';
    if (!acc[gameId]) {
      acc[gameId] = [];
    }
    acc[gameId].push(achievement);
    return acc;
  }, {} as Record<string, Achievement[]>);
  
  // Tournament-only view: show all achievements for the current tournament
  const filteredAchievements = achievements;

  // Toggle expanded state for a game
  const toggleGameExpanded = (gameId: string) => {
    setExpandedGames(prev => ({
      ...prev,
      [gameId]: !prev[gameId]
    }));
  };


  // Delete an achievement via confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null; achievement: Achievement | null }>({ open: false, id: null, achievement: null });
  // Clear all achievements dialog
  const [clearAllDialog, setClearAllDialog] = useState<{ open: boolean }>({ open: false });
  // Clear all achievements (definitions) dialog
  const [clearAllAchievementsDialog, setClearAllAchievementsDialog] = useState<{ open: boolean }>({ open: false });
  const handleDeleteAchievement = (achievement: Achievement) => {
    // Only allow deletion if user is tournament creator or achievement creator
    if (!isTournamentCreator && achievement.created_by !== currentUserId) {
      toast({
        title: "Access Denied",
        description: "You can only delete achievements in tournaments you created, or achievements you created yourself.",
        variant: "destructive",
      });
      return;
    }
    setDeleteDialog({ open: true, id: achievement.id, achievement });
  };
  const confirmDeleteAchievement = async () => {
    if (!deleteDialog.id) return;
    try {
      const { error } = await api
        .from('achievements')
        .delete()
        .eq('id', deleteDialog.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Achievement deleted successfully",
      });

      loadAchievements();
      await queryClient.invalidateQueries({ queryKey: ['achievements'] });

    } catch (error) {
      console.error('Error deleting achievement:', error);
      toast({
        title: "Error",
        description: "Failed to delete achievement",
        variant: "destructive",
      });
    }
  };

  // Clear all player achievement records for current tournament (creator only)
  const confirmClearAllAchievements = async () => {
    if (!currentTournament || !user) return;

    try {

      // Count records before
      const { data: beforeCount, error: beforeError } = await api
        .from('player_achievements')
        .select('id')
        .eq('tournament_id', currentTournament.id);

      if (beforeError) {
        console.error('Error counting before:', beforeError);
        throw beforeError;
      }


      // Use the regular authenticated api client (user has admin privileges)
      const { error, count } = await api
        .from('player_achievements')
        .delete({ count: 'exact' })
        .eq('tournament_id', currentTournament.id);

      if (error) {
        console.error('❌ Delete failed:', error);
        throw error;
      }


      // Count records after to verify
      const { data: afterCount, error: afterError } = await api
        .from('player_achievements')
        .select('id')
        .eq('tournament_id', currentTournament.id);


      const deletedCount = (beforeCount?.length || 0) - (afterCount?.length || 0);

      toast({
        title: "Success",
        description: `Cleared ${deletedCount} player achievement records for ${currentTournament.name}`,
      });

      setClearAllDialog({ open: false });
      await queryClient.invalidateQueries({ queryKey: ['achievements'] });

    } catch (error) {
      console.error('Error clearing player achievements:', error);
      toast({
        title: "Error",
        description: `Failed to clear player achievement progress: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Clear all achievement definitions for current tournament (creator only)
  const confirmClearAllAchievementDefinitions = async () => {
    if (!currentTournament || !user) return;

    try {
      // Use regular authenticated client - RLS should allow tournament creators to delete their achievements
      const { error } = await api
        .from('achievements')
        .delete()
        .eq('tournament_id', currentTournament.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `All achievement definitions cleared for ${currentTournament.name}`,
      });

      setClearAllAchievementsDialog({ open: false });
      loadAchievements();
      await queryClient.invalidateQueries({ queryKey: ['achievements'] });

    } catch (error) {
      console.error('Error clearing achievement definitions:', error);
      toast({
        title: "Error",
        description: "Failed to clear achievement definitions",
        variant: "destructive",
      });
    }
  };

  // Toggle achievement status
  const toggleAchievementStatus = async (achievement: Achievement) => {
    // Only allow status changes if user is tournament creator or achievement creator
    if (!isTournamentCreator && achievement.created_by !== currentUserId) {
      toast({
        title: "Access Denied",
        description: "You can only modify achievements in tournaments you created, or achievements you created yourself.",
        variant: "destructive",
      });
      return;
    }
    try {
      const { error } = await api
        .from('achievements')
        .update({ is_active: !achievement.is_active })
        .eq('id', achievement.id);

      if (error) throw error;

      loadAchievements();
      await queryClient.invalidateQueries({ queryKey: ['achievements'] });

    } catch (error) {
      console.error('Error toggling achievement status:', error);
      toast({
        title: "Error",
        description: "Failed to update achievement status",
        variant: "destructive",
      });
    }
  };

  // Delete individual player achievement
  const deletePlayerAchievement = async (playerAchievementId: string) => {
    if (!isTournamentCreator) {
      toast({
        title: "Access Denied",
        description: "Only tournament creators can manage player achievements.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Use Edge Function for secure deletion
      const { data, error } = await api.functions.invoke('manage-player-achievements', {
        body: {
          action: 'delete',
          player_achievement_id: playerAchievementId
        }
      });

      if (error) throw error;

      if (data && data.success) {
        console.log('✅ Successfully deleted player achievement');

        toast({
          title: "Success",
          description: data.message,
        });

        // Optimistically remove the achievement from state without refetching
        setPlayerAchievements(prev => prev.filter(pa => pa.id !== playerAchievementId));

        // Only invalidate queries without forcing immediate refetch
        // This updates cache but doesn't trigger loading state
        await queryClient.invalidateQueries({
          queryKey: ['achievements'],
          refetchType: 'none'
        });
      }

    } catch (error: any) {
      console.error('❌ Error deleting player achievement:', error);
      toast({
        title: "Error",
        description: `Failed to remove player achievement: ${error.message}`,
        variant: "destructive",
      });
    }
  };


  // Get icon for achievement type
  const getTypeIcon = (type: string) => {
    const typeInfo = ACHIEVEMENT_TYPES.find(t => t.value === type);
    return typeInfo ? typeInfo.icon : '🎯';
  };

  // Format criteria for display
  const getCriteriaDisplay = (criteria: AchievementCriteria, type: string) => {
    if (!criteria) return '';
    
    switch (type) {
      case 'score_milestone':
        return `Score ≥ ${criteria.threshold || 'N/A'}`;
      case 'game_master':
        return `Games Played ≥ ${criteria.count || 'N/A'}`;
      case 'high_scorer':
        return `Top ${criteria.rank || 'N/A'} in any game`;
      case 'consistent_player':
        return `Played ${criteria.days || 'N/A'} consecutive days`;
      default:
        return JSON.stringify(criteria);
    }
  };

  if (!currentTournament) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Achievement Management</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-gray-500">Please select a tournament to manage achievements</p>
        </CardContent>
      </Card>
    );
  }


  return (
    <div className="flex flex-col space-y-6 w-full max-w-full overflow-hidden">
      <div className="flex flex-col space-y-4 w-full max-w-full">
        <div className="flex flex-col gap-3 w-full max-w-full">
          <div className="flex flex-col gap-2 min-w-0 flex-1">
            <h2 className="text-2xl font-bold">Achievement Manager</h2>
            {/* Compact tournament selector (defaults to active) - stacked under title */}
            <div className="hidden md:block">
              <Label htmlFor="tournament-select" className="sr-only">Tournament</Label>
              <Select
                value={currentTournament?.id || ''}
                onValueChange={async (value) => {
                  if (!currentTournament || value === currentTournament.id) return;
                  const target = (userTournaments || []).find(t => t.id === value);
                  if (target) {
                    await switchTournament(target);
                  }
                }}
              >
                <SelectTrigger id="tournament-select" className="w-full max-w-xs bg-secondary/40 border-white/20 text-white">
                  <SelectValue placeholder="Select Tournament" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/20">
                  {(userTournaments || []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {isTournamentCreator && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setClearAllDialog({ open: true })}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Progress
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setClearAllAchievementsDialog({ open: true })}
                  className="bg-red-800 hover:bg-red-900"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Achievements
                </Button>
              </>
            )}
            <div className="flex gap-2">
              <SuggestAchievementDialog onAchievementAdded={loadAchievements} />
            </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>
                My Achievements
              </CardTitle>
              <CardDescription>
                {filteredAchievements.length} achievement{filteredAchievements.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? null : filteredAchievements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No achievements found. Create your first achievement!
            </div>
          ) : (
            <AchievementsTable
              achievements={filteredAchievements}
              onDelete={handleDeleteAchievement}
              onToggleStatus={toggleAchievementStatus}
              getTypeIcon={getTypeIcon}
              getCriteriaDisplay={getCriteriaDisplay}
              currentUserId={currentUserId}
            />
          )}
        </CardContent>
      </Card>

      {/* Player Achievement Management - Only for tournament creators */}
      {isTournamentCreator && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Player Achievement Management
                </CardTitle>
                <CardDescription>
                  Manage individual player achievement unlocks in your tournament
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingPlayerAchievements ? null : playerAchievements.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No player achievements found.
              </div>
            ) : (
              <PlayerAchievementsTable
                playerAchievements={playerAchievements}
                onDelete={deletePlayerAchievement}
              />
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        title="Delete Achievement"
        description="Are you sure you want to delete this achievement? This action cannot be undone."
        confirmText="Delete Achievement"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDeleteAchievement}
      />

      <ConfirmationDialog
        open={clearAllDialog.open}
        onOpenChange={(open) => setClearAllDialog({ open })}
        title="Clear All Achievement Progress"
        description={`Are you sure you want to clear ALL PLAYERS' achievement progress for "${currentTournament?.name}"? This will reset everyone's achievement unlocks but keep the achievements themselves. This action cannot be undone.`}
        confirmText="Clear All Progress"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmClearAllAchievements}
      />

      <ConfirmationDialog
        open={clearAllAchievementsDialog.open}
        onOpenChange={(open) => setClearAllAchievementsDialog({ open })}
        title="Clear All Achievement Definitions"
        description={`Are you sure you want to delete ALL ACHIEVEMENT DEFINITIONS for "${currentTournament?.name}"? This will permanently remove all achievements and their progress. This action cannot be undone.`}
        confirmText="Delete All Achievements"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmClearAllAchievementDefinitions}
      />
      </div>
    </div>
    </div>
  );
}

export default AchievementManagerV2;
