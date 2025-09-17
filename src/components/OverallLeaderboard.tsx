import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { Trophy, Medal, Award, Star } from "lucide-react";
import { formatScore } from '@/lib/utils';
import { useTournamentGameData } from '@/hooks/useTournamentGameData';
import { useTournament } from '@/contexts/TournamentContext';

const OverallLeaderboard = React.memo(() => {
  const { leaders, achievementHunters, loading } = useTournamentGameData();
  const { currentTournament } = useTournament();

  // Local state to prevent flickering during updates
  const [displayLeaders, setDisplayLeaders] = useState(leaders);
  const [displayAchievementHunters, setDisplayAchievementHunters] = useState(achievementHunters);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  // Update display data using efficient shallow comparisons instead of expensive JSON.stringify
  useEffect(() => {
    if (!loading && (leaders.length > 0 || !hasInitialLoad)) {
      // Efficient shallow comparison
      const leadersChanged = leaders.length !== displayLeaders.length ||
        leaders.some((leader, i) => leader.player_name !== displayLeaders[i]?.player_name);
      if (leadersChanged || !hasInitialLoad) {
        setDisplayLeaders(leaders);
      }
      setHasInitialLoad(true);
    }
  }, [leaders, loading, hasInitialLoad, displayLeaders]);

  useEffect(() => {
    if (!loading && (achievementHunters.length > 0 || !hasInitialLoad)) {
      const huntersChanged = achievementHunters.length !== displayAchievementHunters.length ||
        achievementHunters.some((hunter, i) => hunter.player_name !== displayAchievementHunters[i]?.player_name);
      if (huntersChanged || !hasInitialLoad) {
        setDisplayAchievementHunters(achievementHunters);
      }
    }
  }, [achievementHunters, loading, hasInitialLoad, displayAchievementHunters]);


  const getRankIcon = useCallback((index: number) => {
    switch (index) {
      case 0:
        return <span className="w-12 h-12 flex items-center justify-center text-4xl animate-gold-shine">🏆</span>;
      case 1:
        return <span className="w-12 h-12 flex items-center justify-center text-4xl animate-silver-shine">🥈</span>;
      case 2:
        return <span className="w-12 h-12 flex items-center justify-center text-4xl animate-bronze-shine">🥉</span>;
      default:
        return <span className="w-12 h-12 flex items-center justify-center text-3xl font-bold text-white">#{index + 1}</span>;
    }
  }, []);

  const getAchievementRankIcon = useCallback((index: number) => {
    switch (index) {
      case 0:
        return <span className="w-12 h-12 flex items-center justify-center text-4xl">🌟</span>;
      case 1:
        return <span className="w-12 h-12 flex items-center justify-center text-4xl">⭐</span>;
      case 2:
        return <span className="w-12 h-12 flex items-center justify-center text-4xl">✨</span>;
      default:
        return <span className="w-12 h-12 flex items-center justify-center text-3xl font-bold text-white">#{index + 1}</span>;
    }
  }, []);


  // Only show loading on initial load, not on subsequent updates
  if (loading && !hasInitialLoad) {
    return (
      <div className="p-6">
          <div className="text-center text-white">Loading leaders...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      {/* Overall Leaders */}
      <div className="flex-shrink-0 animate-slide-in-left animation-delay-400">
        <span className="text-xl font-bold text-white mb-3 block">Overall Leaders</span>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {displayLeaders.map((player, index) => (
              <div key={player.player_name} className="flex items-center gap-3 py-1">
                {getRankIcon(index)}
                <div className="flex-1 flex items-baseline">
                  <div className="flex-1">
                  <div 
                      className="font-arcade font-bold text-lg animated-gradient-vertical"
                  >
                    {player.player_name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {player.game_count} game{player.game_count !== 1 ? 's' : ''}
                </div>
              </div>
              <div 
                    className="font-bold font-arcade text-base animated-gradient-vertical"
              >
                {formatScore(player.total_ranking_points)}
                  </div>
              </div>
            </div>
          ))}
          {displayLeaders.length === 0 && hasInitialLoad && (
              <div className="text-center text-gray-400 py-4">
              No scores found yet.
            </div>
          )}
        </div>
      </div>

      {/* Achievement Hunters */}
      <div className="flex-shrink-0 animate-slide-in-left animation-delay-600">
        <span className="text-xl font-bold text-white mb-3 block">Achievement Hunters</span>
        <div className="space-y-1 max-h-80 overflow-y-auto">
            {displayAchievementHunters.map((hunter, index) => (
              <div key={hunter.player_name} className="flex items-center gap-3 py-1">
                {getAchievementRankIcon(index)}
                <div>
                  <div 
                    className="font-arcade font-bold text-lg animated-gradient-vertical"
                  >
                    {hunter.player_name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {hunter.achievement_count} achievement{hunter.achievement_count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
            {displayAchievementHunters.length === 0 && hasInitialLoad && (
              <div className="text-center text-gray-400 py-4">
                No achievements yet.
              </div>
            )}
        </div>
      </div>

    </div>
  );
});

OverallLeaderboard.displayName = 'OverallLeaderboard';

export default OverallLeaderboard;