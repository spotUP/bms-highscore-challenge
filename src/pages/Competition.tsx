import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBrackets, Tournament, TournamentPlayer, TournamentMatch } from '@/contexts/BracketContext';
import BracketView from '@/components/BracketView';
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

// Helper function to check if tournament is complete - SAME LOGIC AS BracketAdmin
const checkTournamentComplete = (matches: TournamentMatch[], bracketType: 'single' | 'double'): boolean => {
  console.log('🏆 COMPETITION - CHECKING TOURNAMENT COMPLETION:', {
    bracketType,
    totalMatches: matches.length,
    matchesByRound: matches.reduce((acc, m) => {
      acc[m.round] = (acc[m.round] || 0) + 1;
      return acc;
    }, {} as Record<number, number>)
  });

  if (bracketType === 'single') {
    // Single elimination: tournament is complete when round 1000 (grand final) has a winner
    const grandFinal = matches.find(m => m.round === 1000);
    console.log('🏆 COMPETITION - Single elimination - Grand Final:', grandFinal);

    if (!grandFinal) {
      console.log('🏆 COMPETITION - Single elimination - No Grand Final exists yet');
      return false;
    }

    if (!grandFinal.winner_participant_id) {
      console.log('🏆 COMPETITION - Single elimination - Grand Final not completed yet');
      return false;
    }

    // CRITICAL FIX: Ensure Grand Final has both participants before considering it complete
    if (!grandFinal.participant1_id || !grandFinal.participant2_id) {
      console.log('🏆 COMPETITION - Single elimination - Grand Final missing participants:', {
        participant1_id: grandFinal.participant1_id,
        participant2_id: grandFinal.participant2_id
      });
      return false;
    }

    console.log('🏆 COMPETITION - Single elimination - Tournament is COMPLETE!');
    return true;
  } else {
    // Double elimination: more complex logic
    const grandFinal = matches.find(m => m.round === 1000);
    const bracketReset = matches.find(m => m.round === 1001);

    console.log('🏆 COMPETITION - Double elimination - Grand Final:', grandFinal);
    console.log('🏆 COMPETITION - Double elimination - Bracket Reset:', bracketReset);

    if (!grandFinal) {
      console.log('🏆 COMPETITION - Double elimination - No Grand Final exists yet');
      return false;
    }

    if (!grandFinal.winner_participant_id) {
      console.log('🏆 COMPETITION - Double elimination - Grand Final not completed yet');
      return false;
    }

    // CRITICAL FIX: Ensure Grand Final has both participants before considering it complete
    if (!grandFinal.participant1_id || !grandFinal.participant2_id) {
      console.log('🏆 COMPETITION - Double elimination - Grand Final missing participants:', {
        participant1_id: grandFinal.participant1_id,
        participant2_id: grandFinal.participant2_id
      });
      return false;
    }

    if (!bracketReset) {
      console.log('🏆 COMPETITION - Double elimination - No bracket reset, Grand Final winner is champion!');
      return true;
    }

    if (bracketReset.winner_participant_id) {
      console.log('🏆 COMPETITION - Double elimination - Bracket reset completed, tournament is COMPLETE!');
      return true;
    }

    console.log('🏆 COMPETITION - Double elimination - Bracket reset exists but not completed yet');
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
  const { tournaments, getTournamentData, reportWinner } = useBrackets();
  const { user, isAdmin, signOut } = useAuth();
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

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle URL parameter for specific tournament
  useEffect(() => {
    const tournamentId = searchParams.get('tournament');
    if (tournamentId && tournaments.length > 0) {
      const tournament = tournaments.find(t => t.id === tournamentId);
      if (tournament) {
        setSelected(tournament);
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
        setMatches(data.matches);
      } catch (error) {
        console.error('Failed to load bracket data:', error);
        setParticipants([]);
        setMatches([]);
      } finally {
        setLoadingBracket(false);
      }
    };
    load();
  }, [selected, getTournamentData]);

  const handleReportWinner = async (matchId: string, winnerId: string) => {
    const success = await reportWinner(matchId, winnerId);
    if (success && selected) {
      // Reload tournament data
      const data = await getTournamentData(selected.id);
      if (data) {
        setParticipants(data.players);
        setMatches(data.matches);

        // Check if tournament is actually complete using proper logic
        const isTournamentComplete = checkTournamentComplete(data.matches, selected?.bracket_type || 'single');

        if (isTournamentComplete) {
          const winner = getTournamentWinner(data.matches, data.players);
          if (winner) {
            console.log('Tournament completed! Winner:', winner.name);
            // Start bracket zoom animation before showing the modal
            setBracketZoomAnimation(true);
            setTimeout(() => {
              setBracketZoomAnimation(false);
              setWinnerName(winner.name);
              setWinnerOpen(true);
              setShowConfetti(true);
            }, 2000); // 2 seconds for the zoom animation
          }
        }
      }
    }
  };

  const handlePlayerClick = async (matchId: string, participantId: string, participantName: string) => {
    console.log('Player clicked:', { matchId, participantId, participantName });

    // Always proceed with normal winner reporting
    // Winner announcements are handled properly in handleReportWinner with fresh data
    console.log('Reporting winner normally');
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
                }}
              >
                Close
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
