import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Clock, Trophy, Target, Users, Play } from 'lucide-react';
import { Tournament, TournamentPlayer, TournamentMatch, useBrackets } from '@/contexts/BracketContext';

interface BracketDebuggerProps {
  tournament: Tournament;
  players: TournamentPlayer[];
  matches: TournamentMatch[];
}

interface DebugInfo {
  winnersChampion: string | null;
  losersChampion: string | null;
  grandFinalReady: boolean;
  grandFinalCompleted: boolean;
  nextRequiredMatches: TournamentMatch[];
  activePlayers: number;
  eliminatedPlayers: string[];
  tournamentCompleted: boolean;
  blockingIssues: string[];
}

const BracketDebugger: React.FC<BracketDebuggerProps> = ({ tournament, players, matches }) => {
  const { autoAdvanceMatches } = useBrackets();
  const [advancing, setAdvancing] = useState(false);
  const debugInfo = useMemo((): DebugInfo => {
    // Find Grand Final (round 1000)
    const grandFinal = matches.find(m => m.round === 1000);
    const grandFinalCompleted = !!grandFinal?.winner_participant_id;

    // Find Winners Champion (highest round in winners bracket with winner)
    const winnersMatches = matches.filter(m => m.round < 100 && m.winner_participant_id);
    const highestWinnersRound = Math.max(...winnersMatches.map(m => m.round));
    const winnersChampion = winnersMatches.find(m => m.round === highestWinnersRound)?.winner_participant_id || null;

    // Find Losers Champion (highest round in losers bracket with winner)
    const losersMatches = matches.filter(m => m.round >= 100 && m.round < 1000 && m.winner_participant_id);
    const highestLosersRound = Math.max(...losersMatches.map(m => m.round));
    const losersChampion = losersMatches.find(m => m.round === highestLosersRound)?.winner_participant_id || null;

    // Check if Grand Final is ready (both champions determined)
    const grandFinalReady = !!winnersChampion && !!losersChampion;

    // Find next required matches (incomplete matches that can be played)
    const incompleteMatches = matches.filter(m => !m.winner_participant_id);
    const playableMatches = incompleteMatches.filter(match => {
      // A match is playable if both participants are filled
      return match.participant1_id && match.participant2_id;
    });

    // Special analysis for losers bracket progression
    const allLosersMatches = matches.filter(m => m.round >= 100 && m.round < 1000);
    const losersIncomplete = allLosersMatches.filter(m => !m.winner_participant_id);
    const losersPlayable = losersIncomplete.filter(m => m.participant1_id && m.participant2_id);
    const losersPendingParticipants = losersIncomplete.filter(m => !m.participant1_id || !m.participant2_id);

    // Find eliminated players (lost 2 matches in double elim or 1 in single)
    const eliminatedPlayers: string[] = [];
    players.forEach(player => {
      const playerMatches = matches.filter(m =>
        (m.participant1_id === player.id || m.participant2_id === player.id) &&
        m.winner_participant_id
      );
      const losses = playerMatches.filter(m => m.winner_participant_id !== player.id).length;

      if (tournament.bracket_type === 'single' && losses >= 1) {
        eliminatedPlayers.push(player.id);
      } else if (tournament.bracket_type === 'double' && losses >= 2) {
        eliminatedPlayers.push(player.id);
      }
    });

    const activePlayers = players.length - eliminatedPlayers.length;
    const tournamentCompleted = grandFinalCompleted;

    // Identify blocking issues
    const blockingIssues: string[] = [];

    if (tournament.bracket_type === 'double') {
      if (!winnersChampion) {
        const winnersIncomplete = matches.filter(m => m.round < 100 && !m.winner_participant_id);
        if (winnersIncomplete.length > 0) {
          blockingIssues.push(`Winners bracket incomplete: ${winnersIncomplete.length} matches remaining`);
        }
      }

      if (!losersChampion) {
        if (losersPlayable.length > 0) {
          const highestLosersRound = Math.max(...losersPlayable.map(m => m.round));
          blockingIssues.push(`Losers bracket incomplete: ${losersPlayable.length} playable matches (highest: L${highestLosersRound - 99})`);
        }
        if (losersPendingParticipants.length > 0) {
          blockingIssues.push(`${losersPendingParticipants.length} losers bracket matches waiting for participants from earlier rounds`);
        }
      }

      if (winnersChampion && !losersChampion) {
        blockingIssues.push('Losers bracket must be completed to determine Grand Final opponent');
      }

      if (grandFinal && !grandFinal.participant1_id && !grandFinal.participant2_id) {
        blockingIssues.push('Grand Final not populated with participants');
      }
    }

    return {
      winnersChampion,
      losersChampion,
      grandFinalReady,
      grandFinalCompleted,
      nextRequiredMatches: playableMatches,
      activePlayers,
      eliminatedPlayers,
      tournamentCompleted,
      blockingIssues
    };
  }, [tournament, players, matches]);

  const getPlayerName = (playerId: string | null): string => {
    if (!playerId) return 'Unknown';
    const player = players.find(p => p.id === playerId);
    return player?.name || 'Unknown Player';
  };

  const getRoundDisplayName = (round: number): string => {
    if (round === 1000) return 'Grand Final';
    if (round >= 100) return `Losers L${round - 99}`;
    return `Winners R${round}`;
  };

  const getStatusColor = (hasIssues: boolean) => {
    return hasIssues ? 'text-red-400' : 'text-green-400';
  };

  const handleAutoAdvance = async () => {
    setAdvancing(true);
    try {
      await autoAdvanceMatches(tournament.id);
      // The page should refresh automatically due to real-time subscriptions
    } catch (error) {
      console.error('Auto-advance failed:', error);
    } finally {
      setAdvancing(false);
    }
  };

  // Count single-participant matches for the button
  const singleParticipantCount = matches.filter(m =>
    !m.winner_participant_id &&
    ((m.participant1_id && !m.participant2_id) || (!m.participant1_id && m.participant2_id))
  ).length;

  return (
    <div className="space-y-4">
      {/* Tournament Status Overview */}
      <Card className="bg-black/20 backdrop-blur-sm border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="h-5 w-5" />
            Tournament Debug Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              {debugInfo.tournamentCompleted ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <Clock className="h-5 w-5 text-yellow-400" />
              )}
              <div>
                <p className="text-sm text-gray-400">Tournament</p>
                <p className={`font-semibold ${debugInfo.tournamentCompleted ? 'text-green-400' : 'text-yellow-400'}`}>
                  {debugInfo.tournamentCompleted ? 'Completed' : 'In Progress'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Active Players</p>
                <p className="font-semibold text-white">{debugInfo.activePlayers}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-yellow-400" />
              <div>
                <p className="text-sm text-gray-400">Grand Final</p>
                <p className={`font-semibold ${debugInfo.grandFinalReady ? 'text-green-400' : 'text-red-400'}`}>
                  {debugInfo.grandFinalCompleted ? 'Completed' : debugInfo.grandFinalReady ? 'Ready' : 'Not Ready'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {debugInfo.blockingIssues.length === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-400" />
              )}
              <div>
                <p className="text-sm text-gray-400">Issues</p>
                <p className={`font-semibold ${getStatusColor(debugInfo.blockingIssues.length > 0)}`}>
                  {debugInfo.blockingIssues.length}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Advance Single Participant Matches */}
      {singleParticipantCount > 0 && (
        <Card className="bg-blue-900/20 backdrop-blur-sm border-blue-500/20">
          <CardHeader>
            <CardTitle className="text-blue-400 flex items-center gap-2">
              <Play className="h-5 w-5" />
              Auto-Advance Tool
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200">
                  {singleParticipantCount} matches have only one participant and can be auto-advanced.
                </p>
                <p className="text-blue-300 text-sm mt-1">
                  This will automatically advance single players to the next round to unblock tournament progression.
                </p>
              </div>
              <Button
                onClick={handleAutoAdvance}
                disabled={advancing}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                {advancing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Auto-Advancing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Auto-Advance ({singleParticipantCount})
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Champions Status */}
      {tournament.bracket_type === 'double' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-black/20 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-sm">Winners Bracket Champion</CardTitle>
            </CardHeader>
            <CardContent>
              {debugInfo.winnersChampion ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-white font-medium">
                    {getPlayerName(debugInfo.winnersChampion)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-400" />
                  <span className="text-gray-400">Not determined</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-black/20 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-sm">Losers Bracket Champion</CardTitle>
            </CardHeader>
            <CardContent>
              {debugInfo.losersChampion ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-white font-medium">
                    {getPlayerName(debugInfo.losersChampion)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-400" />
                  <span className="text-gray-400">Not determined</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Blocking Issues */}
      {debugInfo.blockingIssues.length > 0 && (
        <Card className="bg-red-900/20 backdrop-blur-sm border-red-500/20">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Issues Blocking Tournament Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {debugInfo.blockingIssues.map((issue, index) => (
                <div key={index} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-red-200">{issue}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Single Participant Losers Matches - Special Alert */}
      {tournament.bracket_type === 'double' && (() => {
        const singleParticipantLosersMatches = matches.filter(m =>
          m.round >= 100 && m.round < 1000 &&
          !m.winner_participant_id &&
          ((m.participant1_id && !m.participant2_id) || (!m.participant1_id && m.participant2_id))
        );
        return singleParticipantLosersMatches.length > 0 && (
          <Card className="bg-amber-900/20 backdrop-blur-sm border-amber-500/20">
            <CardHeader>
              <CardTitle className="text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Losers Bracket Matches with Only One Player ({singleParticipantLosersMatches.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-amber-200 text-sm mb-3">
                  These matches have only one participant and may need the bracket progression logic to advance them automatically, or they're waiting for opponents from earlier losers rounds.
                </p>
                {singleParticipantLosersMatches.map((match) => (
                  <div key={match.id} className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <div>
                      <p className="text-white font-medium">
                        {getRoundDisplayName(match.round)} - Position {match.position}
                      </p>
                      <p className="text-amber-200 text-sm">
                        Player: {getPlayerName(match.participant1_id || match.participant2_id)} vs (empty slot)
                      </p>
                    </div>
                    <div className="text-amber-300 text-sm">
                      Needs opponent or auto-advance
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Next Required Matches */}
      {debugInfo.nextRequiredMatches.length > 0 && (
        <Card className="bg-blue-900/20 backdrop-blur-sm border-blue-500/20">
          <CardHeader>
            <CardTitle className="text-blue-400 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Next Matches to Play ({debugInfo.nextRequiredMatches.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {debugInfo.nextRequiredMatches.slice(0, 8).map((match) => (
                <div key={match.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div>
                    <p className="text-white font-medium">
                      {getRoundDisplayName(match.round)} - Position {match.position}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {getPlayerName(match.participant1_id)} vs {getPlayerName(match.participant2_id)}
                    </p>
                  </div>
                  <div className="text-yellow-400 text-sm">
                    Waiting for result
                  </div>
                </div>
              ))}
              {debugInfo.nextRequiredMatches.length > 8 && (
                <p className="text-gray-400 text-sm text-center">
                  ...and {debugInfo.nextRequiredMatches.length - 8} more matches
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tournament Complete */}
      {debugInfo.tournamentCompleted && (
        <Card className="bg-green-900/20 backdrop-blur-sm border-green-500/20">
          <CardHeader>
            <CardTitle className="text-green-400 flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Tournament Complete!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-200">
              🎉 The tournament has been completed. Check the analytics dashboard for final statistics.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BracketDebugger;