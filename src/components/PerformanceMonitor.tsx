import React, { useState, useEffect, useCallback } from 'react';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';

interface PerformanceStats {
  fps: number;
  memory: number;
  loadTime: number;
}

const PerformanceMonitor: React.FC = () => {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 60,
    memory: 0,
    loadTime: 0
  });
  const [isVisible, setIsVisible] = useState(false);
  const { isRaspberryPi, isLowEnd } = usePerformanceMode();

  // Calculate FPS
  useEffect(() => {
    if (!isVisible) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));

        // Get memory usage if available
        const memory = (performance as any).memory
          ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
          : 0;

        setStats(prev => ({
          ...prev,
          fps,
          memory
        }));

        frameCount = 0;
        lastTime = currentTime;
      }

      rafId = requestAnimationFrame(measureFPS);
    };

    rafId = requestAnimationFrame(measureFPS);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isVisible]);

  // Measure page load time
  useEffect(() => {
    const loadTime = performance.timing
      ? performance.timing.loadEventEnd - performance.timing.navigationStart
      : 0;

    setStats(prev => ({
      ...prev,
      loadTime: Math.round(loadTime)
    }));
  }, []);

  // Toggle visibility with keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + P to toggle performance monitor
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (!isVisible) return null;

  const getFPSColor = (fps: number) => {
    if (fps >= 50) return 'text-green-400';
    if (fps >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getMemoryColor = (memory: number) => {
    if (memory < 100) return 'text-green-400';
    if (memory < 200) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg font-mono text-xs z-50 backdrop-blur-sm">
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-4">
          <span>FPS:</span>
          <span className={getFPSColor(stats.fps)}>{stats.fps}</span>
        </div>
        {stats.memory > 0 && (
          <div className="flex justify-between gap-4">
            <span>Memory:</span>
            <span className={getMemoryColor(stats.memory)}>{stats.memory}MB</span>
          </div>
        )}
        {stats.loadTime > 0 && (
          <div className="flex justify-between gap-4">
            <span>Load:</span>
            <span>{stats.loadTime}ms</span>
          </div>
        )}
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-600">
          <span>Device:</span>
          <span className="text-gray-400">
            {isRaspberryPi ? 'Pi' : isLowEnd ? 'Low-end' : 'Standard'}
          </span>
        </div>
      </div>
      <div className="text-[10px] text-gray-500 mt-2">
        Ctrl+Shift+P to toggle
      </div>
    </div>
  );
};

export default PerformanceMonitor;