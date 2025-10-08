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

      // Recalculate achievements for the player
      try {
        await recalculatePlayerAchievements(scoreInfo.player_name, scoreInfo.tournament_id);
      } catch (achievementError) {
        console.error('Error recalculating achievements after deletion:', achievementError);
        // Don't throw - the score deletion succeeded
      }
    }

    console.log(`Successfully deleted score ${scoreId} and recalculated achievements for player ${scoreInfo.player_name}`);
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

    console.log(`Cleaned up achievements for player ${playerName} in tournament ${tournamentId}`);
  } catch (error) {
    console.error('Error in cleanupPlayerAchievements:', error);
    // Don't rethrow - we don't want achievement cleanup failures to prevent score deletion
  }
}

export async function recalculatePlayerAchievements(playerName: string, tournamentId: string) {
  try {
    // First clean up existing achievements
    await cleanupPlayerAchievements(playerName, tournamentId);

    // Get all scores for this player in this tournament
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('id, player_name, game_id, score, tournament_id, user_id')
      .eq('player_name', playerName)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });

    if (scoresError) {
      throw new Error(`Failed to fetch scores: ${scoresError.message}`);
    }

    if (!scores || scores.length === 0) {
      console.log(`No scores found for player ${playerName} in tournament ${tournamentId}`);
      return { success: true, message: 'No scores to process' };
    }

    // Recalculate achievements by calling the function with all scores
    const { data, error } = await supabase.rpc('check_and_award_achievements_v2', {
      p_player_name: playerName,
      p_tournament_id: tournamentId,
      p_scores: scores || []
    });

    if (error) {
      console.error('Error recalculating achievements:', error);
    } else {
      console.log(`Achievements recalculated for ${playerName}:`, data);
    }

    console.log(`Recalculated achievements for player ${playerName} in tournament ${tournamentId}`);

    // Broadcast achievement update across tabs/windows
    if (typeof window !== 'undefined') {
      try {
        const channel = new BroadcastChannel('achievement-updates');
        channel.postMessage({ playerName, tournamentId });
        channel.close();
      } catch (broadcastError) {
        console.warn('BroadcastChannel not supported, falling back to localStorage');
        // Fallback to localStorage for cross-tab communication
        localStorage.setItem('achievementUpdate', JSON.stringify({ playerName, tournamentId, timestamp: Date.now() }));
      }

      // Also dispatch local event for same-tab updates
      const achievementUpdateEvent = new CustomEvent('achievementsUpdated', {
        detail: { playerName, tournamentId }
      });
      window.dispatchEvent(achievementUpdateEvent);
    }

    return { success: true, message: `Processed ${scores.length} scores` };
  } catch (error) {
    console.error('Error in recalculatePlayerAchievements:', error);
    throw error;
  }
}