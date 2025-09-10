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
import { Pencil, Trash2, Plus, Shuffle, ChevronDown, ChevronUp } from "lucide-react";
import { useTournament } from "@/contexts/TournamentContext";
import { useQueryClient } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const { currentTournament } = useTournament();
  const queryClient = useQueryClient();

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
      
      // Prefer direct query filtered by author if we know the current user id
      if (currentUserId) {
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

  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  // Group achievements by game ID (or 'general' if no game_id)
  const groupedAchievements = achievements.reduce((acc, achievement) => {
    const gameId = achievement.criteria?.game_id || 'general';
    if (!acc[gameId]) {
      acc[gameId] = [];
    }
    acc[gameId].push(achievement);
    return acc;
  }, {} as Record<string, Achievement[]>);
  
  // Filter achievements based on selected game
  const filteredAchievements = selectedGameId === 'all' 
    ? achievements 
    : achievements.filter(a => {
        const achievementGameId = a.criteria?.game_id || 'general';
        return achievementGameId === selectedGameId;
      });

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

  // Delete an achievement
  const deleteAchievement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this achievement?')) return;
    
    try {
      const { error } = await supabase
        .from('achievements')
        .delete()
        .eq('id', id);
        
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

  // Toggle achievement status
  const toggleAchievementStatus = async (achievement: Achievement) => {
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
    setEditingAchievement(achievement);
    setFormData({
      name: achievement.name,
      description: achievement.description,
      type: achievement.type,
      badge_icon: achievement.badge_icon,
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
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Achievement Manager</h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
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
                    onValueChange={(value: AchievementType) => setFormData(prev => ({ ...prev, type: value }))}
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
                    <Select
                      value={formData.badge_icon}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, badge_icon: value }))}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue placeholder="Icon" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_ICONS.map(icon => (
                          <SelectItem key={icon} value={icon}>
                            {icon}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                <Button onClick={saveAchievement} disabled={isSaveDisabled}>
                  {isSaving ? 'Saving...' : (editingAchievement ? 'Update Achievement' : 'Create Achievement')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="w-full max-w-xs">
          <Label htmlFor="game-filter">Filter by Game</Label>
          <Select 
            value={selectedGameId} 
            onValueChange={setSelectedGameId}
          >
            <SelectTrigger id="game-filter" className="w-full">
              <SelectValue placeholder="Select a game" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Games</SelectItem>
              <SelectItem value="general">General Achievements</SelectItem>
              {games.map(game => (
                <SelectItem key={game.id} value={game.id}>
                  {game.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>
                {selectedGameId === 'all' 
                  ? 'All Achievements' 
                  : selectedGameId === 'general' 
                    ? 'General Achievements' 
                    : `Achievements for ${games.find(g => g.id === selectedGameId)?.name || 'Selected Game'}`}
              </CardTitle>
              <CardDescription>
                {filteredAchievements.length} achievement{filteredAchievements.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-arcade-neonCyan"></div>
            </div>
          ) : filteredAchievements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No achievements found. Create your first achievement!
            </div>
          ) : (
            <div className="space-y-4">
              {selectedGameId === 'all' ? (
                // Show all achievements grouped by game
                <div className="space-y-6">
                  {/* General achievements */}
                  {groupedAchievements['general']?.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div 
                        className="flex items-center justify-between p-4 bg-gray-900 cursor-pointer"
                        onClick={() => toggleGameExpanded('general')}
                      >
                        <h3 className="text-lg font-semibold">General Achievements</h3>
                        {expandedGames['general'] ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                      <Collapsible open={expandedGames['general']}>
                        <CollapsibleContent>
                          <AchievementsTable 
                            achievements={groupedAchievements['general']} 
                            onEdit={handleEditAchievement}
                            onDelete={deleteAchievement}
                            onToggleStatus={toggleAchievementStatus}
                            getTypeIcon={getTypeIcon}
                            getCriteriaDisplay={getCriteriaDisplay}
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}
                  
                  {/* Game-specific achievements */}
                  {games.map(game => (
                    groupedAchievements[game.id]?.length > 0 && (
                      <div key={game.id} className="border rounded-lg overflow-hidden">
                        <div 
                          className="flex items-center justify-between p-4 bg-gray-900 cursor-pointer"
                          onClick={() => toggleGameExpanded(game.id)}
                        >
                          <div className="flex items-center space-x-3">
                            {game.logo_url ? (
                              <img 
                                src={game.logo_url} 
                                alt={game.name}
                                className="w-8 h-8 object-cover rounded"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center">
                                🎮
                              </div>
                            )}
                            <h3 className="text-lg font-semibold">{game.name}</h3>
                          </div>
                          {expandedGames[game.id] ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                        <Collapsible open={expandedGames[game.id]}>
                          <CollapsibleContent>
                            <AchievementsTable 
                              achievements={groupedAchievements[game.id]} 
                              onEdit={handleEditAchievement}
                              onDelete={deleteAchievement}
                              onToggleStatus={toggleAchievementStatus}
                              getTypeIcon={getTypeIcon}
                              getCriteriaDisplay={getCriteriaDisplay}
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                // Show filtered achievements in a simple table
                <AchievementsTable 
                  achievements={filteredAchievements} 
                  onEdit={handleEditAchievement}
                  onDelete={deleteAchievement}
                  onToggleStatus={toggleAchievementStatus}
                  getTypeIcon={getTypeIcon}
                  getCriteriaDisplay={getCriteriaDisplay}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
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
  getCriteriaDisplay
}: { 
  achievements: any[];
  onEdit: (achievement: any) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (achievement: any) => void;
  getTypeIcon: (type: string) => string;
  getCriteriaDisplay: (criteria: any, type: string) => string;
}) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Icon</TableHead>
        <TableHead>Name</TableHead>
        <TableHead>Description</TableHead>
        <TableHead>Type</TableHead>
        <TableHead>Criteria</TableHead>
        <TableHead>Points</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Unlocks</TableHead>
        <TableHead>Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {achievements.map((achievement) => (
        <TableRow key={achievement.id}>
          <TableCell>
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
              style={{ backgroundColor: achievement.badge_color }}
            >
              {achievement.badge_icon}
            </div>
          </TableCell>
          <TableCell className="font-medium">{achievement.name}</TableCell>
          <TableCell>{achievement.description}</TableCell>
          <TableCell>
            <div className="flex items-center space-x-2">
              <span>{getTypeIcon(achievement.type)}</span>
              <span className="text-xs text-gray-500">
                {ACHIEVEMENT_TYPES.find(t => t.value === achievement.type)?.label || achievement.type}
              </span>
            </div>
          </TableCell>
          <TableCell className="text-xs">
            {getCriteriaDisplay(achievement.criteria, achievement.type)}
          </TableCell>
          <TableCell>{achievement.points}</TableCell>
          <TableCell>
            <div className="flex items-center space-x-2">
              <Switch 
                checked={achievement.is_active} 
                onCheckedChange={() => onToggleStatus(achievement)}
                className="data-[state=checked]:bg-arcade-neonCyan"
              />
              <span className={achievement.is_active ? 'text-green-500' : 'text-gray-500'}>
                {achievement.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </TableCell>
          <TableCell>{achievement.unlock_count || 0}</TableCell>
          <TableCell>
            <div className="flex space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(achievement)}
                className="text-blue-500 hover:text-blue-600"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(achievement.id)}
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
