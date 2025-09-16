import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';

interface ManualRefreshButtonProps {
  onRefresh: () => void;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const ManualRefreshButton: React.FC<ManualRefreshButtonProps> = ({
  onRefresh,
  className = '',
  size = 'sm'
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isPerformanceMode, isRaspberryPi, isLowEnd } = usePerformanceMode();

  // Show button for performance mode users (especially Pi users)
  const shouldShow = isPerformanceMode || isRaspberryPi || isLowEnd;

  // Also detect Firefox on Linux ARM
  const userAgent = navigator.userAgent.toLowerCase();
  const isFirefoxLinux = userAgent.includes('firefox') && userAgent.includes('linux');
  const isARM = userAgent.includes('aarch64') || userAgent.includes('armv');
  const isPiFirefox = isFirefoxLinux && isARM;

  if (!shouldShow && !isPiFirefox) {
    return null;
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    console.log('Manual refresh triggered');

    try {
      await onRefresh();
    } catch (error) {
      console.error('Manual refresh failed:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`${className} ${isRefreshing ? 'animate-spin' : ''} border-cyan-500 text-cyan-400 hover:bg-cyan-500/20`}
      title={isPiFirefox ? 'Manual refresh for Pi users' : 'Refresh scores and leaderboard'}
    >
      <RefreshCw className={`w-4 h-4 ${size !== 'icon' ? 'mr-2' : ''}`} />
      {size !== 'icon' && (isRefreshing ? 'Refreshing...' : 'Refresh')}
    </Button>
  );
};

export default ManualRefreshButton;