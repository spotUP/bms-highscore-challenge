import React, { useMemo, useCallback } from 'react';
import { Trophy, Medal, Award, Star } from "lucide-react";
import { formatScore } from '@/lib/utils';
import { useTournamentGameData } from '@/hooks/useTournamentGameData';
import { useTournament } from '@/contexts/TournamentContext';

const OverallLeaderboard = React.memo(() => {
  const { leaders, achievementHunters, demolitionManScores, loading } = useTournamentGameData();
  const { currentTournament } = useTournament();

  const getRankIcon = useCallback((index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-12 h-12 text-yellow-400 animate-gold-shine" />;
      case 1:
        return <Medal className="w-12 h-12 text-gray-300 animate-silver-shine" />;
      case 2:
        return <Award className="w-12 h-12 text-orange-600 animate-bronze-shine" />;
      default:
        return <span className="w-12 h-12 flex items-center justify-center text-3xl font-bold text-white">#{index + 1}</span>;
    }
  }, []);

  const getAchievementRankIcon = useCallback((index: number) => {
    switch (index) {
      case 0:
        return <Star className="w-12 h-12 text-pink-400" />;
      case 1:
        return <Star className="w-12 h-12 text-purple-300" />;
      case 2:
        return <Star className="w-12 h-12 text-indigo-600" />;
      default:
        return <span className="w-12 h-12 flex items-center justify-center text-3xl font-bold text-white">#{index + 1}</span>;
    }
  }, []);

  const getDemolitionRankIcon = useCallback((index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-12 h-12 text-red-400" />;
      case 1:
        return <Medal className="w-12 h-12 text-orange-300" />;
      case 2:
        return <Award className="w-12 h-12 text-yellow-600" />;
      default:
        return <span className="w-12 h-12 flex items-center justify-center text-3xl font-bold text-white">#{index + 1}</span>;
    }
  }, []);

  if (loading) {
    return (
      <div className="p-6">
          <div className="text-center text-white">Loading leaders...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      {/* Overall Leaders */}
      <div className="flex-shrink-0">
        <span className="text-xl font-bold text-white mb-3 block">Overall Leaders</span>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {leaders.map((player, index) => (
              <div key={player.player_name} className="flex items-center gap-3 py-1">
                {getRankIcon(index)}
                <div className="flex-1 flex items-baseline">
                  <div className="flex-1">
                  <div 
                      className="font-arcade font-bold text-lg animated-gradient"
                    style={{ animationDelay: `${index * 0.15}s` }}
                  >
                    {player.player_name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {player.game_count} game{player.game_count !== 1 ? 's' : ''}
                </div>
              </div>
              <div 
                    className="font-bold font-arcade text-base animated-gradient"
                style={{ animationDelay: `${index * 0.15 + 0.3}s` }}
              >
                {formatScore(player.total_ranking_points)}
                  </div>
              </div>
            </div>
          ))}
          {leaders.length === 0 && (
              <div className="text-center text-gray-400 py-4">
              No scores found yet.
            </div>
          )}
        </div>
      </div>

      {/* Achievement Hunters */}
      <div className="flex-shrink-0">
        <span className="text-xl font-bold text-white mb-3 block">Achievement Hunters</span>
        <div className="space-y-1 max-h-80 overflow-y-auto">
            {achievementHunters.map((hunter, index) => (
              <div key={hunter.player_name} className="flex items-center gap-3 py-1">
                {getAchievementRankIcon(index)}
                <div>
                  <div 
                    className="font-arcade font-bold text-lg animated-gradient"
                    style={{ animationDelay: `${index * 0.15}s` }}
                  >
                    {hunter.player_name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {hunter.achievement_count} achievement{hunter.achievement_count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
            {achievementHunters.length === 0 && (
              <div className="text-center text-gray-400 py-4">
                No achievements yet.
              </div>
            )}
        </div>
      </div>

      {/* Demolition Man Eternal Leaderboard - Only show if enabled */}
      {currentTournament?.demolition_man_active && (
        <div className="flex-shrink-0">
          <span className="text-xl font-bold text-white mb-3 block">Demolition Man</span>
          <div className="space-y-1 max-h-80 overflow-y-auto">
              {demolitionManScores.map((score, index) => (
                <div key={`${score.player_name}-${score.created_at}`} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    {getDemolitionRankIcon(index)}
                    <div 
                      className="font-arcade font-bold text-lg animated-gradient"
                      style={{ animationDelay: `${index * 0.15}s` }}
                    >
                      {score.player_name}
                    </div>
                  </div>
                  <div 
                    className="text-right font-bold font-arcade text-base animated-gradient"
                    style={{ animationDelay: `${index * 0.15 + 0.3}s` }}
                  >
                    {formatScore(score.score)}
                  </div>
                </div>
              ))}
              {demolitionManScores.length === 0 && (
                <div className="text-center text-gray-400 py-4">
                  No Demolition Man scores yet.
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
});

OverallLeaderboard.displayName = 'OverallLeaderboard';

export default OverallLeaderboard;