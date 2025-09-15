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

        // Check if this was the final match - find the highest round number with a winner
        const sortedMatches = data.matches.sort((a, b) => b.round - a.round);
        const finalMatch = sortedMatches.find(m => m.winner_participant_id);

        // Only show winner celebration if this is the actual final match
        const isActualFinal = finalMatch && sortedMatches.filter(m => m.round === finalMatch.round).length === 1;

        console.log('Final match check:', { finalMatch, isActualFinal, allMatches: data.matches.map(m => ({ round: m.round, winner: m.winner_participant_id })) });

        if (finalMatch?.winner_participant_id && isActualFinal) {
          const winner = data.players.find(p => p.id === finalMatch.winner_participant_id);
          if (winner) {
            console.log('Tournament completed! Winner:', winner.name);
            // Small delay to ensure UI updates before showing the modal
            setTimeout(() => {
              setWinnerName(winner.name);
              setWinnerOpen(true);
              setShowConfetti(true);
            }, 500);
          }
        }
      }
    }
  };

  const handlePlayerClick = async (matchId: string, participantId: string, participantName: string) => {
    console.log('Player clicked:', { matchId, participantId, participantName });

    // Check if this is a completed final match and the clicked participant is the winner
    const match = matches.find(m => m.id === matchId);
    console.log('Match found:', match);

    if (match && match.winner_participant_id === participantId) {
      // Check if this is the final match (highest round)
      const sortedMatches = matches.sort((a, b) => b.round - a.round);
      const isFinalMatch = sortedMatches[0]?.id === matchId;

      console.log('Is final match?', { isFinalMatch, highestRound: sortedMatches[0]?.round });

      if (isFinalMatch) {
        console.log('Showing winner dialog for completed final match');
        // This is the tournament winner being clicked
        setWinnerName(participantName);
        setWinnerOpen(true);
        setShowConfetti(true);
        return;
      }
    }

    // Normal winner reporting
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
