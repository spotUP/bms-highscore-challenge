import React from 'react';
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface PlayerAchievementsTableProps {
  playerAchievements: any[];
  onDelete: (id: string) => void;
}

export const PlayerAchievementsTable = ({
  playerAchievements,
  onDelete
}: PlayerAchievementsTableProps) => {
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
    <div className="border rounded-md overflow-x-auto">
      {/* Header */}
      <div className="grid grid-cols-4 gap-4 p-3 border-b bg-muted/50 font-medium text-sm min-w-[600px]">
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
          className={`grid grid-cols-4 gap-4 p-3 transition-all duration-300 ease-in-out overflow-hidden min-w-[600px] ${
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