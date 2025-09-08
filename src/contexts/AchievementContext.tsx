import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import AchievementNotification from '@/components/AchievementNotification';

interface Achievement {
  id: string;
  name: string;
  description: string;
  badge_icon: string;
  badge_color: string;
  points: number;
}

interface AchievementContextType {
  showAchievementNotification: (achievement: Achievement) => void;
  hideAchievementNotification: () => void;
}

const AchievementContext = createContext<AchievementContextType | undefined>(undefined);

interface AchievementProviderProps {
  children: ReactNode;
}

export const AchievementProvider: React.FC<AchievementProviderProps> = ({ children }) => {
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);

  const showAchievementNotification = useCallback((achievement: Achievement) => {
    setCurrentAchievement(achievement);
    setIsNotificationVisible(true);
  }, []);

  const hideAchievementNotification = useCallback(() => {
    setIsNotificationVisible(false);
    setCurrentAchievement(null);
  }, []);

  return (
    <AchievementContext.Provider value={{
      showAchievementNotification,
      hideAchievementNotification
    }}>
      {children}
      
      {/* Achievement Notification */}
      {isNotificationVisible && currentAchievement && (
        <AchievementNotification
          achievement={currentAchievement}
          onClose={hideAchievementNotification}
        />
      )}
    </AchievementContext.Provider>
  );
};

export const useAchievement = () => {
  const context = useContext(AchievementContext);
  if (context === undefined) {
    throw new Error('useAchievement must be used within an AchievementProvider');
  }
  return context;
};

