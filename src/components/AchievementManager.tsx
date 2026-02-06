import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Shuffle, ChevronDown, ChevronUp } from "lucide-react";
import { useTournament } from "@/contexts/TournamentContext";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useQueryClient } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  created_at: string;
  updated_at: string;
  unlock_count: number;
}

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

interface Game {
  id: string;
  name: string;
  logo_url: string | null;
}

const AchievementManager = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('all');
  const [expandedGames, setExpandedGames] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "first_score",
    badge_icon: "🏆",
    badge_color: "#FFD700",
    criteria: "{}",
    points: 10,
    is_active: true
  });
  const { toast } = useToast();
  const { currentTournament } = useTournament();
  const queryClient = useQueryClient();

  // Load games for the current tournament
  const loadGames = async () => {
    if (!currentTournament) return [];
    
    const { data, error } = await api
      .from('games')
      .select('id, name, logo_url')
      .eq('tournament_id', currentTournament.id)
      .order('name', { ascending: true });
      
    if (error) {
      console.error('Error loading games:', error);
      return [];
    }
    
    return data || [];
  };

  // Load achievements for current tournament
  const loadAchievements = async () => {
    if (!currentTournament) {
      console.log('No current tournament selected');
      return;
    }
    
    try {
      setLoading(true);
      
      // Load games first
      const gamesData = await loadGames();
      setGames(gamesData);
      
      // Initialize expanded state for games
      const initialExpandedState = gamesData.reduce((acc, game) => ({
        ...acc,
        [game.id]: false
      }), {});
      setExpandedGames(initialExpandedState);
      
      // Load all achievements
      const { data, error } = await api.rpc('get_tournament_achievements' as any, {
        p_tournament_id: currentTournament.id
      });

      console.log('RPC get_tournament_achievements result:', { data, error });
      
      if (error) throw error;
      setAchievements((data as Achievement[]) || []);
    } catch (error: any) {
      console.error('Error loading achievements:', error);
      toast({
        title: "Error",
        description: "Failed to load achievements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAchievements();
  }, [currentTournament]);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "first_score",
      badge_icon: "🏆",
      badge_color: "#FFD700",
      criteria: "{}",
      points: 10,
      is_active: true
    });
    setEditingAchievement(null);
  };

  const openEditDialog = (achievement: Achievement) => {
    setEditingAchievement(achievement);
    setFormData({
      name: achievement.name,
      description: achievement.description,
      type: achievement.type,
      badge_icon: achievement.badge_icon,
      badge_color: achievement.badge_color,
      criteria: JSON.stringify(achievement.criteria ?? {}),
      points: achievement.points,
      is_active: achievement.is_active
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };


  const generateRandomAchievement = () => {
    const randomAchievements = [
      {
        name: "First Steps",
        description: "Submit your first score",
        type: "score_based",
        badge_icon: "👶",
        badge_color: "#4CAF50",
        criteria: '{"min_scores": 1}',
        points: 5
      },
      {
        name: "High Roller",
        description: "Achieve a score of 10,000 or more",
        type: "score_based",
        badge_icon: "🎯",
        badge_color: "#FF9800",
        criteria: '{"min_score": 10000}',
        points: 25
      },
      {
        name: "Game Explorer",
        description: "Play 5 different games",
        type: "participation",
        badge_icon: "🗺️",
        badge_color: "#2196F3",
        criteria: '{"game_count": 5}',
        points: 15
      },
      {
        name: "Perfectionist",
        description: "Achieve a score of 50,000 or more",
        type: "score_based",
        badge_icon: "💎",
        badge_color: "#9C27B0",
        criteria: '{"min_score": 50000}',
        points: 50
      },
      {
        name: "Dedicated Player",
        description: "Submit 25 scores",
        type: "participation",
        badge_icon: "🔥",
        badge_color: "#F44336",
        criteria: '{"min_scores": 25}',
        points: 30
      },
      {
        name: "Champion",
        description: "Reach the top of any leaderboard",
        type: "leaderboard",
        badge_icon: "👑",
        badge_color: "#FFD700",
        criteria: '{"first_place": true}',
        points: 100
      },
      {
        name: "Arcade Master",
        description: "Play 10 different games",
        type: "participation",
        badge_icon: "🕹️",
        badge_color: "#607D8B",
        criteria: '{"game_count": 10}',
        points: 40
      },
      {
        name: "Score Hunter",
        description: "Submit 100 scores",
        type: "participation",
        badge_icon: "🏹",
        badge_color: "#795548",
        criteria: '{"min_scores": 100}',
        points: 75
      }
    ];

    const randomIndex = Math.floor(Math.random() * randomAchievements.length);
    const randomAchievement = randomAchievements[randomIndex];
    
    setFormData({
      name: randomAchievement.name,
      description: randomAchievement.description,
      type: randomAchievement.type,
      badge_icon: randomAchievement.badge_icon,
      badge_color: randomAchievement.badge_color,
      criteria: randomAchievement.criteria,
      points: randomAchievement.points,
      is_active: true
    });
    setIsDialogOpen(true);
  };

  const saveAchievement = async () => {
    if (!currentTournament) return;
    
    if (!formData.name.trim() || !formData.description.trim()) {
      toast({
        title: "Error",
        description: "Name and description are required",
        variant: "destructive",
      });
      return;
    }

    let criteria;
    try {
      criteria = JSON.parse(formData.criteria);
    } catch (e) {
      toast({
        title: "Error",
        description: "Invalid JSON in criteria field",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingAchievement) {
        // Update existing achievement
        const { error } = await api.rpc('update_tournament_achievement' as any, {
          p_achievement_id: editingAchievement.id,
          p_name: formData.name,
          p_description: formData.description,
          p_badge_icon: formData.badge_icon,
          p_badge_color: formData.badge_color,
          p_criteria: criteria,
          p_points: formData.points,
          p_is_active: formData.is_active
        });

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Achievement updated successfully"
        });
      } else {
        // Create new achievement
        const { error } = await api.rpc('create_tournament_achievement' as any, {
          p_tournament_id: currentTournament.id,
          p_name: formData.name,
          p_description: formData.description,
          p_type: formData.type as any,
          p_badge_icon: formData.badge_icon,
          p_badge_color: formData.badge_color,
          p_criteria: criteria,
          p_points: formData.points
        });

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Achievement created successfully"
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadAchievements();
      
      // Invalidate React Query cache
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
    } catch (error: any) {
      console.error('Error saving achievement:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save achievement",
        variant: "destructive",
      });
    }
  };

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const handleDeleteAchievement = (id: string) => setDeleteDialog({ open: true, id });
  const confirmDeleteAchievement = async () => {
    if (!deleteDialog.id) return;
    try {
      const { error } = await api.rpc('delete_tournament_achievement' as any, {
        p_achievement_id: deleteDialog.id
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Achievement deleted successfully"
      });

      loadAchievements();
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
    } catch (error: any) {
      console.error('Error deleting achievement:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete achievement",
        variant: "destructive",
      });
    }
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = ACHIEVEMENT_TYPES.find(t => t.value === type);
    return typeConfig?.icon || '🏆';
  };

  const getCriteriaDisplay = (criteria: any, type: string) => {
    if (!criteria || Object.keys(criteria).length === 0) return 'No criteria';
    
    switch (type) {
      case 'score_milestone':
      case 'high_scorer':
        return `Min Score: ${criteria.min_score?.toLocaleString() || 'N/A'}`;
      case 'game_master':
        return `Games: ${criteria.game_count || 'N/A'}`;
      case 'consistent_player':
        return `Min Scores: ${criteria.min_scores || 'N/A'}`;
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
        <CardContent>
          <p className="text-gray-500">Please select a tournament to manage achievements.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Achievement Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading achievements...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Achievement Management</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Manage achievements for {currentTournament.name}
            </p>
          </div>
          
          <div className="flex gap-2">
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
                    {editingAchievement ? 'Edit' : 'Create'} Achievement
                  </DialogTitle>
                </DialogHeader>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Achievement name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACHIEVEMENT_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Achievement description"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="badge_icon">Icon</Label>
                    <Select value={formData.badge_icon} onValueChange={(value) => setFormData(prev => ({ ...prev, badge_icon: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_ICONS.map(icon => (
                          <SelectItem key={icon} value={icon}>
                            {icon} {icon}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="badge_color">Color</Label>
                    <Select value={formData.badge_color} onValueChange={(value) => setFormData(prev => ({ ...prev, badge_color: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_COLORS.map(color => (
                          <SelectItem key={color} value={color}>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: color }}></div>
                              {color}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="points">Points</Label>
                    <Input
                      id="points"
                      type="number"
                      value={formData.points}
                      onChange={(e) => setFormData(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="criteria">Criteria (JSON)</Label>
                  <Textarea
                    id="criteria"
                    value={formData.criteria}
                    onChange={(e) => setFormData(prev => ({ ...prev, criteria: e.target.value }))}
                    placeholder='{"min_score": 1000}'
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Examples: {`{"min_score": 1000}`}, {`{"game_count": 5}`}, {`{"min_scores": 10}`}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveAchievement} variant="outline">
                    {editingAchievement ? 'Update' : 'Create'} Achievement
                  </Button>
                </div>
              </div>
            </DialogContent>
            </Dialog>
            
            <Button onClick={generateRandomAchievement} variant="outline">
              <Shuffle className="w-4 h-4 mr-2" />
              Random Achievement
            </Button>
            
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Achievement</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Criteria</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Unlocks</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {achievements.map((achievement) => {
              const typeIcon = getTypeIcon(achievement.type);
              return (
                <TableRow key={achievement.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: achievement.badge_color }}
                      >
                        {achievement.badge_icon}
                      </div>
                      <div>
                        <div className="font-medium">{achievement.name}</div>
                        <div className="text-sm text-gray-500">{achievement.description}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{typeIcon}</span>
                      {ACHIEVEMENT_TYPES.find(t => t.value === achievement.type)?.label || achievement.type}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {getCriteriaDisplay(achievement.criteria, achievement.type)}
                  </TableCell>
                  <TableCell>{achievement.points}</TableCell>
                  <TableCell>{achievement.unlock_count}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      achievement.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {achievement.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(achievement)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500 hover:border-red-400 hover:bg-red-500/10"
                        onClick={() => handleDeleteAchievement(achievement.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {achievements.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No achievements found. Create your first achievement!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    <ConfirmationDialog
      open={deleteDialog.open}
      onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
      title="Delete Achievement"
      description="Are you sure you want to delete this achievement? This will deactivate it but preserve existing unlocks."
      confirmText="Delete Achievement"
      cancelText="Cancel"
      variant="outline"
      onConfirm={confirmDeleteAchievement}
    />
    </>
  );
};

// Separate component for the achievements table
const AchievementsTable = ({ 
  achievements, 
  onEdit, 
  onDelete, 
  onToggleStatus 
}: { 
  achievements: Achievement[];
  onEdit: (achievement: Achievement) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (achievement: Achievement) => void;
}) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Icon</TableHead>
        <TableHead>Name</TableHead>
        <TableHead>Description</TableHead>
        <TableHead>Type</TableHead>
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
            <span className="px-2 py-1 bg-gray-800 rounded text-xs">
              {achievement.type}
            </span>
          </TableCell>
          <TableCell>{achievement.points}</TableCell>
          <TableCell>
            <div className="flex items-center space-x-2">
              <Switch 
                checked={achievement.is_active} 
                onCheckedChange={() => onToggleStatus(achievement)}
              />
              <span className={achievement.is_active ? 'text-green-500' : 'text-gray-500'}>
                {achievement.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export default AchievementManager;
