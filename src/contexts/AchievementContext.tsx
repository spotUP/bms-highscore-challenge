import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
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
  const notificationQueue = useRef<Achievement[]>([]);
  const isProcessing = useRef(false);

  const processQueue = useCallback(() => {
    if (notificationQueue.current.length === 0 || isProcessing.current) {
      return;
    }

    isProcessing.current = true;
    const nextAchievement = notificationQueue.current.shift()!;
    setCurrentAchievement(nextAchievement);
    setIsNotificationVisible(true);
  }, []);

  const showAchievementNotification = useCallback((achievement: Achievement) => {
    // Add to queue
    notificationQueue.current.push(achievement);
    
    // If nothing is showing, process the queue
    if (!isProcessing.current) {
      processQueue();
    }
  }, [processQueue]);

  const hideAchievementNotification = useCallback(() => {
    setIsNotificationVisible(false);
    
    // After hiding, process the next notification in the queue
    setTimeout(() => {
      isProcessing.current = false;
      setCurrentAchievement(null);
      processQueue();
    }, 300); // Match this with the animation duration in AchievementNotification
  }, [processQueue]);

  return (
    <AchievementContext.Provider value={{
      showAchievementNotification,
      hideAchievementNotification
    }}>
      {children}
      
      {/* Achievement Notification */}
      {isNotificationVisible && currentAchievement && (
        <AchievementNotification
          key={currentAchievement.id + Date.now()} // Ensure re-render for each notification
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

