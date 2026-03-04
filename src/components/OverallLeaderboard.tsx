import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { Trophy, Medal, Award, Star, Sparkles } from "lucide-react";
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
        return <Trophy className="w-8 h-8 text-yellow-400 animate-gold-shine" />;
      case 1:
        return <Medal className="w-8 h-8 text-gray-400 animate-silver-shine" />;
      case 2:
        return <Medal className="w-8 h-8 text-amber-600 animate-bronze-shine" />;
      default:
        return <span className="w-12 h-12 flex items-center justify-center text-3xl font-bold text-white">#{index + 1}</span>;
    }
  }, []);

  const getAchievementRankIcon = useCallback((index: number) => {
    switch (index) {
      case 0:
        return <Sparkles className="w-8 h-8 text-yellow-300" />;
      case 1:
        return <Star className="w-8 h-8 text-yellow-400" />;
      case 2:
        return <Sparkles className="w-8 h-8 text-yellow-200" />;
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
              <div key={player.player_name} className="flex items-center gap-2 py-1 text-center md:text-left">
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  {index === 0 ? <Trophy className="w-6 h-6 inline text-yellow-400 animate-gold-shine" /> :
                   index === 1 ? <Medal className="w-6 h-6 inline text-gray-400 animate-silver-shine" /> :
                   index === 2 ? <Medal className="w-6 h-6 inline text-amber-600 animate-bronze-shine" /> :
                   <span className="text-xs font-bold text-white">#{index + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                      className="font-arcade font-bold text-sm animated-gradient-vertical truncate"
                  >
                    {player.player_name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {player.game_count} {player.game_count === 1 ? 'game' : 'games'}
                </div>
              </div>
              <div
                    className="font-bold font-arcade text-xs animated-gradient-vertical flex-shrink-0"
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
              <div key={hunter.player_name} className="flex items-center gap-2 py-1 text-center md:text-left">
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  {index === 0 ? <Sparkles className="w-6 h-6 inline text-yellow-300" /> :
                   index === 1 ? <Star className="w-6 h-6 inline text-yellow-400" /> :
                   index === 2 ? <Sparkles className="w-6 h-6 inline text-yellow-200" /> :
                   <span className="text-xs font-bold text-white">#{index + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-arcade font-bold text-sm animated-gradient-vertical truncate"
                  >
                    {hunter.player_name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {hunter.achievement_count} {hunter.achievement_count === 1 ? 'achievement' : 'achievements'}
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