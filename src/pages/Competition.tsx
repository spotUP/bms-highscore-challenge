import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBrackets, Tournament, TournamentPlayer, TournamentMatch } from '@/contexts/BracketContext';
import BracketView, { BracketViewRef } from '@/components/BracketView';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { usePageTransitions } from '@/hooks/usePageTransitions';
import ThemeSelector from '@/components/ThemeSelector';
import TournamentDropdown from '@/components/TournamentDropdown';
import PerformanceModeToggle from '@/components/PerformanceModeToggle';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import AdvancedConfetti from '@/components/AdvancedConfetti';
import { createPortal } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Helper function to check if tournament is complete - SAME LOGIC AS BracketAdmin
const checkTournamentComplete = (matches: TournamentMatch[], bracketType: 'single' | 'double'): boolean => {

  if (bracketType === 'single') {
    // Single elimination: tournament is complete when round 1000 (grand final) has a winner
    const grandFinal = matches.find(m => m.round === 1000);

    if (!grandFinal) {
      return false;
    }

    if (!grandFinal.winner_participant_id) {
       Single elimination - Grand Final not completed yet');
      return false;
    }

    // CRITICAL FIX: Ensure Grand Final has both participants before considering it complete
    if (!grandFinal.participant1_id || !grandFinal.participant2_id) {
       Single elimination - Grand Final missing participants:', {
        participant1_id: grandFinal.participant1_id,
        participant2_id: grandFinal.participant2_id
      });
      return false;
    }

     Single elimination - Tournament is COMPLETE!');
    return true;
  } else {
    // Double elimination: more complex logic
    const grandFinal = matches.find(m => m.round === 1000);
    const bracketReset = matches.find(m => m.round === 1001);

     Double elimination - Grand Final:', grandFinal);
     Double elimination - Bracket Reset:', bracketReset);

    if (!grandFinal) {
       Double elimination - No Grand Final exists yet');
      return false;
    }

    if (!grandFinal.winner_participant_id) {
       Double elimination - Grand Final not completed yet');
      return false;
    }

    // CRITICAL FIX: Ensure Grand Final has both participants before considering it complete
    if (!grandFinal.participant1_id || !grandFinal.participant2_id) {
       Double elimination - Grand Final missing participants:', {
        participant1_id: grandFinal.participant1_id,
        participant2_id: grandFinal.participant2_id
      });
      return false;
    }

    if (!bracketReset) {
       Double elimination - No bracket reset, Grand Final winner is champion!');
      return true;
    }

    if (bracketReset.winner_participant_id) {
       Double elimination - Bracket reset completed, tournament is COMPLETE!');
      return true;
    }

     Double elimination - Bracket reset exists but not completed yet');
    return false;
  }
};

// Helper function to get the tournament winner - SAME LOGIC AS BracketAdmin
const getTournamentWinner = (matches: TournamentMatch[], players: TournamentPlayer[]): TournamentPlayer | null => {
  // Check if bracket reset (round 1001) exists and is completed
  const bracketReset = matches.find(m => m.round === 1001);
  if (bracketReset?.winner_participant_id) {
    return players.find(p => p.id === bracketReset.winner_participant_id) || null;
  }

  // Otherwise, check grand final (round 1000)
  const grandFinal = matches.find(m => m.round === 1000);
  if (grandFinal?.winner_participant_id) {
    return players.find(p => p.id === grandFinal.winner_participant_id) || null;
  }

  return null;
};

const Competition: React.FC = () => {
  const { tournaments, getTournamentData, reportWinner, generateBracket } = useBrackets();
  const { user, isAdmin, signOut } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { animatedNavigate } = usePageTransitions({ exitDuration: 600 });
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<TournamentPlayer[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loadingBracket, setLoadingBracket] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [winnerOpen, setWinnerOpen] = useState(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [bracketZoomAnimation, setBracketZoomAnimation] = useState(false);
  const bracketViewRef = useRef<BracketViewRef>(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle URL parameter for specific tournament
  useEffect(() => {
    const tournamentId = searchParams.get('tournament');
    if (tournamentId) {
      // If a specific tournament ID is provided, try to find it or create a placeholder
      if (tournaments.length > 0) {
        const tournament = tournaments.find(t => t.id === tournamentId);
        if (tournament) {
          setSelected(tournament);
        } else {
          // Tournament not found in list, create a placeholder to load it directly
           Tournament not found in list, creating placeholder for ID:', tournamentId);
          setSelected({
            id: tournamentId,
            name: 'Loading Tournament...',
            bracket_type: 'double',
            status: 'active',
            is_public: true,
            created_at: '',
            updated_at: '',
            created_by: null
          });
        }
      } else {
        // No tournaments loaded yet, create placeholder
         No tournaments loaded, creating placeholder for ID:', tournamentId);
        setSelected({
          id: tournamentId,
          name: 'Loading Tournament...',
          bracket_type: 'double',
          status: 'active',
          is_public: true,
          created_at: '',
          updated_at: '',
          created_by: null
        });
      }
    } else if (tournaments.length > 0 && !selected) {
      // Default to first tournament if none specified
      setSelected(tournaments[0]);
    }
  }, [searchParams, tournaments, selected]);

  useEffect(() => {
    if (!selected) return;
    const load = async () => {
      setLoadingBracket(true);
      try {
        const data = await getTournamentData(selected.id);
        setParticipants(data.players);

        // Auto-generate bracket if there are players but no matches
        if (data.players.length >= 2 && data.matches.length === 0) {
           Auto-generating bracket for tournament with players but no matches');
          toast({
            title: 'Generating Bracket',
            description: 'Creating tournament bracket structure...',
          });

          const success = await generateBracket(selected.id, { mode: 'seeded' });
          if (success) {
            // Reload the data after generation
            const newData = await getTournamentData(selected.id);
            setMatches(newData.matches);
            toast({
              title: 'Bracket Generated',
              description: 'Tournament bracket has been created successfully!',
            });
          } else {
            toast({
              title: 'Generation Failed',
              description: 'Could not generate bracket. Please try from the admin page.',
              variant: 'destructive',
            });
            setMatches([]);
          }
        } else {
          setMatches(data.matches);
        }
      } catch (error) {
        console.error('Failed to load bracket data:', error);
        setParticipants([]);
        setMatches([]);
      } finally {
        setLoadingBracket(false);
      }
    };
    load();
  }, [selected, getTournamentData, generateBracket]);

  // Real-time subscriptions + polling backup for live updates
  useEffect(() => {
    if (!selected) {
       No selected tournament, skipping subscriptions');
      return;
    }

     Setting up real-time subscriptions + polling for tournament:', selected.id);
     Supabase client available:', !!supabase);

    // Backup polling mechanism in case real-time subscriptions don't work
    let pollInterval: NodeJS.Timeout | null = null;
    let lastKnownMatchCount = matches.length;

    const startPolling = () => {
       Starting polling backup (every 3 seconds)');
      pollInterval = setInterval(async () => {
        try {
          const data = await getTournamentData(selected.id);

          // Only update if something actually changed (to avoid unnecessary re-renders)
          const hasChanges = JSON.stringify(data.matches) !== JSON.stringify(matches) ||
                            JSON.stringify(data.players) !== JSON.stringify(participants);

          if (hasChanges) {
             Polling detected changes, updating...');
            setMatches(data.matches);
            setParticipants(data.players);
          }
        } catch (error) {
          console.error('🔴 Competition: Polling error:', error);
        }
      }, 3000); // Poll every 3 seconds
    };

    // Start polling immediately
    startPolling();

    // Subscribe to bracket matches changes
    // Try without tournament filter first to see if filtering is the issue
    const channelName = `bracket_matches_global_${selected.id}`;
     Creating subscription channel:', channelName);

    let matchesSubscription;
    try {
      matchesSubscription = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bracket_matches',
            // Remove filter to test if that's the issue
          },
          async (payload) => {
           Bracket match updated:', payload);

          // Filter to only handle changes for our tournament
          if (payload.new && payload.new.tournament_id !== selected.id) {
             Ignoring match update for different tournament:', payload.new.tournament_id);
            return;
          }

          // Clear any fallback timer since we got the real-time update
          if ((window as any).__competitionFallbackTimer) {
            clearTimeout((window as any).__competitionFallbackTimer);
            (window as any).__competitionFallbackTimer = null;
          }

          // Reload tournament data when matches change
          try {
            const data = await getTournamentData(selected.id);
            setMatches(data.matches);

            // Check if tournament is complete after match update
            const isTournamentComplete = checkTournamentComplete(data.matches, selected.bracket_type || 'single');
            if (isTournamentComplete) {
              const winner = getTournamentWinner(data.matches, data.players);
              if (winner) {
                 Tournament completed via subscription! Winner:', winner.name);
                // Center on final match first, then start zoom animation
                bracketViewRef.current?.centerOnFinal();

                // Small delay to let centering finish, then start zoom animation
                setTimeout(() => {
                  setBracketZoomAnimation(true);
                  setTimeout(() => {
                    setBracketZoomAnimation(false);
                    setWinnerName(winner.name);
                    setWinnerOpen(true);
                    setShowConfetti(true);
                  }, 2000); // 2 seconds for the zoom animation
                }, 200); // 200ms delay for centering
              }
            }
          } catch (error) {
            console.error('Failed to reload matches:', error);
          }
        }
      )
        .subscribe((status) => {
           Matches subscription status:', status);
        });
    } catch (error) {
      console.error('🔴 Competition: Failed to create matches subscription:', error);
    }

    // Subscribe to bracket players changes
    const playersSubscription = supabase
      .channel(`bracket_players_${selected.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bracket_players',
          filter: `tournament_id=eq.${selected.id}`,
        },
        async (payload) => {
           Bracket player updated:', payload);
          // Reload tournament data when players change
          try {
            const data = await getTournamentData(selected.id);
            setParticipants(data.players);
          } catch (error) {
            console.error('Failed to reload players:', error);
          }
        }
      )
      .subscribe();

    // Subscribe to tournament status changes
    const tournamentSubscription = supabase
      .channel(`bracket_tournaments_${selected.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bracket_tournaments',
          filter: `id=eq.${selected.id}`,
        },
        async (payload) => {
           Tournament updated:', payload);
          // Update tournament status in local state
          if (payload.new && payload.new.status) {
            setSelected(prev => prev ? { ...prev, status: payload.new.status } : prev);
          }
        }
      )
      .subscribe();

    return () => {
       Cleaning up subscriptions and polling');
      if (pollInterval) clearInterval(pollInterval);
      if (matchesSubscription) matchesSubscription.unsubscribe();
      playersSubscription.unsubscribe();
      tournamentSubscription.unsubscribe();
    };
  }, [selected, getTournamentData, matches, participants]);

  const handleReportWinner = async (matchId: string, winnerId: string) => {
     Reporting winner (optimistic):', { matchId, winnerId });

    // Store original matches for potential rollback
    const originalMatches = [...matches];

    // Optimistic update: immediately update the match in local state
    const optimisticMatches = matches.map(match => {
      if (match.id === matchId) {
         Optimistically updating match:', matchId, 'winner:', winnerId);
        return {
          ...match,
          winner_participant_id: winnerId,
          status: 'completed' as const
        };
      }
      return match;
    });

    // Immediately update UI
    setMatches(optimisticMatches);

    try {
      // Now perform the actual database update in background
      const success = await reportWinner(matchId, winnerId);
       Background report winner result:', success);

      if (!success) {
        // Rollback optimistic update on failure
         Rolling back optimistic update');
        setMatches(originalMatches);
        toast({
          title: "Error",
          description: "Failed to report winner. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (selected) {
        // Get fresh data to ensure we have all updates (like auto-advancement)
         Getting fresh data after successful report...');
        try {
          const data = await getTournamentData(selected.id);
          setMatches(data.matches);
          setParticipants(data.players);

          // Check if tournament is complete after match update
          const isTournamentComplete = checkTournamentComplete(data.matches, selected.bracket_type || 'single');
          if (isTournamentComplete) {
            const winner = getTournamentWinner(data.matches, data.players);
            if (winner) {
               Tournament completed! Winner:', winner.name);
              // Center on final match first, then start zoom animation
              bracketViewRef.current?.centerOnFinal();

              // Small delay to let centering finish, then start zoom animation
              setTimeout(() => {
                setBracketZoomAnimation(true);
                setTimeout(() => {
                  setBracketZoomAnimation(false);
                  setWinnerName(winner.name);
                  setWinnerOpen(true);
                  setShowConfetti(true);
                }, 2000); // 2 seconds for the zoom animation
              }, 200); // 200ms delay for centering
            }
          }
        } catch (error) {
          console.error('Failed to refresh after winner report:', error);
        }
      }
    } catch (error) {
      // Handle validation errors and other failures
      console.error('Error reporting winner:', error);
      toast({
        title: "Cannot advance",
        description: error instanceof Error ? error.message : "An error occurred while reporting the winner.",
        variant: "destructive"
      });
    }
  };

  const handlePlayerClick = async (matchId: string, participantId: string, participantName: string) => {

    // Always proceed with normal winner reporting
    // Winner announcements are handled properly in handleReportWinner with fresh data
    await handleReportWinner(matchId, participantId);
  };

  // Convert participants to the format expected by BracketView
  const participantMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (participants && Array.isArray(participants)) {
      const uniqueParticipants = participants.reduce((acc, p) => {
        if (!acc.find(existing => existing.id === p.id)) {
          acc.push(p);
        }
        return acc;
      }, [] as typeof participants);
      
      uniqueParticipants.forEach(p => {
        map[p.id] = {
          id: p.id,
          display_name: p.name,
          name: p.name
        };
      });
    }
    return map;
  }, [participants]);

  // Convert matches to the format expected by BracketView
  const bracketMatches = useMemo(() => {
    if (!matches || !Array.isArray(matches)) {
      return [];
    }
    const uniqueMatches = matches.reduce((acc, m) => {
      if (!acc.find(existing => existing.id === m.id)) {
        acc.push(m);
      }
      return acc;
    }, [] as typeof matches);
    
    return uniqueMatches.map(m => ({
      id: m.id,
      tournament_id: m.tournament_id,
      round: m.round,
      position: m.position,
      participant1_id: m.participant1_id,
      participant2_id: m.participant2_id,
      winner_participant_id: m.winner_participant_id,
      status: m.winner_participant_id ? 'completed' : 'pending'
    }));
  }, [matches]);

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col">

      {/* Main Content - Bracket View */}
      <div className="flex-1 min-h-0 overflow-hidden p-6">
        {loadingBracket ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-gray-400">Loading bracket...</div>
          </div>
        ) : participants.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="text-2xl font-bold text-gray-300 mb-4">No Players Yet</div>
            <p className="text-gray-400 max-w-md mb-6">
              This tournament doesn't have any players yet. Please add players in the admin panel to view the bracket.
            </p>
            <Button onClick={() => animatedNavigate('/admin/brackets')} variant="outline">
              Go to Admin Panel
            </Button>
          </div>
        ) : matches.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-gray-400">No bracket available for this tournament</div>
          </div>
        ) : (
          <BracketView
            ref={bracketViewRef}
            matches={bracketMatches}
            participants={participantMap}
            adminMode={!!user}
            onReport={handleReportWinner}
            onPlayerClick={handlePlayerClick}
            bracketType={selected?.bracket_type}
            isPublic={selected?.is_public}
            isCompleted={selected?.status === 'completed'}
            matchCount={matches.length}
            tournamentTitle={selected?.name}
            showWinnerZoom={bracketZoomAnimation}
          />
        )}
      </div>

      {/* Winner Dialog */}
      <Dialog open={winnerOpen} onOpenChange={(o) => { setWinnerOpen(o); if (!o) setShowConfetti(false); }}>
        <DialogContent className="bg-gray-900 text-white border-white/20 max-w-xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-arcade-neonYellow text-2xl text-center">Champion Crowned!</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4 py-4">
            <div className="text-6xl">🏆</div>
            <div className="text-xl text-gray-300">{selected?.name}</div>
            <div className="text-3xl font-bold text-arcade-neonPink">Champion: {winnerName}</div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  const url = `${window.location.origin}/competition?tournament=${selected?.id}`;
                  try {
                    await navigator.clipboard.writeText(url);
                  } catch {}
                }}
              >
                Copy Share Link
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setWinnerOpen(false);
                  setShowConfetti(false);
                  navigate('/admin/brackets');
                }}
              >
                OK
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confetti */}
      {showConfetti && createPortal(
        <AdvancedConfetti isActive={showConfetti} onComplete={() => setShowConfetti(false)} />,
        document.body
      )}
    </div>
  );
};

export default Competition;
