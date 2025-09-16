import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { formatScore } from '@/lib/utils';
import { useTournamentGameData } from '@/hooks/useTournamentGameData';
import { useTournament } from '@/contexts/TournamentContext';
import { useRaspberryPiOptimizations } from '@/hooks/useRaspberryPiOptimizations';

// Memoized rank icon component
const RankIcon = React.memo(({ rank, type = 'standard' }: { rank: number; type?: string }) => {
  if (rank === 0) {
    const emoji = type === 'achievement' ? '🌟' : type === 'demolition' ? '🏆' : '🏆';
    const color = type === 'demolition' ? 'text-red-400' : '';
    return <span className={`w-12 h-12 flex items-center justify-center text-4xl ${color}`}>{emoji}</span>;
  }
  if (rank === 1) {
    const emoji = type === 'achievement' ? '⭐' : type === 'demolition' ? '🥈' : '🥈';
    const color = type === 'demolition' ? 'text-orange-300' : '';
    return <span className={`w-12 h-12 flex items-center justify-center text-4xl ${color}`}>{emoji}</span>;
  }
  if (rank === 2) {
    const emoji = type === 'achievement' ? '✨' : type === 'demolition' ? '🥉' : '🥉';
    const color = type === 'demolition' ? 'text-yellow-600' : '';
    return <span className={`w-12 h-12 flex items-center justify-center text-4xl ${color}`}>{emoji}</span>;
  }

  return <span className="w-12 h-12 flex items-center justify-center text-3xl font-bold text-white">#{rank + 1}</span>;
});

RankIcon.displayName = 'RankIcon';

// Memoized leaderboard item
const LeaderItem = React.memo(({
  player,
  index,
  type = 'standard',
  shouldOptimize
}: {
  player: any;
  index: number;
  type?: string;
  shouldOptimize: boolean;
}) => {
  const gradientClass = shouldOptimize ? 'text-white font-bold' : 'animated-gradient-vertical';

  return (
    <div className="flex items-center gap-3 py-1">
      <RankIcon rank={index} type={type} />
      <div className="flex-1 flex items-baseline">
        <div className="flex-1">
          <div className={`font-arcade font-bold text-lg ${gradientClass}`}>
            {player.player_name}
          </div>
          {type === 'standard' && (
            <div className="text-xs text-gray-400">
              {player.game_count} game{player.game_count !== 1 ? 's' : ''}
            </div>
          )}
          {type === 'achievement' && (
            <div className="text-xs text-gray-400">
              {player.achievement_count} achievement{player.achievement_count !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className={`font-bold font-arcade text-base ${gradientClass}`}>
          {type === 'demolition' ? formatScore(player.score) : formatScore(player.total_ranking_points || 0)}
        </div>
      </div>
    </div>
  );
});

LeaderItem.displayName = 'LeaderItem';

// Optimized main component
const OverallLeaderboardOptimized = React.memo(() => {
  const { leaders, achievementHunters, demolitionManScores, loading } = useTournamentGameData();
  const { currentTournament } = useTournament();
  const { shouldOptimize, throttle } = useRaspberryPiOptimizations();

  // Local state with throttled updates for Pi
  const [displayData, setDisplayData] = useState({
    leaders: leaders,
    achievementHunters: achievementHunters,
    demolitionManScores: demolitionManScores
  });
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  // Throttled update function
  const updateDisplayData = useCallback((newData: any) => {
    if (shouldOptimize) {
      throttle(() => setDisplayData(newData), 500);
    } else {
      setDisplayData(newData);
    }
  }, [shouldOptimize, throttle]);

  // Update display data when source data changes
  useEffect(() => {
    if (!loading && (leaders.length > 0 || achievementHunters.length > 0 || !hasInitialLoad)) {
      const hasChanges =
        JSON.stringify(leaders) !== JSON.stringify(displayData.leaders) ||
        JSON.stringify(achievementHunters) !== JSON.stringify(displayData.achievementHunters) ||
        JSON.stringify(demolitionManScores) !== JSON.stringify(displayData.demolitionManScores);

      if (hasChanges || !hasInitialLoad) {
        updateDisplayData({
          leaders,
          achievementHunters,
          demolitionManScores
        });
        setHasInitialLoad(true);
      }
    }
  }, [leaders, achievementHunters, demolitionManScores, loading, hasInitialLoad, displayData, updateDisplayData]);

  // Memoized sections
  const leadersSection = useMemo(() => (
    <div className="flex-shrink-0">
      <span className="text-xl font-bold text-white mb-3 block">Overall Leaders</span>
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {displayData.leaders.map((player, index) => (
          <LeaderItem
            key={player.player_name}
            player={player}
            index={index}
            type="standard"
            shouldOptimize={shouldOptimize}
          />
        ))}
        {displayData.leaders.length === 0 && hasInitialLoad && (
          <div className="text-center text-gray-400 py-4">No scores found yet.</div>
        )}
      </div>
    </div>
  ), [displayData.leaders, hasInitialLoad, shouldOptimize]);

  const achievementSection = useMemo(() => (
    <div className="flex-shrink-0">
      <span className="text-xl font-bold text-white mb-3 block">Achievement Hunters</span>
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {displayData.achievementHunters.map((hunter, index) => (
          <LeaderItem
            key={hunter.player_name}
            player={hunter}
            index={index}
            type="achievement"
            shouldOptimize={shouldOptimize}
          />
        ))}
        {displayData.achievementHunters.length === 0 && hasInitialLoad && (
          <div className="text-center text-gray-400 py-4">No achievements yet.</div>
        )}
      </div>
    </div>
  ), [displayData.achievementHunters, hasInitialLoad, shouldOptimize]);

  const demolitionSection = useMemo(() => {
    if (!currentTournament?.demolition_man_active) return null;

    return (
      <div className="flex-shrink-0">
        <span className="text-xl font-bold text-white mb-3 block">Demolition Man</span>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {displayData.demolitionManScores.map((score, index) => (
            <LeaderItem
              key={`${score.player_name}-${score.created_at}`}
              player={score}
              index={index}
              type="demolition"
              shouldOptimize={shouldOptimize}
            />
          ))}
          {displayData.demolitionManScores.length === 0 && hasInitialLoad && (
            <div className="text-center text-gray-400 py-4">No Demolition Man scores yet.</div>
          )}
        </div>
      </div>
    );
  }, [displayData.demolitionManScores, currentTournament?.demolition_man_active, hasInitialLoad, shouldOptimize]);

  // Show minimal loading state
  if (loading && !hasInitialLoad) {
    return (
      <div className="p-6">
        <div className="text-center text-white">Loading...</div>
      </div>
    );
  }

  // Simplified animation classes for Pi
  const animationClass = shouldOptimize ? '' : 'animate-slide-in-left';

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      <div className={`${animationClass}`}>
        {leadersSection}
      </div>
      <div className={`${animationClass}`}>
        {achievementSection}
      </div>
      {demolitionSection && (
        <div className={`${animationClass}`}>
          {demolitionSection}
        </div>
      )}
    </div>
  );
});

OverallLeaderboardOptimized.displayName = 'OverallLeaderboardOptimized';

export default OverallLeaderboardOptimized;