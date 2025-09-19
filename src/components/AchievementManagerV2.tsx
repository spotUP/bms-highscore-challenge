import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

const AchievementManagerV2 = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [games, setGames] = useState<Array<{ id: string; name: string; logo_url: string | null }>>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('all');
  const [expandedGames, setExpandedGames] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [playerAchievements, setPlayerAchievements] = useState<any[]>([]);
  const [loadingPlayerAchievements, setLoadingPlayerAchievements] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    type: AchievementType;
    badge_icon: string;
    badge_color: string;
    criteria: AchievementCriteria;
    points: number;
    is_active: boolean;
  }>({
    name: "",
    description: "",
    type: "first_score",
    badge_icon: "🏆",
    badge_color: "#FFD700",
    criteria: { game_id: null },
    points: 10,
    is_active: true
  });

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
      const { data, error } = await supabase
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
        const { data } = await supabase.auth.getUser();
        setCurrentUserId(data.user?.id ?? null);
      } catch (e) {
        console.error('Failed to get current user', e);
        setCurrentUserId(null);
      }
    };
    getUser();
  }, []);

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

      // If user is tournament creator or admin, show ALL achievements in the tournament
      // Otherwise, show only achievements they created
      if (isTournamentCreator) {
        // Show all achievements in tournaments the user owns or if user is admin
        let rows: any[] | null = null;
        try {
          const { data, error } = await supabase
            .from('achievements')
            .select(
              'id,name,description,type,badge_icon,badge_color,criteria,points,is_active,created_at,updated_at,tournament_id,created_by'
            )
            .eq('tournament_id', currentTournament.id)
            .order('created_at', { ascending: false });
          if (error) throw error;
          rows = (data as unknown as any[]) || [];
        } catch (e: any) {
          // Column may not exist in older schemas
          const { data, error } = await supabase
            .from('achievements')
            .select(
              'id,name,description,type,badge_icon,badge_color,criteria,points,is_active,created_at,updated_at,tournament_id'
            )
            .eq('tournament_id', currentTournament.id)
            .order('created_at', { ascending: false });
          if (error) throw error;
          rows = (data as unknown as any[]) || [];
        }
        setAchievements((rows as unknown as Achievement[]) || []);
      } else if (currentUserId) {
        // Non-owners only see achievements they created
        let rows: any[] | null = null;
        try {
          const { data, error } = await supabase
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
          const { data, error } = await supabase
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
        const { data, error } = await supabase.rpc('get_tournament_achievements' as any, {
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
  }, [currentTournament, loadGames, toast, currentUserId]);

  // Load player achievements for current tournament (only for tournament creators)
  const loadPlayerAchievements = useCallback(async () => {
    if (!currentTournament || !isTournamentCreator) return;

    try {
      setLoadingPlayerAchievements(true);
      const { data, error } = await supabase
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
  }, [loadAchievements, loadPlayerAchievements, isTournamentCreator]);

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

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    if (name === 'type') {
      setFormData(prev => ({
        ...prev,
        [name]: value as AchievementType,
        // Reset criteria when type changes
        criteria: { game_id: prev.criteria.game_id }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle criteria changes
  const handleCriteriaChange = (field: keyof AchievementCriteria, value: any) => {
    // If changing game_id, clear high_score_table_id to avoid conflicts
    const updates: Partial<AchievementCriteria> = { [field]: value };
    if (field === 'game_id') {
      updates.high_score_table_id = null;
    }
    
    setFormData(prev => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        ...updates
      }
    }));
  };

  // Invalidate queries
  const invalidateQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ['achievements'] });
  };

  // Save or update an achievement
  const saveAchievement = async () => {
    if (!currentTournament) return;
    
    try {
      setIsSaving(true);
      // Basic validation
      const trimmedName = formData.name.trim();
      if (!trimmedName) {
        toast({
          title: "Name required",
          description: "Please enter a name for the achievement.",
          variant: "destructive",
        });
        return;
      }

      // Client-side duplicate check to avoid server error round-trip
      const hasDuplicate = achievements.some((a) =>
        a.tournament_id === currentTournament.id &&
        a.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        (!editingAchievement || a.id !== editingAchievement.id)
      );
      if (hasDuplicate) {
        toast({
          title: "Duplicate name",
          description: "An achievement with this name already exists in this tournament. Please choose a different name.",
          variant: "destructive",
        });
        return;
      }

      const achievementData = {
        ...formData,
        name: trimmedName,
        tournament_id: currentTournament.id,
        criteria: typeof formData.criteria === 'string' 
          ? JSON.parse(formData.criteria) 
          : formData.criteria
      };

      if (editingAchievement) {
        const { error } = await supabase
          .from('achievements')
          .update(achievementData)
          .eq('id', editingAchievement.id);
          
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Achievement updated successfully",
        });
      } else {
        // Ensure we have a user id for author attribution
        if (!currentUserId) {
          toast({
            title: "Not signed in",
            description: "You must be signed in to create achievements.",
            variant: "destructive",
          });
          return;
        }

        // Try including created_by; if column doesn't exist, retry without it
        let insertError: any | null = null;
        try {
          const insertData = {
            ...achievementData,
            created_by: currentUserId,
          } as any;
          const { error } = await supabase
            .from('achievements')
            .insert([insertData]);
          if (error) throw error;
        } catch (e: any) {
          insertError = e;
          // Retry without created_by
          const { error: retryError } = await supabase
            .from('achievements')
            .insert([achievementData as any]);
          if (retryError) throw retryError;
        }

        toast({
          title: "Success",
          description: "Achievement created successfully",
        });
      }
      
      setIsDialogOpen(false);
      resetForm();
      loadAchievements();
      await invalidateQueries();
      
    } catch (error: any) {
      console.error('Error saving achievement:', error);
      if (error?.code === '23505') {
        // Unique constraint violation on (name, tournament_id)
        toast({
          title: "Duplicate name",
          description: "An achievement with this name already exists in this tournament. Please choose a different name.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to save achievement",
          variant: "destructive",
        });
      }
    } finally {
      setIsSaving(false);
    }
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
      const { error } = await supabase
        .from('achievements')
        .delete()
        .eq('id', deleteDialog.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Achievement deleted successfully",
      });

      loadAchievements();
      await invalidateQueries();

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
      const { data: beforeCount, error: beforeError } = await supabase
        .from('player_achievements')
        .select('id')
        .eq('tournament_id', currentTournament.id);

      if (beforeError) {
        console.error('Error counting before:', beforeError);
        throw beforeError;
      }


      // Use the regular authenticated supabase client (user has admin privileges)
      const { error, count } = await supabase
        .from('player_achievements')
        .delete({ count: 'exact' })
        .eq('tournament_id', currentTournament.id);

      if (error) {
        console.error('❌ Delete failed:', error);
        throw error;
      }


      // Count records after to verify
      const { data: afterCount, error: afterError } = await supabase
        .from('player_achievements')
        .select('id')
        .eq('tournament_id', currentTournament.id);


      const deletedCount = (beforeCount?.length || 0) - (afterCount?.length || 0);

      toast({
        title: "Success",
        description: `Cleared ${deletedCount} player achievement records for ${currentTournament.name}`,
      });

      setClearAllDialog({ open: false });
      await invalidateQueries();

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
      const { error } = await supabase
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
      await invalidateQueries();

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
      const { error } = await supabase
        .from('achievements')
        .update({ is_active: !achievement.is_active })
        .eq('id', achievement.id);

      if (error) throw error;

      loadAchievements();
      await invalidateQueries();

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
      const { data, error } = await supabase.functions.invoke('manage-player-achievements', {
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

  // Reset form to initial state
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "first_score",
      badge_icon: "🏆",
      badge_color: "#FFD700",
      criteria: { game_id: null },
      points: 10,
      is_active: true
    });
    setEditingAchievement(null);
  };

  // Open edit dialog with achievement data
  const handleEditAchievement = (achievement: Achievement) => {
    // Only allow editing if user is tournament creator or achievement creator
    if (!isTournamentCreator && achievement.created_by !== currentUserId) {
      toast({
        title: "Access Denied",
        description: "You can only edit achievements in tournaments you created, or achievements you created yourself.",
        variant: "destructive",
      });
      return;
    }
    setEditingAchievement(achievement);
    // Ensure badge icon matches the type
    const typeInfo = ACHIEVEMENT_TYPES.find(t => t.value === achievement.type);
    setFormData({
      name: achievement.name,
      description: achievement.description,
      type: achievement.type,
      badge_icon: typeInfo?.icon || achievement.badge_icon,
      badge_color: achievement.badge_color,
      criteria: achievement.criteria,
      points: achievement.points,
      is_active: achievement.is_active
    });
    setIsDialogOpen(true);
  };

  // Open create dialog
  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
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

  // Derived UI validation state
  const trimmedNameForUI = formData.name.trim();
  const isDuplicateNameForUI = achievements.some((a) =>
    currentTournament &&
    a.tournament_id === currentTournament.id &&
    a.name.trim().toLowerCase() === trimmedNameForUI.toLowerCase() &&
    (!editingAchievement || a.id !== editingAchievement.id)
  );
  const isSaveDisabled = isSaving || !trimmedNameForUI || isDuplicateNameForUI;

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
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openCreateDialog} variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Achievement
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                      {editingAchievement ? 'Edit Achievement' : 'Create New Achievement'}
                    </DialogTitle>
                    <DialogDescription>
                      Create meaningful achievements that will motivate and reward your players.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 py-4">
                    {/* Step 1: Achievement Type Selection */}
                    <Card className="border-l-4 border-l-blue-500">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <span className="mr-2 text-xl">🎯</span>
                          Step 1: Choose Achievement Type
                        </CardTitle>
                        <CardDescription>
                          Select what type of achievement you want to create. Each type has different requirements and motivates different player behaviors.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Select
                          value={formData.type}
                          onValueChange={(value: AchievementType) => {
                            const typeInfo = ACHIEVEMENT_TYPES.find(t => t.value === value);
                            setFormData(prev => ({
                              ...prev,
                              type: value,
                              badge_icon: typeInfo?.icon || '🏆'
                            }));
                          }}
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Select achievement type..." />
                          </SelectTrigger>
                          <SelectContent>
                            {ACHIEVEMENT_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value} className="p-3">
                                <div className="flex items-start space-x-3">
                                  <span className="text-lg mt-0.5">{type.icon}</span>
                                  <div>
                                    <div className="font-medium">{type.label}</div>
                                    <div className="text-sm text-muted-foreground">{type.description}</div>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {formData.type && (
                          <div className="mt-4 p-4 bg-muted rounded-lg">
                            <h4 className="font-medium mb-2">Example:</h4>
                            <p className="text-sm text-muted-foreground">
                              {ACHIEVEMENT_TYPES.find(t => t.value === formData.type)?.example}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Step 2: Basic Information */}
                    <Card className="border-l-4 border-l-green-500">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <span className="mr-2 text-xl">✏️</span>
                          Step 2: Basic Information
                        </CardTitle>
                        <CardDescription>
                          Give your achievement a memorable name and clear description.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium">Achievement Name *</Label>
                            <Input
                              id="name"
                              name="name"
                              value={formData.name}
                              onChange={handleInputChange}
                              placeholder="e.g., High Scorer"
                              className="h-11"
                            />
                            {!trimmedNameForUI && (
                              <p className="text-xs text-red-500">Name is required.</p>
                            )}
                            {trimmedNameForUI && isDuplicateNameForUI && (
                              <p className="text-xs text-red-500">An achievement with this name already exists in this tournament.</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="points" className="text-sm font-medium">Points Awarded</Label>
                            <Input
                              id="points"
                              name="points"
                              type="number"
                              min="1"
                              value={formData.points}
                              onChange={handleInputChange}
                              placeholder="e.g., 100"
                              className="h-11"
                            />
                            <p className="text-xs text-muted-foreground">How many points players earn for this achievement</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                          <Textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="e.g., Reach the top of any game leaderboard"
                            rows={3}
                          />
                          <p className="text-xs text-muted-foreground">Tell players exactly what they need to do to earn this achievement</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Step 3: Requirements */}
                    {formData.type && (
                      <Card className="border-l-4 border-l-orange-500">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center">
                            <span className="mr-2 text-xl">⚙️</span>
                            Step 3: Requirements
                          </CardTitle>
                          <CardDescription>
                            Set the specific requirements for earning this achievement.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="game_id" className="text-sm font-medium">Target Game</Label>
                              <Select
                                value={formData.criteria?.game_id ?? 'general'}
                                onValueChange={(value) => handleCriteriaChange('game_id', value === 'general' ? null : value)}
                              >
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Select a game (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="general">Any Game (General Achievement)</SelectItem>
                                  {games.map(game => (
                                    <SelectItem key={game.id} value={game.id}>
                                      {game.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">Choose a specific game or make it apply to any game</p>
                            </div>

                            {formData.type === 'score_milestone' && (
                              <div className="space-y-2">
                                <Label htmlFor="threshold" className="text-sm font-medium">Target Score</Label>
                                <Input
                                  id="threshold"
                                  type="number"
                                  min="1"
                                  value={formData.criteria?.threshold || ''}
                                  onChange={(e) => handleCriteriaChange('threshold', parseInt(e.target.value))}
                                  placeholder="e.g., 50000"
                                  className="h-11"
                                />
                                <p className="text-xs text-muted-foreground">Players must score this many points or more</p>
                              </div>
                            )}

                            {formData.type === 'game_master' && (
                              <div className="space-y-2">
                                <Label htmlFor="game_count" className="text-sm font-medium">Number of Games</Label>
                                <Input
                                  id="game_count"
                                  type="number"
                                  min="1"
                                  value={formData.criteria?.count || ''}
                                  onChange={(e) => handleCriteriaChange('count', parseInt(e.target.value))}
                                  placeholder="e.g., 5"
                                  className="h-11"
                                />
                                <p className="text-xs text-muted-foreground">Players must submit scores to this many different games</p>
                              </div>
                            )}

                            {formData.type === 'high_scorer' && (
                              <div className="space-y-2">
                                <Label htmlFor="rank" className="text-sm font-medium">Required Ranking</Label>
                                <Input
                                  id="rank"
                                  type="number"
                                  min="1"
                                  value={formData.criteria?.rank || ''}
                                  onChange={(e) => handleCriteriaChange('rank', parseInt(e.target.value))}
                                  placeholder="e.g., 3"
                                  className="h-11"
                                />
                                <p className="text-xs text-muted-foreground">Players must finish in the top X positions (e.g., 3 for top 3)</p>
                              </div>
                            )}

                            {formData.type === 'consistent_player' && (
                              <div className="space-y-2">
                                <Label htmlFor="score_count" className="text-sm font-medium">Total Scores</Label>
                                <Input
                                  id="score_count"
                                  type="number"
                                  min="1"
                                  value={formData.criteria?.count || ''}
                                  onChange={(e) => handleCriteriaChange('count', parseInt(e.target.value))}
                                  placeholder="e.g., 25"
                                  className="h-11"
                                />
                                <p className="text-xs text-muted-foreground">Players must submit this many total scores</p>
                              </div>
                            )}

                            {formData.type === 'perfectionist' && (
                              <div className="space-y-2">
                                <Label htmlFor="exact_score" className="text-sm font-medium">Exact Score</Label>
                                <Input
                                  id="exact_score"
                                  type="number"
                                  min="1"
                                  value={formData.criteria?.threshold || ''}
                                  onChange={(e) => handleCriteriaChange('threshold', parseInt(e.target.value))}
                                  placeholder="e.g., 100000"
                                  className="h-11"
                                />
                                <p className="text-xs text-muted-foreground">Players must score exactly this amount</p>
                              </div>
                            )}

                            {formData.type === 'streak_master' && (
                              <div className="space-y-2">
                                <Label htmlFor="streak_days" className="text-sm font-medium">Consecutive Days</Label>
                                <Input
                                  id="streak_days"
                                  type="number"
                                  min="1"
                                  value={formData.criteria?.days || ''}
                                  onChange={(e) => handleCriteriaChange('days', parseInt(e.target.value))}
                                  placeholder="e.g., 7"
                                  className="h-11"
                                />
                                <p className="text-xs text-muted-foreground">Players must submit scores for this many days in a row</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Step 4: Appearance & Settings */}
                    <Card className="border-l-4 border-l-purple-500">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <span className="mr-2 text-xl">🎨</span>
                          Step 4: Appearance & Settings
                        </CardTitle>
                        <CardDescription>
                          Customize how your achievement looks and whether it's active.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Badge Color</Label>
                              <Select
                                value={formData.badge_color}
                                onValueChange={(value) => setFormData(prev => ({ ...prev, badge_color: value }))}
                              >
                                <SelectTrigger className="h-11">
                                  <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: formData.badge_color }} />
                                    <SelectValue placeholder="Choose color" />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {DEFAULT_COLORS.map(color => (
                                    <SelectItem key={color} value={color}>
                                      <div className="flex items-center">
                                        <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: color }} />
                                        {color}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Status</Label>
                              <div className="flex items-center space-x-3">
                                <Switch
                                  id="is_active"
                                  checked={formData.is_active}
                                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                                />
                                <Label htmlFor="is_active" className="text-sm">
                                  {formData.is_active ? 'Active (players can earn this achievement)' : 'Inactive (temporarily disabled)'}
                                </Label>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Preview</Label>
                            <div className="border rounded-lg p-4 bg-muted/30">
                              <div className="flex items-center space-x-3">
                                <div
                                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-emoji shadow-lg"
                                  style={{ backgroundColor: formData.badge_color }}
                                >
                                  {formData.type ? getTypeIcon(formData.type) : '🏆'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium text-sm truncate">
                                    {formData.name || 'Achievement Name'}
                                  </h3>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {formData.description || 'Achievement description goes here...'}
                                  </p>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                      {formData.points || 0} points
                                    </span>
                                    {!formData.is_active && (
                                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                                        Inactive
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                      Cancel
                    </Button>
                    <Button onClick={saveAchievement} disabled={isSaveDisabled} variant="outline">
                      {isSaving ? 'Saving...' : (editingAchievement ? 'Update Achievement' : 'Create Achievement')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <SuggestAchievementDialog onAchievementAdded={loadAchievements} />
            </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>
                {isTournamentCreator ? 'All Tournament Achievements' : 'My Achievements'}
              </CardTitle>
              <CardDescription>
                {filteredAchievements.length} achievement{filteredAchievements.length !== 1 ? 's' : ''} found
                {isTournamentCreator && ' (you can edit all achievements in tournaments you created)'}
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
              onEdit={handleEditAchievement}
              onDelete={handleDeleteAchievement}
              onToggleStatus={toggleAchievementStatus}
              getTypeIcon={getTypeIcon}
              getCriteriaDisplay={getCriteriaDisplay}
              isTournamentCreator={isTournamentCreator}
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
        variant="outline"
        onConfirm={confirmDeleteAchievement}
      />

      <ConfirmationDialog
        open={clearAllDialog.open}
        onOpenChange={(open) => setClearAllDialog({ open })}
        title="Clear All Achievement Progress"
        description={`Are you sure you want to clear ALL PLAYERS' achievement progress for "${currentTournament?.name}"? This will reset everyone's achievement unlocks but keep the achievements themselves. This action cannot be undone.`}
        confirmText="Clear All Progress"
        cancelText="Cancel"
        variant="outline"
        onConfirm={confirmClearAllAchievements}
      />

      <ConfirmationDialog
        open={clearAllAchievementsDialog.open}
        onOpenChange={(open) => setClearAllAchievementsDialog({ open })}
        title="Clear All Achievement Definitions"
        description={`Are you sure you want to delete ALL ACHIEVEMENT DEFINITIONS for "${currentTournament?.name}"? This will permanently remove all achievements and their progress. This action cannot be undone.`}
        confirmText="Delete All Achievements"
        cancelText="Cancel"
        variant="outline"
        onConfirm={confirmClearAllAchievementDefinitions}
      />
      </div>
    </div>
    </div>
  );
}

export default AchievementManagerV2;
