import React, { lazy, Suspense, useMemo } from 'react';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';

// Lazy load both versions
const OverallLeaderboard = lazy(() => import('./OverallLeaderboard'));
const OverallLeaderboardOptimized = lazy(() => import('./OverallLeaderboardOptimized'));

const LoadingFallback = () => (
  <div className="p-4 text-center text-gray-400">Loading leaderboard...</div>
);

const DynamicOverallLeaderboard: React.FC = () => {
  const { isPerformanceMode, isRaspberryPi, isLowEnd } = usePerformanceMode();

  const Component = useMemo(() => {
    const shouldUseOptimized = isPerformanceMode || isRaspberryPi || isLowEnd;
    return shouldUseOptimized ? OverallLeaderboardOptimized : OverallLeaderboard;
  }, [isPerformanceMode, isRaspberryPi, isLowEnd]);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Component />
    </Suspense>
  );
};

export default DynamicOverallLeaderboard;