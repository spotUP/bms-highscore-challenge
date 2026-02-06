import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, RefreshCw, Plus, Edit3, Eye, Save, BookOpen, Zap, Copy } from "lucide-react";
import { useTournament } from "@/contexts/TournamentContext";

interface SuggestedAchievement {
  name: string;
  description: string;
  type: string;
  badge_icon: string;
  badge_color: string;
  criteria: any;
  points: number;
  reasoning: string;
  advanced_criteria?: AdvancedCriteria;
}

interface AdvancedCriteria {
  operator: 'AND' | 'OR';
  conditions: AchievementCondition[];
}

interface AchievementCondition {
  type: string;
  criteria: any;
  description: string;
}

interface EditableAchievement extends SuggestedAchievement {
  isEditing: boolean;
}

interface SuggestAchievementDialogProps {
  onAchievementAdded: () => void;
}

const achievementTypes = [
  'first_score', 'first_place', 'score_milestone', 'game_master',
  'high_scorer', 'consistent_player', 'perfectionist', 'streak_master',
  'competition_winner', 'speed_demon'
];

const icons = ['🏆', '🥇', '🎯', '⭐', '💎', '🔥', '⚡', '🎮', '👑', '🏅', '🌟', '💫', '🚀', '🎪', '🎭', '🎨'];
const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'];

const achievementTemplates = [
  {
    name: 'Score Rookie',
    description: 'Score 5,000 points or more in any game',
    type: 'score_milestone',
    icon: '🎯',
    color: '#4ECDC4',
    points: 25,
    criteria: { min_score: 5000 },
    category: 'Getting Started'
  },
  {
    name: 'Century Club',
    description: 'Score 100,000 points or more',
    type: 'score_milestone',
    icon: '💯',
    color: '#FFD700',
    points: 75,
    criteria: { min_score: 100000 },
    category: 'Score Milestones'
  },
  {
    name: 'Speed Runner',
    description: 'Submit 15 scores within 3 hours',
    type: 'speed_demon',
    icon: '⚡',
    color: '#FF6B6B',
    points: 100,
    criteria: { scores_in_timeframe: 15, timeframe_hours: 3 },
    category: 'Speed & Activity'
  },
  {
    name: 'Dedicated Player',
    description: 'Submit scores for 14 days straight',
    type: 'streak_master',
    icon: '🔥',
    color: '#FF6B6B',
    points: 125,
    criteria: { consecutive_days: 14 },
    category: 'Consistency'
  },
  {
    name: 'Game Explorer',
    description: 'Play 15 different games',
    type: 'game_master',
    icon: '🗺️',
    color: '#45B7D1',
    points: 100,
    criteria: { game_count: 15 },
    category: 'Exploration'
  },
  {
    name: 'Champion',
    description: 'Take first place on any leaderboard',
    type: 'first_place',
    icon: '🏆',
    color: '#FFD700',
    points: 200,
    criteria: { max_rank: 1 },
    category: 'Competition'
  },
  {
    name: 'Perfectionist',
    description: 'Score exactly 500,000 points',
    type: 'perfectionist',
    icon: '💎',
    color: '#BB8FCE',
    points: 250,
    criteria: { exact_score: 500000 },
    category: 'Precision'
  },
  {
    name: 'Score Veteran',
    description: 'Submit 50 scores total',
    type: 'consistent_player',
    icon: '👥',
    color: '#96CEB4',
    points: 75,
    criteria: { min_scores: 50 },
    category: 'Community'
  }
];

const getDefaultCriteriaForType = (type: string): any => {
  switch (type) {
    case 'score_milestone': return { min_score: 25000 };
    case 'game_master': return { game_count: 8 };
    case 'consistent_player': return { min_scores: 20 };
    case 'perfectionist': return { exact_score: 100000 };
    case 'streak_master': return { consecutive_days: 5 };
    case 'speed_demon': return { scores_in_timeframe: 8, timeframe_hours: 2 };
    case 'first_place': return { max_rank: 1 };
    case 'first_score': return { is_first_score: true };
    default: return {};
  }
};

const getDifficultyLabel = (points: number): string => {
  if (points <= 25) return 'Easy';
  if (points <= 75) return 'Medium';
  if (points <= 150) return 'Hard';
  return 'Expert';
};

const getCriteriaDescription = (achievement: SuggestedAchievement): string => {
  // Handle advanced criteria
  if (achievement.advanced_criteria) {
    const { operator, conditions } = achievement.advanced_criteria;
    const conditionDescriptions = conditions.map(cond => {
      switch (cond.type) {
        case 'score_milestone':
          return `score ≥ ${cond.criteria.min_score?.toLocaleString() || 'X'}`;
        case 'game_master':
          return `${cond.criteria.game_count || 'X'} different games`;
        case 'consistent_player':
          return `≥ ${cond.criteria.min_scores || 'X'} total scores`;
        case 'perfectionist':
          return `score = ${cond.criteria.exact_score?.toLocaleString() || 'X'}`;
        case 'streak_master':
          return `${cond.criteria.consecutive_days || 'X'} consecutive days`;
        case 'speed_demon':
          return `${cond.criteria.scores_in_timeframe || 'X'} scores in ${cond.criteria.timeframe_hours || 'X'}h`;
        case 'first_place':
          return 'achieve 1st place';
        case 'first_score':
          return 'be first to score';
        default:
          return 'custom criteria';
      }
    });

    const joined = conditionDescriptions.join(` ${operator.toLowerCase()} `);
    return `${operator === 'AND' ? 'ALL' : 'ANY'} of: ${joined}`;
  }

  // Handle simple criteria
  switch (achievement.type) {
    case 'score_milestone':
      return `Score at least ${achievement.criteria.min_score?.toLocaleString() || 'X'} points in any game`;
    case 'game_master':
      return `Submit scores to ${achievement.criteria.game_count || 'X'} different games`;
    case 'consistent_player':
      return `Submit at least ${achievement.criteria.min_scores || 'X'} scores total`;
    case 'perfectionist':
      return `Score exactly ${achievement.criteria.exact_score?.toLocaleString() || 'X'} points`;
    case 'streak_master':
      return `Submit scores on ${achievement.criteria.consecutive_days || 'X'} consecutive days`;
    case 'speed_demon':
      return `Submit ${achievement.criteria.scores_in_timeframe || 'X'} scores within ${achievement.criteria.timeframe_hours || 'X'} hour(s)`;
    case 'first_place':
      return 'Achieve first place on any leaderboard';
    case 'first_score':
      return 'Be the first to submit a score to any game';
    default:
      return 'Custom achievement criteria';
  }
};

const generateAchievementSuggestion = (
  existingAchievements: any[],
  games: any[]
): SuggestedAchievement => {
  const random = Math.random;

  // Get random type that's not overused
  const typeUsage = existingAchievements.reduce((acc, ach) => {
    acc[ach.type] = (acc[ach.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const availableTypes = achievementTypes.filter(type =>
    (typeUsage[type] || 0) < 3 // Limit each type to 3 achievements
  );

  const type = availableTypes[Math.floor(random() * availableTypes.length)] ||
                achievementTypes[Math.floor(random() * achievementTypes.length)];

  const icon = icons[Math.floor(random() * icons.length)];
  const color = colors[Math.floor(random() * colors.length)];

  // Generate different suggestions based on type
  switch (type) {
    case 'score_milestone':
      const milestones = [10000, 25000, 50000, 100000, 250000, 500000];
      const milestone = milestones[Math.floor(random() * milestones.length)];
      return {
        name: `${milestone.toLocaleString()} Club`,
        description: `Score ${milestone.toLocaleString()} or more points in any game`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: { min_score: milestone },
        points: Math.max(50, Math.floor(milestone / 3000)),
        reasoning: `Milestone achievements motivate players to reach specific score targets and provide clear progression goals.`
      };

    case 'game_master':
      const gameCounts = [5, 8, 12, 15, 20];
      const gameCount = gameCounts[Math.floor(random() * gameCounts.length)];
      return {
        name: `${gameCount}-Game Explorer`,
        description: `Submit scores to ${gameCount} different games`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: { game_count: gameCount },
        points: gameCount * 8,
        reasoning: `Encourages players to explore different games rather than focusing on just one.`
      };

    case 'consistent_player':
      const scoreCounts = [10, 25, 50, 75, 100];
      const scoreCount = scoreCounts[Math.floor(random() * scoreCounts.length)];
      return {
        name: `${scoreCount}-Score Veteran`,
        description: `Submit ${scoreCount} scores total`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: { min_scores: scoreCount },
        points: scoreCount * 2,
        reasoning: `Rewards consistent engagement and regular play across the tournament.`
      };

    case 'perfectionist':
      const perfectScores = [100000, 250000, 500000, 1000000];
      const perfectScore = perfectScores[Math.floor(random() * perfectScores.length)];
      return {
        name: `${perfectScore.toLocaleString()} Perfect`,
        description: `Score exactly ${perfectScore.toLocaleString()} points`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: { exact_score: perfectScore },
        points: 150,
        reasoning: `Fun challenge achievement that requires precision and skill to hit exact scores.`
      };

    case 'streak_master':
      const streaks = [3, 5, 7, 10];
      const streak = streaks[Math.floor(random() * streaks.length)];
      return {
        name: `${streak}-Day Streak`,
        description: `Submit scores on ${streak} consecutive days`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: { consecutive_days: streak },
        points: streak * 20,
        reasoning: `Encourages regular daily engagement and builds playing habits.`
      };

    case 'first_place':
      return {
        name: `Champion Status`,
        description: `Achieve first place on any leaderboard`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: { max_rank: 1 },
        points: 200,
        reasoning: `Recognizes competitive excellence and motivates players to achieve top scores.`
      };

    case 'speed_demon':
      return {
        name: `Lightning Fast`,
        description: `Submit 5 scores within 1 hour`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: { scores_in_timeframe: 5, timeframe_hours: 1 },
        points: 100,
        reasoning: `Rewards intense gaming sessions and rapid-fire play.`
      };

    default:
      return {
        name: `Special Achievement`,
        description: `Complete a unique challenge`,
        type,
        badge_icon: icon,
        badge_color: color,
        criteria: {},
        points: 50,
        reasoning: `A flexible achievement that can be customized for special events or challenges.`
      };
  }
};

export const SuggestAchievementDialog: React.FC<SuggestAchievementDialogProps> = ({
  onAchievementAdded
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [achievement, setAchievement] = useState<EditableAchievement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'templates' | 'bulk'>('ai');
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(new Set());
  const [bulkAchievements, setBulkAchievements] = useState<EditableAchievement[]>([]);
  const [showAdvancedCriteria, setShowAdvancedCriteria] = useState(false);
  const { toast } = useToast();
  const { currentTournament } = useTournament();

  const generateSuggestion = async () => {
    if (!currentTournament) return;

    setIsGenerating(true);

    try {
      // Fetch existing achievements and games to inform the suggestion
      let existingAchievements = [];
      let games = [];

      // Fallback to direct queries if API routes don't exist
      try {
        const { api } = await import("@/lib/api-client");

        const [achResult, gamesResult] = await Promise.all([
          api
            .from('achievements')
            .select('*')
            .eq('tournament_id', currentTournament.id)
            .eq('is_active', true),
          api
            .from('games')
            .select('id, name')
            .eq('tournament_id', currentTournament.id)
            .eq('is_active', true)
        ]);

        existingAchievements = achResult.data || [];
        games = gamesResult.data || [];
      } catch (error) {
        console.warn('Could not fetch data for suggestion:', error);
      }

      const newSuggestion = generateAchievementSuggestion(existingAchievements, games);
      setAchievement({ ...newSuggestion, isEditing: false });

    } catch (error) {
      console.error('Error generating suggestion:', error);
      toast({
        title: "Error",
        description: "Failed to generate achievement suggestion",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const addAchievement = async () => {
    if (!achievement || !currentTournament) return;

    setIsAdding(true);

    try {
      const { api } = await import("@/lib/api-client");

      const { error } = await api
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
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Achievement "${achievement.name}" has been added to the tournament.`
      });

      setIsOpen(false);
      setAchievement(null);
      onAchievementAdded();

    } catch (error: any) {
      console.error('Error adding achievement:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add achievement",
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  const updateAchievement = (field: keyof SuggestedAchievement, value: any) => {
    if (!achievement) return;
    setAchievement({ ...achievement, [field]: value });
  };

  const toggleEditMode = () => {
    if (!achievement) return;
    setAchievement({ ...achievement, isEditing: !achievement.isEditing });
  };

  const loadTemplate = (template: any) => {
    setAchievement({
      ...template,
      isEditing: true,
      reasoning: `Template: ${template.category} - ${template.reasoning || 'Ready-made achievement template'}`
    });
    setActiveTab('ai'); // Switch to editor tab
  };

  const cloneAchievement = (source: any) => {
    const cloned = {
      name: `${source.name} (Copy)`,
      description: source.description,
      type: source.type,
      badge_icon: source.icon || source.badge_icon,
      badge_color: source.color || source.badge_color,
      criteria: { ...source.criteria },
      points: source.points,
      reasoning: `Cloned from: ${source.name} - Customize this achievement for your needs.`,
      isEditing: true
    };
    setAchievement(cloned);
    setActiveTab('ai');
  };

  const toggleTemplateSelection = (index: number) => {
    const newSelected = new Set(selectedTemplates);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTemplates(newSelected);
  };

  const addSelectedToBulk = () => {
    const selectedAchievements = Array.from(selectedTemplates).map(index => ({
      ...achievementTemplates[index],
      badge_icon: achievementTemplates[index].icon,
      badge_color: achievementTemplates[index].color,
      isEditing: false,
      reasoning: `Bulk created from template: ${achievementTemplates[index].category}`
    }));
    setBulkAchievements(selectedAchievements);
    setActiveTab('bulk');
    setSelectedTemplates(new Set());
  };

  const updateBulkAchievement = (index: number, field: keyof SuggestedAchievement, value: any) => {
    const updated = [...bulkAchievements];
    updated[index] = { ...updated[index], [field]: value };
    setBulkAchievements(updated);
  };

  const removeFromBulk = (index: number) => {
    setBulkAchievements(bulkAchievements.filter((_, i) => i !== index));
  };

  const addAdvancedCondition = () => {
    if (!achievement) return;

    const newCondition: AchievementCondition = {
      type: 'score_milestone',
      criteria: { min_score: 10000 },
      description: 'Score at least 10,000 points'
    };

    const advanced = achievement.advanced_criteria || {
      operator: 'AND' as const,
      conditions: []
    };

    advanced.conditions.push(newCondition);

    updateAchievement('advanced_criteria', advanced);
  };

  const updateAdvancedCondition = (index: number, field: keyof AchievementCondition, value: any) => {
    if (!achievement?.advanced_criteria) return;

    const updated = { ...achievement.advanced_criteria };
    updated.conditions[index] = { ...updated.conditions[index], [field]: value };

    // Update criteria based on type
    if (field === 'type') {
      const defaultCriteria = getDefaultCriteriaForType(value);
      updated.conditions[index].criteria = defaultCriteria;
      updated.conditions[index].description = getCriteriaDescription({
        type: value,
        criteria: defaultCriteria
      } as any);
    }

    updateAchievement('advanced_criteria', updated);
  };

  const removeAdvancedCondition = (index: number) => {
    if (!achievement?.advanced_criteria) return;

    const updated = { ...achievement.advanced_criteria };
    updated.conditions.splice(index, 1);

    if (updated.conditions.length === 0) {
      updateAchievement('advanced_criteria', undefined);
    } else {
      updateAchievement('advanced_criteria', updated);
    }
  };

  const updateAdvancedOperator = (operator: 'AND' | 'OR') => {
    if (!achievement?.advanced_criteria) return;

    updateAchievement('advanced_criteria', {
      ...achievement.advanced_criteria,
      operator
    });
  };

  const createAllBulkAchievements = async () => {
    if (!currentTournament || bulkAchievements.length === 0) return;

    setIsAdding(true);
    let successCount = 0;

    try {
      const { api } = await import("@/lib/api-client");

      for (const achievement of bulkAchievements) {
        try {
          const { error } = await api
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
              is_active: true
            });

          if (!error) {
            successCount++;
          }
        } catch (error) {
          console.error('Error creating achievement:', achievement.name, error);
        }
      }

      toast({
        title: "Bulk Creation Complete!",
        description: `Successfully created ${successCount} out of ${bulkAchievements.length} achievements.`
      });

      setIsOpen(false);
      setBulkAchievements([]);
      onAchievementAdded();

    } catch (error: any) {
      console.error('Error in bulk creation:', error);
      toast({
        title: "Error",
        description: "Failed to create achievements",
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !achievement) {
      generateSuggestion();
    }
  };

  // Helper function to render criteria editor based on type
  const renderCriteriaEditor = () => {
    if (!achievement) return null;

    switch (achievement.type) {
      case 'score_milestone':
        return (
          <div className="space-y-2">
            <Label htmlFor="min_score">Minimum Score Required</Label>
            <Input
              id="min_score"
              type="number"
              value={achievement.criteria.min_score || ''}
              onChange={(e) => updateAchievement('criteria', { ...achievement.criteria, min_score: parseInt(e.target.value) || 0 })}
              placeholder="e.g., 50000"
              disabled={!achievement.isEditing}
            />
          </div>
        );

      case 'game_master':
        return (
          <div className="space-y-2">
            <Label htmlFor="game_count">Number of Different Games</Label>
            <Input
              id="game_count"
              type="number"
              value={achievement.criteria.game_count || ''}
              onChange={(e) => updateAchievement('criteria', { ...achievement.criteria, game_count: parseInt(e.target.value) || 0 })}
              placeholder="e.g., 10"
              disabled={!achievement.isEditing}
            />
          </div>
        );

      case 'consistent_player':
        return (
          <div className="space-y-2">
            <Label htmlFor="min_scores">Minimum Number of Scores</Label>
            <Input
              id="min_scores"
              type="number"
              value={achievement.criteria.min_scores || ''}
              onChange={(e) => updateAchievement('criteria', { ...achievement.criteria, min_scores: parseInt(e.target.value) || 0 })}
              placeholder="e.g., 25"
              disabled={!achievement.isEditing}
            />
          </div>
        );

      case 'perfectionist':
        return (
          <div className="space-y-2">
            <Label htmlFor="exact_score">Exact Score Required</Label>
            <Input
              id="exact_score"
              type="number"
              value={achievement.criteria.exact_score || ''}
              onChange={(e) => updateAchievement('criteria', { ...achievement.criteria, exact_score: parseInt(e.target.value) || 0 })}
              placeholder="e.g., 100000"
              disabled={!achievement.isEditing}
            />
          </div>
        );

      case 'streak_master':
        return (
          <div className="space-y-2">
            <Label htmlFor="consecutive_days">Consecutive Days</Label>
            <Input
              id="consecutive_days"
              type="number"
              value={achievement.criteria.consecutive_days || ''}
              onChange={(e) => updateAchievement('criteria', { ...achievement.criteria, consecutive_days: parseInt(e.target.value) || 0 })}
              placeholder="e.g., 7"
              disabled={!achievement.isEditing}
            />
          </div>
        );

      case 'speed_demon':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scores_in_timeframe">Number of Scores</Label>
              <Input
                id="scores_in_timeframe"
                type="number"
                value={achievement.criteria.scores_in_timeframe || ''}
                onChange={(e) => updateAchievement('criteria', { ...achievement.criteria, scores_in_timeframe: parseInt(e.target.value) || 0 })}
                placeholder="e.g., 5"
                disabled={!achievement.isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeframe_hours">Within Hours</Label>
              <Input
                id="timeframe_hours"
                type="number"
                value={achievement.criteria.timeframe_hours || ''}
                onChange={(e) => updateAchievement('criteria', { ...achievement.criteria, timeframe_hours: parseInt(e.target.value) || 0 })}
                placeholder="e.g., 1"
                disabled={!achievement.isEditing}
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            <Label>Custom Criteria (JSON)</Label>
            <Textarea
              value={JSON.stringify(achievement.criteria, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateAchievement('criteria', parsed);
                } catch (error) {
                  // Invalid JSON, keep current value
                }
              }}
              placeholder='{"custom": "criteria"}'
              disabled={!achievement.isEditing}
              className="font-mono text-xs"
            />
          </div>
        );
    }
  };

  const renderAdvancedCriteriaEditor = (condition: AchievementCondition, conditionIndex: number) => {
    switch (condition.type) {
      case 'score_milestone':
        return (
          <div className="space-y-1">
            <Label className="text-xs">Minimum Score</Label>
            <Input
              type="number"
              value={condition.criteria.min_score || ''}
              onChange={(e) => updateAdvancedCondition(conditionIndex, 'criteria', {
                ...condition.criteria,
                min_score: parseInt(e.target.value) || 0
              })}
              placeholder="e.g., 50000"
              className="h-7 text-xs"
            />
          </div>
        );

      case 'game_master':
        return (
          <div className="space-y-1">
            <Label className="text-xs">Number of Games</Label>
            <Input
              type="number"
              value={condition.criteria.game_count || ''}
              onChange={(e) => updateAdvancedCondition(conditionIndex, 'criteria', {
                ...condition.criteria,
                game_count: parseInt(e.target.value) || 0
              })}
              placeholder="e.g., 10"
              className="h-7 text-xs"
            />
          </div>
        );

      case 'consistent_player':
        return (
          <div className="space-y-1">
            <Label className="text-xs">Minimum Scores</Label>
            <Input
              type="number"
              value={condition.criteria.min_scores || ''}
              onChange={(e) => updateAdvancedCondition(conditionIndex, 'criteria', {
                ...condition.criteria,
                min_scores: parseInt(e.target.value) || 0
              })}
              placeholder="e.g., 25"
              className="h-7 text-xs"
            />
          </div>
        );

      case 'perfectionist':
        return (
          <div className="space-y-1">
            <Label className="text-xs">Exact Score</Label>
            <Input
              type="number"
              value={condition.criteria.exact_score || ''}
              onChange={(e) => updateAdvancedCondition(conditionIndex, 'criteria', {
                ...condition.criteria,
                exact_score: parseInt(e.target.value) || 0
              })}
              placeholder="e.g., 100000"
              className="h-7 text-xs"
            />
          </div>
        );

      case 'streak_master':
        return (
          <div className="space-y-1">
            <Label className="text-xs">Consecutive Days</Label>
            <Input
              type="number"
              value={condition.criteria.consecutive_days || ''}
              onChange={(e) => updateAdvancedCondition(conditionIndex, 'criteria', {
                ...condition.criteria,
                consecutive_days: parseInt(e.target.value) || 0
              })}
              placeholder="e.g., 7"
              className="h-7 text-xs"
            />
          </div>
        );

      case 'speed_demon':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Scores</Label>
              <Input
                type="number"
                value={condition.criteria.scores_in_timeframe || ''}
                onChange={(e) => updateAdvancedCondition(conditionIndex, 'criteria', {
                  ...condition.criteria,
                  scores_in_timeframe: parseInt(e.target.value) || 0
                })}
                placeholder="5"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hours</Label>
              <Input
                type="number"
                value={condition.criteria.timeframe_hours || ''}
                onChange={(e) => updateAdvancedCondition(conditionIndex, 'criteria', {
                  ...condition.criteria,
                  timeframe_hours: parseInt(e.target.value) || 0
                })}
                placeholder="1"
                className="h-7 text-xs"
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-1">
            <Label className="text-xs">Custom Criteria</Label>
            <Textarea
              value={JSON.stringify(condition.criteria, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateAdvancedCondition(conditionIndex, 'criteria', parsed);
                } catch (error) {
                  // Invalid JSON, keep current value
                }
              }}
              placeholder='{"custom": "criteria"}'
              className="font-mono text-xs h-16"
            />
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="ml-2">
          <Sparkles className="w-4 h-4 mr-2" />
          AI Achievement Creator
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="w-5 h-5 mr-2" />
            AI Achievement Creator
          </DialogTitle>
          <DialogDescription>
            Create custom achievements with AI suggestions. Edit everything to fit your tournament perfectly!
          </DialogDescription>
        </DialogHeader>

        {/* Mode Tabs */}
        <div className="flex border-b border-border mb-6">
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2 font-medium text-sm transition-colors flex items-center ${
              activeTab === 'ai'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            AI Suggestions
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 font-medium text-sm transition-colors flex items-center ${
              activeTab === 'templates'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Templates
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`px-4 py-2 font-medium text-sm transition-colors flex items-center ${
              activeTab === 'bulk'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Zap className="w-4 h-4 mr-2" />
            Bulk Create
          </button>
        </div>

        {activeTab === 'templates' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievementTemplates.map((template, index) => (
                <Card
                  key={index}
                  className={`group cursor-pointer transition-all duration-200 hover:scale-105 ${
                    selectedTemplates.has(index)
                      ? 'ring-2 ring-primary shadow-lg bg-primary/5'
                      : 'hover:shadow-lg'
                  }`}
                  onClick={() => toggleTemplateSelection(index)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={selectedTemplates.has(index)}
                          onChange={() => toggleTemplateSelection(index)}
                          className="w-4 h-4 mt-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: template.color }}
                      >
                        {template.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate mb-1">{template.name}</h4>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{template.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs bg-muted px-2 py-1 rounded-full">
                            {template.category}
                          </span>
                          <span className="text-xs font-medium text-primary">
                            {template.points} pts
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          loadTemplate(template);
                        }}
                      >
                        <Edit3 className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          cloneAchievement(template);
                        }}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Clone
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="text-center text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="font-medium mb-1">Choose Templates</p>
              <p>Select multiple templates to create them all at once, or click individual templates to edit them.</p>
              {selectedTemplates.size > 0 && (
                <div className="mt-4">
                  <p className="text-primary font-medium mb-2">
                    {selectedTemplates.size} template{selectedTemplates.size > 1 ? 's' : ''} selected
                  </p>
                  <Button onClick={addSelectedToBulk} size="sm">
                    <Zap className="w-4 h-4 mr-2" />
                    Create All Selected ({selectedTemplates.size})
                  </Button>
                </div>
              )}
            </div>
        ) : activeTab === 'bulk' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Bulk Achievement Creation</h3>
                <p className="text-sm text-muted-foreground">
                  Create multiple achievements at once. Customize each one before creating.
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                {bulkAchievements.length} achievement{bulkAchievements.length !== 1 ? 's' : ''} ready
              </div>
            </div>

            {bulkAchievements.length === 0 ? (
              <div className="text-center py-12 bg-muted/30 rounded-lg">
                <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  No achievements selected for bulk creation.
                </p>
                <Button onClick={() => setActiveTab('templates')} variant="outline">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Go to Templates
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {bulkAchievements.map((achievement, index) => (
                  <Card key={index} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-4">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                          style={{ backgroundColor: achievement.badge_color }}
                        >
                          {achievement.badge_icon}
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <Input
                              value={achievement.name}
                              onChange={(e) => updateBulkAchievement(index, 'name', e.target.value)}
                              placeholder="Achievement name"
                              className="text-sm"
                            />
                            <div className="flex space-x-2">
                              <Input
                                type="number"
                                value={achievement.points}
                                onChange={(e) => updateBulkAchievement(index, 'points', parseInt(e.target.value) || 0)}
                                placeholder="Points"
                                className="text-sm flex-1"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeFromBulk(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                          <Textarea
                            value={achievement.description}
                            onChange={(e) => updateBulkAchievement(index, 'description', e.target.value)}
                            placeholder="Achievement description"
                            rows={2}
                            className="text-sm"
                          />
                          <div className="text-xs text-muted-foreground">
                            Type: {achievement.type.replace('_', ' ')} • Criteria: {getCriteriaDescription(achievement)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setBulkAchievements([])}
                  >
                    Clear All
                  </Button>
                  <Button
                    onClick={createAllBulkAchievements}
                    disabled={isAdding || bulkAchievements.length === 0}
                    className="min-w-[140px]"
                  >
                    {isAdding ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Create All ({bulkAchievements.length})
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor Panel */}
            <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Edit3 className="w-4 h-4 mr-2" />
                    Achievement Editor
                  </span>
                  {achievement && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleEditMode}
                    >
                      {achievement.isEditing ? <Eye className="w-4 h-4 mr-1" /> : <Edit3 className="w-4 h-4 mr-1" />}
                      {achievement.isEditing ? 'Preview' : 'Edit'}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isGenerating ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                    <span>Generating smart suggestion...</span>
                  </div>
                ) : achievement ? (
                  <div className="space-y-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Achievement Name</Label>
                        <Input
                          id="name"
                          value={achievement.name}
                          onChange={(e) => updateAchievement('name', e.target.value)}
                          disabled={!achievement.isEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="points">Points Value</Label>
                        <Input
                          id="points"
                          type="number"
                          value={achievement.points}
                          onChange={(e) => updateAchievement('points', parseInt(e.target.value) || 0)}
                          disabled={!achievement.isEditing}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={achievement.description}
                        onChange={(e) => updateAchievement('description', e.target.value)}
                        disabled={!achievement.isEditing}
                        rows={2}
                      />
                    </div>

                    {/* Visual Customization */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="icon">Icon</Label>
                        <Select
                          value={achievement.badge_icon}
                          onValueChange={(value) => updateAchievement('badge_icon', value)}
                          disabled={!achievement.isEditing}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {icons.map((icon) => (
                              <SelectItem key={icon} value={icon}>
                                <span className="text-lg mr-2">{icon}</span>
                                {icon}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="color">Badge Color</Label>
                        <Select
                          value={achievement.badge_color}
                          onValueChange={(value) => updateAchievement('badge_color', value)}
                          disabled={!achievement.isEditing}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {colors.map((color) => (
                              <SelectItem key={color} value={color}>
                                <div className="flex items-center">
                                  <div
                                    className="w-4 h-4 rounded mr-2 border"
                                    style={{ backgroundColor: color }}
                                  />
                                  {color}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Achievement Type */}
                    <div className="space-y-2">
                      <Label htmlFor="type">Achievement Type</Label>
                      <Select
                        value={achievement.type}
                        onValueChange={(value) => {
                          // Reset criteria when type changes
                          const defaultCriteria = getDefaultCriteriaForType(value);
                          updateAchievement('type', value);
                          updateAchievement('criteria', defaultCriteria);
                        }}
                        disabled={!achievement.isEditing}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {achievementTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Criteria Editor */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Criteria Settings</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAdvancedCriteria(!showAdvancedCriteria)}
                          className="text-xs"
                        >
                          {showAdvancedCriteria ? 'Simple' : 'Advanced'} Mode
                        </Button>
                      </div>

                      {!showAdvancedCriteria ? (
                        renderCriteriaEditor()
                      ) : (
                        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                          <div className="flex items-center space-x-4">
                            <Label className="text-sm">Logic:</Label>
                            <Select
                              value={achievement.advanced_criteria?.operator || 'AND'}
                              onValueChange={(value: 'AND' | 'OR') => updateAdvancedOperator(value)}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AND">ALL of</SelectItem>
                                <SelectItem value="OR">ANY of</SelectItem>
                              </SelectContent>
                            </Select>
                            <span className="text-sm text-muted-foreground">
                              the following conditions must be met:
                            </span>
                          </div>

                          <div className="space-y-3">
                            {achievement.advanced_criteria?.conditions.map((condition, index) => (
                              <Card key={index} className="p-3">
                                <div className="flex items-start space-x-3">
                                  <div className="flex-1 space-y-2">
                                    <Select
                                      value={condition.type}
                                      onValueChange={(value) => updateAdvancedCondition(index, 'type', value)}
                                    >
                                      <SelectTrigger className="text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {achievementTypes.map((type) => (
                                          <SelectItem key={type} value={type}>
                                            {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    <div className="text-xs text-muted-foreground pl-2 border-l-2 border-muted">
                                      {renderAdvancedCriteriaEditor(condition, index)}
                                    </div>
                                  </div>

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeAdvancedCondition(index)}
                                    className="text-red-500 hover:text-red-700 flex-shrink-0"
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </Card>
                            )) || (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No conditions added yet. Click "Add Condition" to get started.
                              </p>
                            )}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addAdvancedCondition}
                            className="w-full"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Condition
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={generateSuggestion}
                        disabled={isGenerating}
                        className="flex-1"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        New Suggestion
                      </Button>
                      <Button
                        onClick={addAchievement}
                        disabled={isAdding || !achievement.name.trim() || !achievement.description.trim()}
                        className="flex-1"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {isAdding ? 'Creating...' : 'Create Achievement'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">
                      Ready to create an amazing achievement?
                    </p>
                    <Button onClick={generateSuggestion} disabled={isGenerating}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate First Suggestion
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="w-4 h-4 mr-2" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {achievement ? (
                  <div className="space-y-4">
                    {/* Achievement Badge Preview */}
                    <div className="flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg">
                      <div className="text-center">
                        <div
                          className="inline-flex items-center justify-center w-16 h-16 rounded-full text-3xl mb-3 shadow-lg"
                          style={{ backgroundColor: achievement.badge_color }}
                        >
                          {achievement.badge_icon}
                        </div>
                        <h3 className="text-lg font-bold mb-1">{achievement.name}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{achievement.description}</p>
                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                          {achievement.points} points
                        </div>
                      </div>
                    </div>

                    {/* Achievement Details */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-muted-foreground">Type:</span>
                          <p className="capitalize">{achievement.type.replace('_', ' ')}</p>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">Difficulty:</span>
                          <p>{getDifficultyLabel(achievement.points)}</p>
                        </div>
                      </div>

                      <div>
                        <span className="font-medium text-muted-foreground text-sm">Criteria:</span>
                        <p className="text-sm mt-1">{getCriteriaDescription(achievement)}</p>
                      </div>

                      {achievement.reasoning && (
                        <div className="bg-blue-50 dark:bg-blue-950/50 p-3 rounded-lg">
                          <span className="font-medium text-blue-800 dark:text-blue-200 text-sm">AI Suggestion:</span>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">{achievement.reasoning}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <div className="text-center">
                      <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Preview will appear here</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
};