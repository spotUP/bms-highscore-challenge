import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { formatScore } from '@/lib/utils';
import { useTournamentGameData } from '@/hooks/useTournamentGameData';
import { useTournament } from '@/contexts/TournamentContext';
import { useRaspberryPiOptimizations } from '@/hooks/useRaspberryPiOptimizations';

// Memoized rank icon component
const RankIcon = React.memo(({ rank, type = 'standard' }: { rank: number; type?: string }) => {
  if (rank === 0) {
    const emoji = type === 'achievement' ? '🌟' : '🏆';
    return <span className="w-8 h-8 flex items-center justify-center text-2xl">{emoji}</span>;
  }
  if (rank === 1) {
    const emoji = type === 'achievement' ? '⭐' : '🥈';
    return <span className="w-8 h-8 flex items-center justify-center text-2xl">{emoji}</span>;
  }
  if (rank === 2) {
    const emoji = type === 'achievement' ? '✨' : '🥉';
    return <span className="w-8 h-8 flex items-center justify-center text-2xl">{emoji}</span>;
  }

  return <span className="w-8 h-8 flex items-center justify-center text-sm font-bold text-white">#{rank + 1}</span>;
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
  const waveDelay = index * 0.3;

  return (
    <div className="flex items-center gap-2 py-1">
      <RankIcon rank={index} type={type} />
      <div className="flex-1 min-w-0">
        <div
          className={`font-arcade font-bold text-sm ${gradientClass} truncate`}
          style={{ '--wave-delay': `${waveDelay}s` } as React.CSSProperties}
        >
          {player.player_name}
        </div>
        {type === 'standard' ? (
          <div className="text-xs text-gray-400">
            {player.game_count}g
          </div>
        ) : (
          <div className="text-xs text-gray-400">
            {player.achievement_count}a
          </div>
        )}
          {type === 'achievement' && (
            <div className="text-xs text-gray-400">
              {player.achievement_count} achievement{player.achievement_count !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div
          className={`font-bold font-arcade text-base ${gradientClass}`}
          style={{ '--wave-delay': `${waveDelay}s` } as React.CSSProperties}
        >
          {type === 'demolition' ? formatScore(player.score) : formatScore(player.total_ranking_points || 0)}
        </div>
      </div>
    </div>
  );
});

LeaderItem.displayName = 'LeaderItem';

// Optimized main component
const OverallLeaderboardOptimized = React.memo(() => {
  const { leaders, achievementHunters, loading } = useTournamentGameData();
  const { currentTournament } = useTournament();
  const { shouldOptimize, throttle } = useRaspberryPiOptimizations();

  // TODO: Add demolition man scores when implemented
  const demolitionManScores = useMemo(() => [], []);

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

  // Update display data when source data changes (using efficient shallow comparison)
  useEffect(() => {
    if (!loading && (leaders.length > 0 || achievementHunters.length > 0 || !hasInitialLoad)) {
      // Efficient shallow comparison instead of expensive JSON.stringify
      const hasChanges =
        leaders.length !== displayData.leaders.length ||
        achievementHunters.length !== displayData.achievementHunters.length ||
        demolitionManScores.length !== displayData.demolitionManScores.length ||
        leaders.some((leader, i) => leader.player_name !== displayData.leaders[i]?.player_name) ||
        achievementHunters.some((hunter, i) => hunter.player_name !== displayData.achievementHunters[i]?.player_name) ||
        demolitionManScores.some((score, i) => score.player_name !== displayData.demolitionManScores[i]?.player_name);

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
      <span className="text-lg font-bold text-white mb-2 block">Overall Leaders</span>
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
      <span className="text-lg font-bold text-white mb-2 block">Achievement Hunters</span>
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