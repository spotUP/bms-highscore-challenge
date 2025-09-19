import React from 'react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2 } from "lucide-react";

interface AchievementsTableProps {
  achievements: any[];
  onEdit: (achievement: any) => void;
  onDelete: (achievement: any) => void;
  onToggleStatus: (achievement: any) => void;
  getTypeIcon: (type: string) => string;
  getCriteriaDisplay: (criteria: any, type: string) => string;
  isTournamentCreator: boolean;
  currentUserId: string | null;
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

export const AchievementsTable = ({
  achievements,
  onEdit,
  onDelete,
  onToggleStatus,
  getTypeIcon,
  getCriteriaDisplay,
  isTournamentCreator,
  currentUserId
}: AchievementsTableProps) => {
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
    <div className="border rounded-md overflow-x-auto">
      {/* Header */}
      <div className={`grid ${isTournamentCreator ? 'grid-cols-10' : 'grid-cols-9'} gap-2 p-3 border-b bg-muted/50 font-medium text-sm min-w-[800px]`}>
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
          className={`grid ${isTournamentCreator ? 'grid-cols-10' : 'grid-cols-9'} gap-2 p-3 transition-all duration-300 ease-in-out overflow-hidden min-w-[800px] ${
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