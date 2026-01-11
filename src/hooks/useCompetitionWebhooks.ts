import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Game {
  id: string;
  name: string;
  logo_url?: string;
}

interface CompetitionWebhookData {
  event_type: 'competition_started' | 'competition_ended';
  competition_name?: string;
  games: Game[];
  timestamp: string;
  duration?: string;
  total_scores?: number;
  winner?: {
    player_name: string;
    total_score: number;
  };
}

export const useCompetitionWebhooks = () => {
  const sendCompetitionWebhook = useCallback(async (webhookData: CompetitionWebhookData) => {
    try {
      console.log('🚀 Sending competition webhook:', {
        event_type: webhookData.event_type,
        games_count: webhookData.games.length
      });

      const webhookResponse = await supabase.functions.invoke('send-competition-webhook', {
        body: webhookData
      });

      if (webhookResponse.error) {
        console.error('❌ Competition webhook error:', webhookResponse.error);
      } else {
        console.log('✅ Competition webhook sent successfully:', webhookResponse.data);
      }
    } catch (error) {
      console.error('❌ Competition webhook call failed:', error);
    }
  }, []);

  const sendCompetitionStartedWebhook = useCallback(async (games: Game[], competitionName?: string) => {
    const webhookData: CompetitionWebhookData = {
      event_type: 'competition_started',
      competition_name: competitionName,
      games,
      timestamp: new Date().toISOString()
    };

    await sendCompetitionWebhook(webhookData);
  }, [sendCompetitionWebhook]);

  const sendCompetitionEndedWebhook = useCallback(async (
    games: Game[], 
    competitionName?: string,
    duration?: string,
    totalScores?: number,
    winner?: { player_name: string; total_score: number }
  ) => {
    const webhookData: CompetitionWebhookData = {
      event_type: 'competition_ended',
      competition_name: competitionName,
      games,
      timestamp: new Date().toISOString(),
      duration,
      total_scores: totalScores,
      winner
    };

    await sendCompetitionWebhook(webhookData);
  }, [sendCompetitionWebhook]);

  return {
    sendCompetitionWebhook,
    sendCompetitionStartedWebhook,
    sendCompetitionEndedWebhook
  };
};
