import React, { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { useTournament } from '@/contexts/TournamentContext';
import PlayerInsult from '@/components/PlayerInsult';
import { useAchievement } from '@/contexts/AchievementContext';
import { getGameLogoUrl } from '@/lib/utils';
import { toast } from 'sonner';

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
    // Set up global score submissions listener (works regardless of tournament context)
    const channelName = `global_score_submissions_${Date.now()}`;
    console.log('[ScoreNotificationsListener] Setting up subscription to score_submissions, channel:', channelName);

    scoreChannelRef.current = api
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'score_submissions',
          // Remove tournament filter to make it global
        },
        async (payload) => {
          console.log('[ScoreNotificationsListener] Received score_submissions INSERT:', payload);
          const submission = payload.new as {
            player_name: string;
            score: number;
            game_id: string;
            is_high_score: boolean;
            previous_high_score: number | null;
          };

          console.log('[ScoreNotificationsListener] Processing submission:', submission);

          // Get game info
          const { data: game, error: gameError } = await api
            .from('games')
            .select('name, logo_url')
            .eq('id', submission.game_id)
            .single();

          console.log('[ScoreNotificationsListener] Game data:', { game, gameError });

          if (gameError) {
            console.error('ScoreNotificationsListener: Error fetching game:', gameError);
            return;
          }
          if (!game) {
            console.error('ScoreNotificationsListener: No game found for ID:', submission.game_id);
            return;
          }


          // Show toast notification for all score submissions
          const scoreDiff = submission.previous_high_score
            ? submission.score - submission.previous_high_score
            : null;

          toast(
            <ScoreNotification
              playerName={submission.player_name}
              score={submission.score}
              gameName={game.name}
              gameLogoUrl={game.logo_url}
              isHighScore={submission.is_high_score}
              scoreDiff={scoreDiff}
            />,
            {
              duration: submission.is_high_score ? 8000 : 5000, // Longer for high scores
              className: submission.is_high_score ? 'border-yellow-400 border-2' : undefined,
            }
          );

          // Trigger global celebration modal + confetti for high scores
          if (submission.is_high_score) {
            console.log('[ScoreNotificationsListener] Triggering modal for high score:', submission.player_name);
            try {
              setInsultPlayerName(submission.player_name);
              setShowPlayerInsult(true);
              console.log('[ScoreNotificationsListener] Modal state set successfully');
            } catch (modalError) {
              console.error('ScoreNotificationsListener: Modal error:', modalError);
            }
          }
        }
      )
      .subscribe();

    console.log('[ScoreNotificationsListener] Subscribed to score_submissions');

    // Subscribe to achievement unlocks (global) with unique channel name
    const achievementChannelName = `player_achievements_${Date.now()}`;
    achievementChannelRef.current = api
      .channel(achievementChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'player_achievements',
        },
        async (payload) => {
          const pa = payload.new as { achievement_id: string; player_name: string };

          const { data: achievement, error } = await api
            .from('achievements')
            .select('id, name, description, badge_icon, badge_color, points')
            .eq('id', pa.achievement_id)
            .single();

          if (error) {
            console.error('ScoreNotificationsListener: Error fetching achievement:', error);
            return;
          }


          if (achievement && showAchievementNotification) {
            // Show achievement modal
            showAchievementNotification({
              id: achievement.id,
              name: achievement.name,
              description: achievement.description,
              badge_icon: achievement.badge_icon,
              badge_color: achievement.badge_color,
              points: achievement.points,
            });

            // Also show toast notification for achievements
            toast(
              <div className="flex items-center gap-3">
                <div className="text-2xl">{achievement.badge_icon}</div>
                <div>
                  <p className="font-bold text-yellow-400">🏆 Achievement Unlocked!</p>
                  <p className="font-semibold">{achievement.name}</p>
                  <p className="text-sm text-gray-300">{achievement.description}</p>
                  <p className="text-sm text-blue-400">+{achievement.points} points</p>
                </div>
              </div>,
              {
                duration: 6000,
                className: 'border-yellow-400 border-2 bg-gradient-to-r from-yellow-900/20 to-blue-900/20',
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      if (scoreChannelRef.current) api.removeChannel(scoreChannelRef.current);
      if (achievementChannelRef.current) api.removeChannel(achievementChannelRef.current);
    };
  }, [showAchievementNotification]); // Global notifications work regardless of tournament context

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
