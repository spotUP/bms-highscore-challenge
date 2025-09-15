import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTournament } from '@/contexts/TournamentContext';

interface Competition {
  id: string;
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
}

interface CompetitionStatus {
  competition: Competition | null;
  isLocked: boolean;
  loading: boolean;
  error: string | null;
}

export function useCompetitionStatus(): CompetitionStatus {
  const { currentTournament } = useTournament();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchCompetitionStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('🏆 CompetitionStatus: Fetching status...');

        // Get current active competition
        const { data: competitionData, error: compError } = await supabase
          .from('competitions')
          .select('*')
          .eq('status', 'active')
          .single();

        if (compError && compError.code !== 'PGRST116') {
          console.error('Error fetching competition:', compError);
          setError('Failed to load competition data');
        }

        // Get tournament lock status
        let tournamentLocked = false;
        if (currentTournament?.id) {
          const { data: tournamentData, error: tournamentError } = await supabase
            .from('tournaments')
            .select('scores_locked')
            .eq('id', currentTournament.id)
            .single();

          if (tournamentError) {
            console.error('Error fetching tournament lock status:', tournamentError);
          } else {
            tournamentLocked = tournamentData?.scores_locked || false;
          }
        }

        if (mounted) {
          setCompetition(competitionData);
          // If no active competition, scores should be locked regardless of tournament setting
          setIsLocked(!competitionData || competitionData.status !== 'active' || tournamentLocked);
        }
      } catch (err) {
        console.error('Error in fetchCompetitionStatus:', err);
        if (mounted) {
          setError('Failed to load status');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (currentTournament) {
      fetchCompetitionStatus();
    } else {
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [currentTournament]);

  return {
    competition,
    isLocked,
    loading,
    error
  };
}