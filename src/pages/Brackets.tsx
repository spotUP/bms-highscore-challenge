import React, { useEffect, useState } from 'react';
import { useBrackets } from '@/contexts/BracketContext';
import BracketView from '@/components/BracketView';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AdvancedConfetti from '@/components/AdvancedConfetti';

const Brackets: React.FC = () => {
  const { tournaments, loading, reportWinner, getTournamentData } = useBrackets();
  const [selected, setSelected] = useState(tournaments[0] || null);
  const [participants, setParticipants] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loadingBracket, setLoadingBracket] = useState(false);
  const [winnerOpen, setWinnerOpen] = useState(false);
  const [winnerName, setWinnerName] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  // Load tournament data when selected changes
  useEffect(() => {
    if (selected) {
      loadTournamentData(selected.id);
    }
  }, [selected]);

  const loadTournamentData = async (tournamentId: string) => {
    try {
      setLoadingBracket(true);
      const { players, matches: tournamentMatches } = await getTournamentData(tournamentId);
      setParticipants(players);
      setMatches(tournamentMatches);
    } catch (error) {
      console.error('Error loading tournament data:', error);
    } finally {
      setLoadingBracket(false);
    }
  };

  const handleReportWinner = async (matchId: string, winnerId: string) => {
    try {
      const success = await reportWinner(matchId, winnerId);
      if (success && selected) {
        const { players, matches: updatedMatches } = await getTournamentData(selected.id);
        setParticipants(players);
        setMatches(updatedMatches);

        // Check if this was the final match
        const finalMatch = updatedMatches.find(m => m.round === 1);
        if (finalMatch?.winner_participant_id) {
          const winner = players.find(p => p.id === finalMatch.winner_participant_id);
          if (winner) {
            setWinnerName(winner.name);
            setShowConfetti(true);
            setWinnerOpen(true);
          }
        }
      }
    } catch (error) {
      console.error('Error reporting winner:', error);
    }
  };

  // Format matches for BracketView
  const bracketMatches = matches.map(match => ({
    ...match,
    position: match.position,
    participant1_id: match.participant1_id,
    participant2_id: match.participant2_id,
    winner_participant_id: match.winner_participant_id,
    status: match.winner_participant_id ? 'completed' : 'pending'
  }));

  // Create participant map
  const participantMap = participants.reduce((acc, participant) => ({
    ...acc,
    [participant.id]: participant
  }), {});

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <AdvancedConfetti recycle={false} onComplete={() => setShowConfetti(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Tournament Bracket</h1>
          {tournaments.length > 1 && (
            <select 
              value={selected?.id || ''}
              onChange={(e) => {
                const tournament = tournaments.find(t => t.id === e.target.value);
                if (tournament) setSelected(tournament);
              }}
              className="bg-gray-800 text-white px-4 py-2 rounded"
            >
              {tournaments.map(tournament => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {loadingBracket ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-white">Loading bracket...</div>
          </div>
        ) : (
          <div className="bg-gray-800 p-4 rounded-lg">
            <BracketView
              matches={bracketMatches}
              participants={participantMap}
              adminMode={false}
              isPublic={true}
            />
          </div>
        )}
      </div>

      {/* Winner Dialog */}
      <Dialog open={winnerOpen} onOpenChange={setWinnerOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center">
              🏆 Tournament Complete! 🏆
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-xl mb-4">
              Congratulations to <span className="font-bold text-yellow-400">{winnerName}</span> for winning the tournament!
            </p>
            <Button 
              onClick={() => setWinnerOpen(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Brackets;
