import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Users, Target, Clock, TrendingUp, Award } from 'lucide-react';
import { Tournament, TournamentPlayer, TournamentMatch } from '@/contexts/BracketContext';

interface BracketAnalyticsProps {
  tournament: Tournament;
  players: TournamentPlayer[];
  matches: TournamentMatch[];
}

interface PlayerStats {
  id: string;
  name: string;
  wins: number;
  losses: number;
  winRate: number;
  roundsReached: number;
  isEliminated: boolean;
  isChampion: boolean;
}

interface TournamentStats {
  totalMatches: number;
  completedMatches: number;
  remainingMatches: number;
  completionRate: number;
  totalRounds: number;
  currentRound: number;
  averageMatchesPerRound: number;
  eliminatedPlayers: number;
  activePlayerCount: number;
}

const BracketAnalytics: React.FC<BracketAnalyticsProps> = ({ tournament, players, matches }) => {
  // Calculate player statistics
  const playerStats = useMemo((): PlayerStats[] => {
    const stats = players.map(player => {
      const playerMatches = matches.filter(m =>
        m.participant1_id === player.id || m.participant2_id === player.id
      );

      const wins = playerMatches.filter(m => m.winner_participant_id === player.id).length;
      const losses = playerMatches.filter(m =>
        m.winner_participant_id && m.winner_participant_id !== player.id
      ).length;

      const winRate = playerMatches.length > 0 ? (wins / playerMatches.length) * 100 : 0;

      // Calculate highest round reached
      const roundsReached = Math.max(
        ...playerMatches.map(m => {
          if (tournament.bracket_type === 'double') {
            if (m.round >= 1000) return 1000; // Grand finals
            if (m.round >= 100) return m.round - 100 + 1; // Losers bracket
            return m.round; // Winners bracket
          }
          return m.round;
        }),
        0
      );

      const isEliminated = losses > 0 && (
        tournament.bracket_type === 'single' ||
        (tournament.bracket_type === 'double' && losses >= 2)
      );

      // Check if player is champion (won the final match)
      const finalMatch = matches.find(m =>
        (m.round === 1000 || (tournament.bracket_type === 'single' && m.round === Math.max(...matches.map(match => match.round))))
        && m.winner_participant_id === player.id
      );
      const isChampion = !!finalMatch;

      return {
        id: player.id,
        name: player.name,
        wins,
        losses,
        winRate,
        roundsReached,
        isEliminated,
        isChampion
      };
    });

    return stats.sort((a, b) => {
      if (a.isChampion) return -1;
      if (b.isChampion) return 1;
      if (a.wins !== b.wins) return b.wins - a.wins;
      return b.winRate - a.winRate;
    });
  }, [players, matches, tournament.bracket_type]);

  // Calculate tournament statistics
  const tournamentStats = useMemo((): TournamentStats => {
    const totalMatches = matches.length;
    const completedMatches = matches.filter(m => m.winner_participant_id).length;
    const remainingMatches = totalMatches - completedMatches;
    const completionRate = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;

    const rounds = matches.map(m => m.round);
    const totalRounds = Math.max(...rounds, 0);
    const currentRound = Math.max(...matches.filter(m => m.winner_participant_id).map(m => m.round), 0);

    const averageMatchesPerRound = totalRounds > 0 ? totalMatches / totalRounds : 0;
    const eliminatedPlayers = playerStats.filter(p => p.isEliminated).length;
    const activePlayerCount = players.length - eliminatedPlayers;

    return {
      totalMatches,
      completedMatches,
      remainingMatches,
      completionRate,
      totalRounds,
      currentRound,
      averageMatchesPerRound,
      eliminatedPlayers,
      activePlayerCount
    };
  }, [matches, playerStats, players.length]);

  // Get bracket type info
  const bracketTypeInfo = {
    single: { name: 'Single Elimination', description: 'One loss eliminates a player' },
    double: { name: 'Double Elimination', description: 'Players must lose twice to be eliminated' }
  };

  const bracketInfo = bracketTypeInfo[tournament.bracket_type] || bracketTypeInfo.single;

  return (
    <div className="space-y-6">
      {/* Tournament Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-black/20 backdrop-blur-sm border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Tournament Status</p>
                <p className="text-2xl font-bold text-white capitalize">{tournament.status}</p>
              </div>
              <Trophy className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/20 backdrop-blur-sm border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Players</p>
                <p className="text-2xl font-bold text-white">{players.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/20 backdrop-blur-sm border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Completion Rate</p>
                <p className="text-2xl font-bold text-white">{tournamentStats.completionRate.toFixed(1)}%</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/20 backdrop-blur-sm border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Matches Left</p>
                <p className="text-2xl font-bold text-white">{tournamentStats.remainingMatches}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tournament Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-black/20 backdrop-blur-sm border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tournament Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>Matches Completed</span>
                <span>{tournamentStats.completedMatches} / {tournamentStats.totalMatches}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${tournamentStats.completionRate}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Bracket Type</p>
                <p className="text-white font-semibold">{bracketInfo.name}</p>
                <p className="text-gray-500 text-xs">{bracketInfo.description}</p>
              </div>
              <div>
                <p className="text-gray-400">Active Players</p>
                <p className="text-white font-semibold">{tournamentStats.activePlayerCount}</p>
                <p className="text-gray-500 text-xs">{tournamentStats.eliminatedPlayers} eliminated</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/20 backdrop-blur-sm border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Award className="h-5 w-5" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {playerStats.slice(0, 5).map((player, index) => (
                <div key={player.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500 text-black' :
                      index === 1 ? 'bg-gray-300 text-black' :
                      index === 2 ? 'bg-orange-600 text-white' :
                      'bg-gray-600 text-white'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-white font-medium">{player.name}</p>
                      <p className="text-gray-400 text-xs">
                        {player.wins}W - {player.losses}L
                        {player.isChampion && ' 👑'}
                        {player.isEliminated && ' ❌'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">{player.winRate.toFixed(0)}%</p>
                    <p className="text-gray-400 text-xs">Round {player.roundsReached}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Player Statistics */}
      <Card className="bg-black/20 backdrop-blur-sm border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Player Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 py-2">Player</th>
                  <th className="text-center text-gray-400 py-2">Wins</th>
                  <th className="text-center text-gray-400 py-2">Losses</th>
                  <th className="text-center text-gray-400 py-2">Win Rate</th>
                  <th className="text-center text-gray-400 py-2">Best Round</th>
                  <th className="text-center text-gray-400 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map((player) => (
                  <tr key={player.id} className="border-b border-gray-800 hover:bg-white/5">
                    <td className="py-2 text-white font-medium">{player.name}</td>
                    <td className="text-center text-green-400">{player.wins}</td>
                    <td className="text-center text-red-400">{player.losses}</td>
                    <td className="text-center text-white">{player.winRate.toFixed(1)}%</td>
                    <td className="text-center text-blue-400">Round {player.roundsReached}</td>
                    <td className="text-center">
                      {player.isChampion ? (
                        <span className="text-yellow-400 font-bold">Champion 👑</span>
                      ) : player.isEliminated ? (
                        <span className="text-red-400">Eliminated</span>
                      ) : (
                        <span className="text-green-400">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BracketAnalytics;