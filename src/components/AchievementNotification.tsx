import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import AchievementBadge from './AchievementBadge';

interface AchievementNotificationProps {
  achievement: {
    id: string;
    name: string;
    description: string;
    badge_icon: string;
    badge_color: string;
    points: number;
  };
  onClose: () => void;
  autoClose?: boolean;
  duration?: number;
}

const AchievementNotification: React.FC<AchievementNotificationProps> = ({
  achievement,
  onClose,
  autoClose = true,
  duration = 5000
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 100);
    
    // Auto close
    if (autoClose) {
      const closeTimer = setTimeout(() => {
        handleClose();
      }, duration);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(closeTimer);
      };
    }
    
    return () => clearTimeout(timer);
  }, [autoClose, duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div
      className={`
        fixed top-4 right-4 z-50 transform transition-all duration-300 ease-out
        ${isVisible && !isExiting 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95'
        }
      `}
    >
      <Card 
        className="bg-gradient-to-r from-yellow-900/90 to-yellow-800/90 border-yellow-500/50 backdrop-blur-sm shadow-2xl"
        style={{
          boxShadow: `0 0 30px ${achievement.badge_color}40, 0 0 60px ${achievement.badge_color}20`
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Achievement Badge */}
            <div className="relative">
              <AchievementBadge
                name={achievement.name}
                description={achievement.description}
                badgeIcon={achievement.badge_icon}
                badgeColor={achievement.badge_color}
                points={achievement.points}
                isUnlocked={true}
                size="lg"
                showTooltip={false}
              />
              {/* Sparkle effect */}
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
            </div>

            {/* Achievement Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-yellow-100 text-lg truncate">
                  Achievement Unlocked!
                </h3>
                <Badge 
                  variant="secondary" 
                  className="bg-yellow-600 text-yellow-100 text-xs"
                >
                  +{achievement.points} pts
                </Badge>
              </div>
              <h4 className="font-semibold text-white text-base mb-1">
                {achievement.name}
              </h4>
              <p className="text-yellow-200 text-sm">
                {achievement.description}
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="text-yellow-300 hover:text-white transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress bar for auto-close */}
          {autoClose && (
            <div className="mt-3 h-1 bg-yellow-900/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-yellow-400 rounded-full transition-all ease-linear"
                style={{
                  width: '100%',
                  animation: `shrink ${duration}ms linear forwards`
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default AchievementNotification;
