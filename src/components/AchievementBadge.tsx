import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AchievementBadgeProps {
  name: string;
  description: string;
  badgeIcon: string;
  badgeColor: string;
  points: number;
  unlockedAt?: string;
  isUnlocked?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const AchievementBadge: React.FC<AchievementBadgeProps> = React.memo(({
  name,
  description,
  badgeIcon,
  badgeColor,
  points,
  unlockedAt,
  isUnlocked = false,
  size = 'md',
  showTooltip = true
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-2xl'
  };

  const BadgeComponent = (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-full border-2 flex items-center justify-center
        transition-all duration-300 hover:scale-110
        ${isUnlocked 
          ? 'border-yellow-400 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 shadow-lg shadow-yellow-400/25' 
          : 'border-gray-600 bg-gray-800/50 opacity-50'
        }
      `}
      style={{
        backgroundColor: isUnlocked ? `${badgeColor}20` : undefined,
        borderColor: isUnlocked ? badgeColor : undefined,
        boxShadow: isUnlocked ? `0 0 20px ${badgeColor}40` : undefined
      }}
    >
      <span className="drop-shadow-lg">{badgeIcon}</span>
    </div>
  );

  if (!showTooltip) {
    return BadgeComponent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {BadgeComponent}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{badgeIcon}</span>
              <span className="font-bold text-white">{name}</span>
              <Badge variant="secondary" className="text-xs">
                {points} pts
              </Badge>
            </div>
            <p className="text-sm text-gray-300">{description}</p>
            {isUnlocked && unlockedAt && (
              <p className="text-xs text-gray-400">
                Unlocked: {new Date(unlockedAt).toLocaleDateString()}
              </p>
            )}
            {!isUnlocked && (
              <p className="text-xs text-gray-500 italic">Not unlocked yet</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

AchievementBadge.displayName = 'AchievementBadge';

export default AchievementBadge;
