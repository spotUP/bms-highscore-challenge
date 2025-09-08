import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAchievement } from '@/contexts/AchievementContext';

interface Achievement {
  id: string;
  name: string;
  description: string;
  badge_icon: string;
  badge_color: string;
  points: number;
}

export const useAchievements = () => {
  const { showAchievementNotification } = useAchievement();

  const checkForNewAchievements = useCallback(async (playerName: string) => {
    try {
      // Get recently unlocked achievements for this player (last 30 seconds)
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      
      const { data: newAchievements, error } = await supabase
        .from('player_achievements')
        .select(`
          *,
          achievements (*)
        `)
        .eq('player_name', playerName.toUpperCase())
        .gte('unlocked_at', thirtySecondsAgo)
        .order('unlocked_at', { ascending: false });

      if (error) {
        console.error('Error checking for new achievements:', error);
        return;
      }

      // Show notification and send webhook for each new achievement
      if (newAchievements && newAchievements.length > 0) {
        newAchievements.forEach((playerAchievement) => {
          const achievement = playerAchievement.achievements as Achievement;
          if (achievement) {
            // Add a small delay between notifications if multiple achievements
            setTimeout(() => {
              showAchievementNotification(achievement);
              
              // Send webhook for achievement unlock
              sendAchievementWebhook(playerName, achievement, playerAchievement);
            }, newAchievements.indexOf(playerAchievement) * 1000);
          }
        });
      }
    } catch (error) {
      console.error('Error in checkForNewAchievements:', error);
    }
  }, [showAchievementNotification]);

  const sendAchievementWebhook = useCallback(async (
    playerName: string, 
    achievement: Achievement, 
    playerAchievement: any
  ) => {
    try {
      console.log('🚀 Sending achievement webhook:', {
        player_name: playerName,
        achievement: achievement.name,
        points: achievement.points
      });

      const webhookResponse = await supabase.functions.invoke('send-achievement-webhook', {
        body: {
          player_name: playerName,
          achievement: {
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
            badge_icon: achievement.badge_icon,
            badge_color: achievement.badge_color,
            points: achievement.points
          },
          game_name: playerAchievement.game_id ? await getGameName(playerAchievement.game_id) : undefined,
          score: playerAchievement.score,
          timestamp: playerAchievement.unlocked_at
        }
      });

      if (webhookResponse.error) {
        console.error('❌ Achievement webhook error:', webhookResponse.error);
      } else {
        console.log('✅ Achievement webhook sent successfully:', webhookResponse.data);
      }
    } catch (error) {
      console.error('❌ Achievement webhook call failed:', error);
    }
  }, []);

  const getGameName = useCallback(async (gameId: string): Promise<string | undefined> => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('name')
        .eq('id', gameId)
        .single();
      
      if (error) throw error;
      return data?.name;
    } catch (error) {
      console.error('Error fetching game name:', error);
      return undefined;
    }
  }, []);

  return {
    checkForNewAchievements
  };
};
