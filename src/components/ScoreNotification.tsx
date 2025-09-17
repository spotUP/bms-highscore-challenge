import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTournament } from '@/contexts/TournamentContext';
import PlayerInsult from '@/components/PlayerInsult';
import { useAchievement } from '@/contexts/AchievementContext';
import { getGameLogoUrl } from '@/lib/utils';

interface ScoreNotificationProps {
  playerName: string;
  score: number;
  gameName: string;
  gameLogoUrl: string | null;
  isHighScore: boolean;
  scoreDiff: number | null;
}

export const ScoreNotification: React.FC<ScoreNotificationProps> = ({
  playerName,
  score,
  gameName,
  gameLogoUrl,
  isHighScore,
  scoreDiff,
}) => {
  const resolvedLogo = getGameLogoUrl(gameLogoUrl);
  
  return (
    <div className="flex items-center gap-3">
      {resolvedLogo && (
        <img src={resolvedLogo} alt={gameName} className="h-10 w-10 object-contain" />
      )}
      <div>
        <p className="font-bold">
          {playerName} scored {score.toLocaleString()} in {gameName}!
        </p>
        {isHighScore && (
          <p className="text-sm flex items-center gap-1">
            <span className="text-yellow-400">🏆 New High Score!</span>
            {scoreDiff !== null && `(+${scoreDiff.toLocaleString()} from previous)`}
          </p>
        )}
      </div>
    </div>
  );
};

// This component should be placed in your app's root component to handle real-time notifications
export const ScoreNotificationsListener: React.FC = () => {
  const { currentTournament } = useTournament();
  const { showAchievementNotification } = useAchievement();
  const scoreChannelRef = useRef<any>(null);
  const achievementChannelRef = useRef<any>(null);

  // Local state for global celebration modal
  const [showPlayerInsult, setShowPlayerInsult] = useState(false);
  const [insultPlayerName, setInsultPlayerName] = useState('');

  useEffect(() => {
    // Only set up the listener if we have a tournament context
    if (!currentTournament) {
      console.log('ScoreNotificationsListener: No current tournament, skipping setup');
      return;
    }

    console.log('ScoreNotificationsListener: Setting up realtime subscriptions for tournament:', currentTournament.id);

    // Subscribe to score submissions with unique channel name
    const channelName = `score_submissions_${currentTournament.id}_${Date.now()}`;

    scoreChannelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'score_submissions',
          filter: `tournament_id=eq.${currentTournament.id}`,
        },
        async (payload) => {
          console.log('ScoreNotificationsListener: Received score submission event:', payload);
          const submission = payload.new as {
            player_name: string;
            score: number;
            game_id: string;
            is_high_score: boolean;
            previous_high_score: number | null;
          };

          // Get game info
          const { data: game, error: gameError } = await supabase
            .from('games')
            .select('name, logo_url')
            .eq('id', submission.game_id)
            .single();

          if (gameError) {
            console.error('ScoreNotificationsListener: Error fetching game:', gameError);
            return;
          }
          if (!game) {
            console.error('ScoreNotificationsListener: No game found for ID:', submission.game_id);
            return;
          }

          console.log('ScoreNotificationsListener: Found game:', game);

          // Toast notification removed - only celebration modal is shown
          console.log('ScoreNotificationsListener: Skipping toast notification (disabled)');

          // Trigger global celebration modal + confetti
          console.log('ScoreNotificationsListener: Triggering celebration modal for:', submission.player_name);
          try {
            setInsultPlayerName(submission.player_name);
            setShowPlayerInsult(true);
            console.log('ScoreNotificationsListener: Modal state updated successfully');
          } catch (modalError) {
            console.error('ScoreNotificationsListener: Modal error:', modalError);
          }
        }
      )
      .subscribe((status) => {
        console.log('ScoreNotificationsListener: Score subscription status:', status);
      });

    // Subscribe to achievement unlocks (global) with unique channel name
    const achievementChannelName = `player_achievements_${Date.now()}`;
    achievementChannelRef.current = supabase
      .channel(achievementChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'player_achievements',
        },
        async (payload) => {
          console.log('ScoreNotificationsListener: Achievement event received:', payload);
          const pa = payload.new as { achievement_id: string; player_name: string };
          console.log('ScoreNotificationsListener: Fetching achievement data for:', pa.achievement_id);

          const { data: achievement, error } = await supabase
            .from('achievements')
            .select('id, name, description, badge_icon, badge_color, points')
            .eq('id', pa.achievement_id)
            .single();

          if (error) {
            console.error('ScoreNotificationsListener: Error fetching achievement:', error);
            return;
          }

          console.log('ScoreNotificationsListener: Achievement data:', achievement);

          if (achievement && showAchievementNotification) {
            console.log('ScoreNotificationsListener: Showing achievement notification for:', achievement.name);
            showAchievementNotification({
              id: achievement.id,
              name: achievement.name,
              description: achievement.description,
              badge_icon: achievement.badge_icon,
              badge_color: achievement.badge_color,
              points: achievement.points,
            });
          } else {
            console.log('ScoreNotificationsListener: Cannot show achievement notification:', {
              hasAchievement: !!achievement,
              hasShowFunction: !!showAchievementNotification
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('ScoreNotificationsListener: Achievement subscription status:', status);
      });

    return () => {
      console.log('ScoreNotificationsListener: Cleaning up subscriptions');
      if (scoreChannelRef.current) supabase.removeChannel(scoreChannelRef.current);
      if (achievementChannelRef.current) supabase.removeChannel(achievementChannelRef.current);
    };
  }, [currentTournament?.id, showAchievementNotification]); // Depend on tournament ID and showAchievementNotification

  return (
    <>
      <PlayerInsult
        isVisible={showPlayerInsult}
        playerName={insultPlayerName}
        onComplete={() => setShowPlayerInsult(false)}
      />
    </>
  );
};
