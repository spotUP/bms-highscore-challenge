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
      console.log('🎯 Achievement system called for:', playerName);
      
      // Use a SQL query to safely check and retrieve new achievements
      // This avoids TypeScript type issues while the tables are being set up
      try {
        const { data: newAchievements, error } = await (supabase as any).rpc('get_recent_achievements', {
          p_player_name: playerName.toUpperCase(),
          p_since_minutes: 1 // Check for achievements in last minute
        });

        if (error) {
          console.log('⚠️ Achievement system not available:', error.message);
          return;
        }

        // Show notification and send webhook for each new achievement
        if (Array.isArray(newAchievements) && newAchievements.length > 0) {
          console.log(`🏆 Found ${newAchievements.length} new achievements for ${playerName}`);
          
          newAchievements.forEach((achievement: any, index: number) => {
            // Add a small delay between notifications if multiple achievements
            setTimeout(() => {
              showAchievementNotification({
                id: achievement.achievement_id,
                name: achievement.achievement_name,
                description: achievement.achievement_description,
                badge_icon: achievement.badge_icon,
                badge_color: achievement.badge_color,
                points: achievement.points
              });
              
              // Send webhook for achievement unlock
              sendAchievementWebhook(playerName, {
                id: achievement.achievement_id,
                name: achievement.achievement_name,
                description: achievement.achievement_description,
                badge_icon: achievement.badge_icon,
                badge_color: achievement.badge_color,
                points: achievement.points
              }, {
                unlocked_at: achievement.unlocked_at
              });
            }, index * 1000);
          });
        } else {
          console.log('📭 No new achievements found for', playerName);
        }
      } catch (error) {
        console.log('⚠️ Achievement RPC not available - set up achievement system first');
        console.log('📖 Run simple-achievement-setup.sql in your Supabase SQL Editor');
        console.log('🔧 Error details:', error);
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

      // Get the most recent score for this player to provide context
      const { data: recentScore } = await supabase
        .from('scores')
        .select(`
          score,
          game_id,
          games (name)
        `)
        .eq('player_name', playerName.toUpperCase())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const webhookResponse = await supabase.functions.invoke('achievement-webhook-simple', {
        body: {
          player_name: playerName,
          achievement_name: achievement.name,
          description: achievement.description,
          points: achievement.points,
          game_name: recentScore?.games?.name,
          score: recentScore?.score
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


  return {
    checkForNewAchievements
  };
};
