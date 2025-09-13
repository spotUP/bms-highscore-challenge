import { useEffect, useCallback } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { toast } from 'sonner';
import { useAchievement } from '@/contexts/AchievementContext';
import { useGameLogo } from '@/hooks/useGameLogo';
import { useTournament } from '@/contexts/TournamentContext';
import { Database } from '@/types/supabase';

interface ScoreSubmission {
  player_name: string;
  score: number;
  game_id: string;
  tournament_id: string;
  is_high_score: boolean;
  previous_high_score: number | null;
  created_at: string;
}

interface AchievementUnlock {
  player_name: string;
  achievement_id: string;
  unlocked_at: string;
  achievement: {
    name: string;
    description: string;
    badge_icon: string;
    badge_color: string;
    points: number;
  };
}

export const useScoreSubmissions = () => {
  const supabase = useSupabaseClient<Database>();
  const { showAchievementNotification } = useAchievement();
  const { currentTournament } = useTournament();
  const getGameLogo = useGameLogo();

  const showScoreNotification = useCallback(async (payload: ScoreSubmission) => {
    // Skip if not in a tournament context or different tournament
    if (currentTournament?.id && payload.tournament_id !== currentTournament.id) {
      return;
    }

    // Get game info
    const { data: game } = await supabase
      .from('games')
      .select('name, logo_url')
      .eq('id', payload.game_id)
      .single();

    if (!game) return;

    const gameLogo = getGameLogo(game.logo_url);
    const isHighScore = payload.is_high_score;
    const scoreDiff = payload.previous_high_score ? payload.score - payload.previous_high_score : null;

    // Show toast notification
    toast.success(
      <div className="flex items-center gap-3">
        {gameLogo && (
          <img src={gameLogo} alt={game.name} className="h-10 w-10 object-contain" />
        )}
        <div>
          <p className="font-bold">
            {payload.player_name} scored {payload.score.toLocaleString()} in {game.name}!
          </p>
          {isHighScore && (
            <p className="text-sm">
              🏆 New High Score! {scoreDiff ? `(+${scoreDiff.toLocaleString()} from previous)` : ''}
            </p>
          )}
        </div>
      </div>,
      {
        duration: 5000,
        position: 'top-center',
        style: {
          background: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid #00f0ff',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
        },
      }
    );
  }, [currentTournament, getGameLogo, supabase]);

  // Set up real-time subscriptions
  useEffect(() => {
    // Subscribe to score submissions
    const scoreChannel = supabase
      .channel('score_submissions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'score_submissions',
        },
        (payload) => {
          showScoreNotification(payload.new as ScoreSubmission);
        }
      )
      .subscribe();

    // Subscribe to achievement unlocks
    const achievementChannel = supabase
      .channel('achievement_unlocks')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'player_achievements',
        },
        async (payload) => {
          const achievementUnlock = payload.new as AchievementUnlock;
          
          // Get achievement details
          const { data: achievement } = await supabase
            .from('achievements')
            .select('*')
            .eq('id', achievementUnlock.achievement_id)
            .single();

          if (achievement) {
            showAchievementNotification({
              id: achievement.id,
              name: achievement.name,
              description: achievement.description,
              badge_icon: achievement.badge_icon,
              badge_color: achievement.badge_color,
              points: achievement.points,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scoreChannel);
      supabase.removeChannel(achievementChannel);
    };
  }, [showAchievementNotification, showScoreNotification, supabase]);

  return {
    showScoreNotification,
  };
};

// Add this to your types/supabase.ts file if it doesn't exist
declare module '@/types/supabase' {
  interface Database {
    public: {
      Tables: {
        score_submissions: {
          Row: {
            id: string;
            player_name: string;
            score: number;
            game_id: string;
            tournament_id: string | null;
            created_at: string;
            is_high_score: boolean;
            previous_high_score: number | null;
          };
          Insert: {
            id?: string;
            player_name: string;
            score: number;
            game_id: string;
            tournament_id?: string | null;
            created_at?: string;
            is_high_score?: boolean;
            previous_high_score?: number | null;
          };
          Update: {
            id?: string;
            player_name?: string;
            score?: number;
            game_id?: string;
            tournament_id?: string | null;
            created_at?: string;
            is_high_score?: boolean;
            previous_high_score?: number | null;
          };
        };
      };
    };
  }
}
