import React, { lazy, Suspense } from 'react';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';

// Lazy load both versions
const OverallLeaderboard = lazy(() => import('./OverallLeaderboard'));
const OverallLeaderboardOptimized = lazy(() => import('./OverallLeaderboardOptimized'));

const LoadingFallback = () => (
  <div className="p-4 text-center text-gray-400">Loading leaderboard...</div>
);

const DynamicOverallLeaderboard: React.FC = () => {
  const { isPerformanceMode, isRaspberryPi, isLowEnd } = usePerformanceMode();

  // Use optimized version for performance mode, Pi, or low-end devices
  const shouldUseOptimized = isPerformanceMode || isRaspberryPi || isLowEnd;

  const Component = shouldUseOptimized ? OverallLeaderboardOptimized : OverallLeaderboard;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Component />
    </Suspense>
  );
};

export default DynamicOverallLeaderboard;