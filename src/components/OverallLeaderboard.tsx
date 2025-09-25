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
        <span className="text-lg font-bold text-white mb-2 block">Overall Leaders</span>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {displayLeaders.map((player, index) => (
              <div key={player.player_name} className="flex items-center gap-2 py-1 md:flex-row flex-col md:text-left text-center md:justify-start justify-center">
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  {index === 0 ? <span className="text-2xl animate-gold-shine">🏆</span> :
                   index === 1 ? <span className="text-2xl animate-silver-shine">🥈</span> :
                   index === 2 ? <span className="text-2xl animate-bronze-shine">🥉</span> :
                   <span className="text-xs font-bold text-white">#{index + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                      className="font-arcade font-bold text-lg md:text-sm animated-gradient-vertical truncate"
                  >
                    {player.player_name}
                  </div>
                  <div className="text-sm md:text-xs text-gray-400">
                    {player.game_count}g
                </div>
              </div>
              <div
                    className="font-bold font-arcade text-sm md:text-xs animated-gradient-vertical flex-shrink-0"
              >
                {formatScore(player.total_ranking_points)}
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
        <span className="text-lg font-bold text-white mb-2 block">Achievement Hunters</span>
        <div className="space-y-1 max-h-80 overflow-y-auto">
            {displayAchievementHunters.map((hunter, index) => (
              <div key={hunter.player_name} className="flex items-center gap-2 py-1 md:flex-row flex-col md:text-left text-center md:justify-start justify-center">
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  {index === 0 ? <span className="text-2xl">🌟</span> :
                   index === 1 ? <span className="text-2xl">⭐</span> :
                   index === 2 ? <span className="text-2xl">✨</span> :
                   <span className="text-xs font-bold text-white">#{index + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-arcade font-bold text-lg md:text-sm animated-gradient-vertical truncate"
                  >
                    {hunter.player_name}
                  </div>
                  <div className="text-sm md:text-xs text-gray-400">
                    {hunter.achievement_count}a
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