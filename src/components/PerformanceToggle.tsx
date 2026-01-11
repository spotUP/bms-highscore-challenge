import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Monitor, Cpu, Zap, Settings } from 'lucide-react';
import { togglePerformanceMode, usePerformanceMode } from '@/hooks/usePerformanceMode';

const PerformanceToggle: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const currentMode = localStorage.getItem('performance-mode');
  const isPerformanceMode = currentMode === 'enabled';
  const {
    isLowEnd,
    isRaspberryPi,
    enableAnimations,
    particleCount,
    refreshInterval,
    enableBlur,
    enableGradients,
    enableTransitions,
  } = usePerformanceMode();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = () => {
    togglePerformanceMode(!isPerformanceMode);
  };

  // Don't render until mounted to avoid hydration issues
  if (!mounted) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-blue-400" />
          <div>
            <p className="text-sm text-gray-300">
              Optimize rendering performance for Raspberry Pi and low-end devices
            </p>
          </div>
        </div>
        <Button
          onClick={handleToggle}
          variant={isPerformanceMode ? "default" : "outline"}
          className="min-w-[140px]"
        >
          {isPerformanceMode ? 'Disable' : 'Enable'} Performance Mode
        </Button>
      </div>

      {/* Device Detection Status */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-blue-400" />
              <div className="text-sm">
                <div className="text-gray-300">Device Type</div>
                <div className="flex gap-2 mt-1">
                  {isRaspberryPi && <Badge variant="secondary" className="text-xs">Raspberry Pi</Badge>}
                  {isLowEnd && <Badge variant="outline" className="text-xs">Low-end Device</Badge>}
                  {!isLowEnd && !isRaspberryPi && <Badge variant="default" className="text-xs">Standard Device</Badge>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-green-400" />
              <div className="text-sm">
                <div className="text-gray-300">Performance Status</div>
                <div className="flex gap-2 mt-1">
                  {isPerformanceMode ? (
                    <Badge variant="default" className="text-xs bg-green-600">Optimized</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400">Standard</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <div className="text-sm">
                <div className="text-gray-300">Refresh Rate</div>
                <div className="text-xs text-gray-400 mt-1">
                  {refreshInterval / 1000}s intervals
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Settings Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-gray-400">Animations</div>
          <div className={enableAnimations ? "text-green-400" : "text-red-400"}>
            {enableAnimations ? "Enabled" : "Disabled"}
          </div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-gray-400">Particles</div>
          <div className="text-blue-400">{particleCount}</div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-gray-400">Blur Effects</div>
          <div className={enableBlur ? "text-green-400" : "text-red-400"}>
            {enableBlur ? "Enabled" : "Disabled"}
          </div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-gray-400">Transitions</div>
          <div className={enableTransitions ? "text-green-400" : "text-red-400"}>
            {enableTransitions ? "Enabled" : "Disabled"}
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-xs text-gray-500 bg-gray-800/20 rounded-lg p-3">
        <div className="font-medium text-gray-400 mb-1">Performance Mode Benefits:</div>
        <ul className="space-y-1 list-disc list-inside">
          <li>Reduces particle count from 800 to 200 (-75% CPU usage)</li>
          <li>Disables animations and transitions (smoother rendering)</li>
          <li>Removes blur effects and gradients (faster GPU rendering)</li>
          <li>Increases refresh intervals (reduced network load)</li>
          <li>Optimizes for Raspberry Pi 4 ARM architecture</li>
        </ul>
      </div>

      {/* Current Status */}
      <div className="text-sm">
        <div className={`flex items-center gap-2 ${isPerformanceMode ? 'text-green-400' : 'text-yellow-400'}`}>
          {isPerformanceMode ? '✓' : '⚠'} 
          {isPerformanceMode ? (
            <span>Performance mode is active - optimized for {isRaspberryPi ? 'Raspberry Pi' : 'low-end devices'}</span>
          ) : (
            <span>Standard mode - may experience performance issues on {isRaspberryPi ? 'Raspberry Pi' : 'ARM devices'}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceToggle;
