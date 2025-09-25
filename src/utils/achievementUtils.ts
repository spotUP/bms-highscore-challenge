import { supabase } from '@/integrations/supabase/client';

interface ScoreInfo {
  player_name: string;
  tournament_id: string | null;
}

export async function deleteScoreWithAchievementCleanup(scoreId: string) {
  try {
    // First, get the score information before deleting
    const { data: scoreData, error: fetchError } = await supabase
      .from('scores')
      .select('player_name, tournament_id')
      .eq('id', scoreId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch score data: ${fetchError.message}`);
    }

    if (!scoreData) {
      throw new Error('Score not found');
    }

    const scoreInfo: ScoreInfo = scoreData;

    // Delete the score
    const { error: deleteError } = await supabase
      .from('scores')
      .delete()
      .eq('id', scoreId);

    if (deleteError) {
      throw new Error(`Failed to delete score: ${deleteError.message}`);
    }

    // Clean up achievements for this player in this tournament
    if (scoreInfo.tournament_id) {
      await cleanupPlayerAchievements(scoreInfo.player_name, scoreInfo.tournament_id);
    }

    return { success: true };
  } catch (error) {
    console.error('Error in deleteScoreWithAchievementCleanup:', error);
    throw error;
  }
}

async function cleanupPlayerAchievements(playerName: string, tournamentId: string) {
  try {
    // Delete all existing achievements for this player in this tournament
    // The achievement system will need to recalculate them based on remaining scores
    const { error: deleteAchievementsError } = await supabase
      .from('player_achievements')
      .delete()
      .eq('player_name', playerName)
      .eq('tournament_id', tournamentId);

    if (deleteAchievementsError) {
      console.error('Error deleting player achievements:', deleteAchievementsError);
      // Don't throw here - we still want the score deletion to succeed
      // The achievements will be inconsistent but that's better than failing the whole operation
    }

    // TODO: Ideally, we would trigger a recalculation of achievements here
    // This would require calling the achievement calculation logic for this specific player/tournament
    // For now, we're just cleaning up the old achievements and relying on the next score submission
    // or manual achievement recalculation to fix the state

    console.log(`Cleaned up achievements for player ${playerName} in tournament ${tournamentId}`);
  } catch (error) {
    console.error('Error in cleanupPlayerAchievements:', error);
    // Don't rethrow - we don't want achievement cleanup failures to prevent score deletion
  }
}