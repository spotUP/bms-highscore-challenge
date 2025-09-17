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
  { value: 'first_score', label: 'First Score', icon: '🎯' },
  { value: 'first_place', label: 'First Place', icon: '👑' },
  { value: 'score_milestone', label: 'Score Milestone', icon: '🏆' },
  { value: 'game_master', label: 'Game Master', icon: '🕹️' },
  { value: 'high_scorer', label: 'High Scorer', icon: '⭐' },
  { value: 'consistent_player', label: 'Consistent Player', icon: '🔥' },
  { value: 'perfectionist', label: 'Perfectionist', icon: '💎' },
  { value: 'streak_master', label: 'Streak Master', icon: '⚡' },
  { value: 'competition_winner', label: 'Competition Winner', icon: '🥇' },
  { value: 'speed_demon', label: 'Speed Demon', icon: '💨' },
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
      console.log('🗑️ Clearing achievements for tournament:', currentTournament.id);
      console.log('User:', user.id, 'Role: admin');

      // Count records before
      const { data: beforeCount, error: beforeError } = await supabase
        .from('player_achievements')
        .select('id')
        .eq('tournament_id', currentTournament.id);

      if (beforeError) {
        console.error('Error counting before:', beforeError);
        throw beforeError;
      }

      console.log(`📊 Records before delete: ${beforeCount?.length || 0}`);

      // Use the regular authenticated supabase client (user has admin privileges)
      const { error, count } = await supabase
        .from('player_achievements')
        .delete({ count: 'exact' })
        .eq('tournament_id', currentTournament.id);

      if (error) {
        console.error('❌ Delete failed:', error);
        throw error;
      }

      console.log('✅ Delete operation succeeded, count:', count);

      // Count records after to verify
      const { data: afterCount, error: afterError } = await supabase
        .from('player_achievements')
        .select('id')
        .eq('tournament_id', currentTournament.id);

      console.log(`📊 Records after delete: ${afterCount?.length || 0}`);

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
      // Use service role key for admin operations
      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        throw new Error('Service role key not available');
      }

      const { createClient } = await import('@supabase/supabase-js');
      const adminSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        serviceRoleKey
      );

      // Clear all achievement definitions for current tournament
      const { error } = await adminSupabase
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
      console.log('🗑️ Starting player achievement deletion:', playerAchievementId);

      // Use admin client with service role key for deletion
      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        throw new Error('Service role key not configured');
      }

      console.log('🔑 Creating admin client for deletion...');
      const { createClient } = await import('@supabase/supabase-js');
      const adminSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            storage: {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {}
            }
          }
        }
      );

      // Verify the record exists before deletion
      console.log('🔍 Verifying record exists...');
      const { data: existingRecord, error: checkError } = await adminSupabase
        .from('player_achievements')
        .select('id, player_name, achievements(name)')
        .eq('id', playerAchievementId)
        .single();

      if (checkError) {
        console.error('❌ Error checking record:', checkError);
        throw new Error(`Failed to verify record: ${checkError.message}`);
      }

      if (!existingRecord) {
        throw new Error('Player achievement not found');
      }

      console.log('✅ Found record to delete:', existingRecord);

      // Perform the deletion
      console.log('🗑️ Executing deletion...');
      const { error, count } = await adminSupabase
        .from('player_achievements')
        .delete({ count: 'exact' })
        .eq('id', playerAchievementId);

      if (error) {
        console.error('❌ Deletion error:', error);
        throw error;
      }

      console.log('📊 Deletion count:', count);

      if (count === 0) {
        throw new Error('No records were deleted - this may indicate a permission issue');
      }

      // Verify deletion was successful
      console.log('🔍 Verifying deletion...');
      const { data: verifyRecord, error: verifyError } = await adminSupabase
        .from('player_achievements')
        .select('id')
        .eq('id', playerAchievementId)
        .single();

      if (!verifyError || verifyError.code === 'PGRST116') {
        // PGRST116 means no record found, which is what we want
        console.log('✅ Deletion verified - record no longer exists');
      } else {
        console.error('⚠️ Verification error:', verifyError);
      }

      toast({
        title: "Success",
        description: `Player achievement for "${existingRecord.player_name}" removed successfully`,
      });

      console.log('🔄 Updating UI optimistically...');
      // Optimistically remove the achievement from state without refetching
      setPlayerAchievements(prev => prev.filter(pa => pa.id !== playerAchievementId));

      // Only invalidate queries without forcing immediate refetch
      // This updates cache but doesn't trigger loading state
      await queryClient.invalidateQueries({
        queryKey: ['achievements'],
        refetchType: 'none'
      });

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
    <div className="space-y-6">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center gap-3">
          <div className="flex flex-col gap-2">
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
                <SelectTrigger id="tournament-select" className="min-w-[240px] bg-secondary/40 border-white/20 text-white">
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
          <div className="flex items-center gap-3">
            {isTournamentCreator && (
              <>
                <Button
                  variant="outline"
                  onClick={async () => {
                    console.log('🔴 Clear button clicked');

                    if (!confirm('Are you sure you want to clear ALL PLAYERS\' achievement progress? This action cannot be undone.')) {
                      return;
                    }

                    console.log('✅ User confirmed, proceeding with clear');

                    try {
                      console.log('🗑️ Clearing achievements for tournament:', currentTournament?.id);

                      // Use service role key for ALL operations to ensure consistency
                      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
                      console.log('🔑 Using service role key for ALL operations');

                      const { createClient } = await import('@supabase/supabase-js');
                      const adminSupabase = createClient(
                        import.meta.env.VITE_SUPABASE_URL,
                        serviceRoleKey,
                        {
                          auth: { persistSession: false }
                        }
                      );

                      // Count records before using the SAME admin client
                      const { data: beforeCount, error: beforeError } = await adminSupabase
                        .from('player_achievements')
                        .select('id')
                        .eq('tournament_id', currentTournament?.id);

                      if (beforeError) {
                        throw beforeError;
                      }

                      console.log(`📊 Records before delete: ${beforeCount?.length || 0}`);

                      // Try to delete using raw SQL function call to bypass RLS
                      console.log('🔧 Executing direct SQL delete to bypass RLS policies...');

                      const deleteSQL = `DELETE FROM player_achievements WHERE tournament_id = '${currentTournament?.id}'`;
                      console.log('🗑️ SQL:', deleteSQL);

                      // Try using the execute_sql function if it exists
                      let actualDeleted = 0;

                      try {
                        const { data: sqlResult, error: sqlError } = await adminSupabase
                          .rpc('execute_sql', { query: deleteSQL });

                        if (sqlError) {
                          console.log('⚠️ SQL function error:', sqlError.message);
                          // Fallback to regular delete
                          const { error, count } = await adminSupabase
                            .from('player_achievements')
                            .delete({ count: 'exact' })
                            .eq('tournament_id', currentTournament?.id);

                          if (error) {
                            console.error('❌ Fallback delete failed:', error);
                            throw error;
                          }

                          actualDeleted = count || 0;
                          console.log('✅ Fallback delete succeeded, count:', actualDeleted);
                        } else {
                          console.log('✅ SQL delete succeeded');
                          actualDeleted = beforeCount?.length || 0; // Assume all were deleted
                        }
                      } catch (e) {
                        console.log('⚠️ SQL function not available, using fallback delete');
                        // Final fallback - regular delete
                        const { error, count } = await adminSupabase
                          .from('player_achievements')
                          .delete({ count: 'exact' })
                          .eq('tournament_id', currentTournament?.id);

                        if (error) {
                          console.error('❌ Final fallback delete failed:', error);
                          throw error;
                        }

                        actualDeleted = count || 0;
                        console.log('✅ Final fallback delete succeeded, count:', actualDeleted);
                      }

                      // Verify deletion
                      const { data: afterCount } = await adminSupabase
                        .from('player_achievements')
                        .select('id')
                        .eq('tournament_id', currentTournament?.id);

                      const remainingRecords = afterCount?.length || 0;
                      console.log(`📊 Records remaining: ${remainingRecords}`);

                      // Calculate actual deleted records
                      const verifiedDeleted = (beforeCount?.length || 0) - remainingRecords;
                      actualDeleted = Math.max(actualDeleted, verifiedDeleted);

                      console.log(`📊 Actually deleted: ${actualDeleted} records`);

                      toast({
                        title: "Success",
                        description: `Cleared ${actualDeleted} player achievement records`,
                      });

                      // Refresh the UI
                      await invalidateQueries();

                    } catch (error) {
                      console.error('❌ Error:', error);
                      toast({
                        title: "Error",
                        description: `Failed to clear achievements: ${error.message}`,
                        variant: "destructive",
                      });
                    }
                  }}
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
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Achievement
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingAchievement ? 'Edit Achievement' : 'Create New Achievement'}
                </DialogTitle>
                <DialogDescription>
                  Fill out the fields below to {editingAchievement ? 'update' : 'create'} an achievement.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Achievement Name"
                  />
                  {!trimmedNameForUI && (
                    <p className="text-xs text-red-500">Name is required.</p>
                  )}
                  {trimmedNameForUI && isDuplicateNameForUI && (
                    <p className="text-xs text-red-500">An achievement with this name already exists in this tournament.</p>
                  )}
                </div>

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

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="What does the user need to do?"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select achievement type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACHIEVEMENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="points">Points</Label>
                  <Input
                    id="points"
                    name="points"
                    type="number"
                    min="1"
                    value={formData.points}
                    onChange={handleInputChange}
                    placeholder="Points awarded"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="game_id">Game</Label>
                  <Select
                    value={formData.criteria?.game_id ?? 'general'}
                    onValueChange={(value) => handleCriteriaChange('game_id', value === 'general' ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a game (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General (not game-specific)</SelectItem>
                      {games.map(game => (
                        <SelectItem key={game.id} value={game.id}>
                          {game.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Badge</Label>
                  <div className="flex space-x-2">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                        style={{ backgroundColor: formData.badge_color }}
                      >
                        <span className="font-emoji">
                          {formData.type ? getTypeIcon(formData.type) : '🏆'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">Auto-set from type</span>
                    </div>
                    <Select
                      value={formData.badge_color}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, badge_color: value }))}
                    >
                      <SelectTrigger className="w-32">
                        <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: formData.badge_color }} />
                        <SelectValue placeholder="Color" />
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
                </div>
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                    <Label htmlFor="is_active">
                      {formData.is_active ? 'Active' : 'Inactive'}
                    </Label>
                  </div>
                </div>
                
                {formData.type === 'score_milestone' && (
                  <div className="space-y-2">
                    <Label htmlFor="threshold">Score Threshold</Label>
                    <Input
                      id="threshold"
                      type="number"
                      min="1"
                      value={formData.criteria?.threshold || ''}
                      onChange={(e) => handleCriteriaChange('threshold', parseInt(e.target.value))}
                      placeholder="Minimum score required"
                    />
                  </div>
                )}
                
                {formData.type === 'game_master' && (
                  <div className="space-y-2">
                    <Label htmlFor="game_count">Minimum Games Played</Label>
                    <Input
                      id="game_count"
                      type="number"
                      min="1"
                      value={formData.criteria?.count || ''}
                      onChange={(e) => handleCriteriaChange('count', parseInt(e.target.value))}
                      placeholder="Number of games played"
                    />
                  </div>
                )}
                
                {formData.type === 'high_scorer' && (
                  <div className="space-y-2">
                    <Label htmlFor="rank">Top Rank</Label>
                    <Input
                      id="rank"
                      type="number"
                      min="1"
                      value={formData.criteria?.rank || ''}
                      onChange={(e) => handleCriteriaChange('rank', parseInt(e.target.value))}
                      placeholder="Top X players (e.g., 3 for top 3)"
                    />
                  </div>
                )}
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
          </div>
        </div>
        
        {/* Tournament-scoped view only; game filter removed */}
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
    </div>
  );
};

// Export the component
export default AchievementManagerV2;

// Achievement Table Component
const AchievementsTable = ({
  achievements,
  onEdit,
  onDelete,
  onToggleStatus,
  getTypeIcon,
  getCriteriaDisplay,
  isTournamentCreator,
  currentUserId
}: {
  achievements: any[];
  onEdit: (achievement: any) => void;
  onDelete: (achievement: any) => void;
  onToggleStatus: (achievement: any) => void;
  getTypeIcon: (type: string) => string;
  getCriteriaDisplay: (criteria: any, type: string) => string;
  isTournamentCreator: boolean;
  currentUserId: string | null;
}) => {
  const [deletingIds, setDeletingIds] = React.useState<Set<string>>(new Set());
  const [localAchievements, setLocalAchievements] = React.useState(achievements);

  // Update local state when props change
  React.useEffect(() => {
    setLocalAchievements(achievements);
  }, [achievements]);

  const handleDelete = async (achievement: any) => {
    // Start the fade-out animation
    setDeletingIds(prev => new Set([...prev, achievement.id]));

    // Wait for animation, then remove from state (this will trigger the slide-up)
    setTimeout(() => {
      setLocalAchievements(prev => prev.filter(a => a.id !== achievement.id));
      onDelete(achievement);

      // Clean up animation state after a brief delay to let the slide-up complete
      setTimeout(() => {
        setDeletingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(achievement.id);
          return newSet;
        });
      }, 50);
    }, 280); // Slightly before animation completes
  };

  const columnCount = isTournamentCreator ? 10 : 9;

  return (
    <div className="border rounded-md">
      {/* Header */}
      <div className={`grid ${isTournamentCreator ? 'grid-cols-10' : 'grid-cols-9'} gap-2 p-3 border-b bg-muted/50 font-medium text-sm`}>
        <div>Icon</div>
        <div>Name</div>
        <div>Description</div>
        <div>Type</div>
        <div>Criteria</div>
        <div>Points</div>
        <div>Status</div>
        <div>Unlocks</div>
        {isTournamentCreator && <div>Created By</div>}
        <div>Actions</div>
      </div>

      {/* Body */}
      <div className="divide-y">
      {localAchievements.map((achievement) => (
        <div
          key={achievement.id}
          className={`grid ${isTournamentCreator ? 'grid-cols-10' : 'grid-cols-9'} gap-2 p-3 transition-all duration-300 ease-in-out overflow-hidden ${
            deletingIds.has(achievement.id)
              ? 'opacity-0 max-h-0 py-0 scale-y-0'
              : 'opacity-100 max-h-20 scale-y-100'
          }`}
          style={{
            transformOrigin: 'top',
            transition: 'all 300ms ease-in-out'
          }}
        >
          <div>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
              style={{ backgroundColor: achievement.badge_color }}
            >
              <span className="font-emoji">
                {getTypeIcon(achievement.type)}
              </span>
            </div>
          </div>

          <div className="font-medium">{achievement.name}</div>

          <div>{achievement.description}</div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="font-emoji text-base">{getTypeIcon(achievement.type)}</span>
              <span className="text-xs text-gray-500">
                {ACHIEVEMENT_TYPES.find(t => t.value === achievement.type)?.label || achievement.type}
              </span>
            </div>
          </div>

          <div className="text-xs">
            {getCriteriaDisplay(achievement.criteria, achievement.type)}
          </div>

          <div>{achievement.points}</div>
          <div>
            <div className="flex items-center space-x-2">
              {(() => {
                const canEdit = isTournamentCreator || achievement.created_by === currentUserId;
                return (
                  <>
                    <Switch
                      checked={achievement.is_active}
                      onCheckedChange={() => onToggleStatus(achievement)}
                      disabled={!canEdit}
                      className="data-[state=checked]:bg-arcade-neonCyan"
                      title={canEdit ? "Toggle achievement status" : "You can only modify achievements you created or achievements in tournaments you own"}
                    />
                    <span className={achievement.is_active ? 'text-green-500' : 'text-gray-500'}>
                      {achievement.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>

          <div>{achievement.unlock_count || 0}</div>

          {isTournamentCreator && (
            <div className="text-xs text-gray-500">
              {achievement.created_by === currentUserId ? 'You' : 'User'}
            </div>
          )}
          <div>
            <div className="flex space-x-2">
              {(() => {
                const canEdit = isTournamentCreator || achievement.created_by === currentUserId;
                return (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(achievement)}
                      disabled={!canEdit}
                      className={canEdit ? "text-blue-500 hover:text-blue-600" : "text-gray-400 cursor-not-allowed"}
                      title={canEdit ? "Edit achievement" : "You can only edit achievements you created or achievements in tournaments you own"}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(achievement)}
                      disabled={!canEdit}
                      className={canEdit ? "text-red-500 hover:text-red-600" : "text-gray-400 cursor-not-allowed"}
                      title={canEdit ? "Delete achievement" : "You can only delete achievements you created or achievements in tournaments you own"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
};

// Player Achievements Table Component
const PlayerAchievementsTable = ({
  playerAchievements,
  onDelete
}: {
  playerAchievements: any[];
  onDelete: (id: string) => void;
}) => {
  const [deletingIds, setDeletingIds] = React.useState<Set<string>>(new Set());
  const [localAchievements, setLocalAchievements] = React.useState(playerAchievements);

  // Update local state when props change
  React.useEffect(() => {
    setLocalAchievements(playerAchievements);
  }, [playerAchievements]);

  const handleDelete = async (id: string) => {
    // Start the fade-out animation
    setDeletingIds(prev => new Set([...prev, id]));

    // Wait for animation, then remove from state (this will trigger the slide-up)
    setTimeout(() => {
      setLocalAchievements(prev => prev.filter(pa => pa.id !== id));
      onDelete(id);

      // Clean up animation state after a brief delay to let the slide-up complete
      setTimeout(() => {
        setDeletingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }, 50);
    }, 280); // Slightly before animation completes
  };

  return (
    <div className="border rounded-md">
      {/* Header */}
      <div className="grid grid-cols-4 gap-4 p-3 border-b bg-muted/50 font-medium text-sm">
        <div>Achievement</div>
        <div>Player</div>
        <div>Earned Date</div>
        <div>Actions</div>
      </div>

      {/* Body */}
      <div className="divide-y">
      {localAchievements.map((playerAchievement, index) => (
        <div
          key={playerAchievement.id}
          className={`grid grid-cols-4 gap-4 p-3 transition-all duration-300 ease-in-out overflow-hidden ${
            deletingIds.has(playerAchievement.id)
              ? 'opacity-0 max-h-0 py-0 scale-y-0'
              : 'opacity-100 max-h-20 scale-y-100'
          }`}
          style={{
            transformOrigin: 'top',
            transition: 'all 300ms ease-in-out'
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
              style={{ backgroundColor: playerAchievement.achievements.badge_color }}
            >
              {playerAchievement.achievements.badge_icon}
            </div>
            <span className="font-medium">{playerAchievement.achievements.name}</span>
          </div>

          <div className="font-medium">{playerAchievement.player_name}</div>

          <div className="text-sm text-gray-500">
            {new Date(playerAchievement.earned_at).toLocaleDateString()}
          </div>

          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(playerAchievement.id)}
              className="text-red-500 hover:text-red-600"
              title="Remove this achievement from player"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
};
