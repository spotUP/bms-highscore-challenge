import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { dlog } from '@/lib/debug';

interface PerformanceInfo {
  isLowEnd: boolean;
  isRaspberryPi: boolean;
  isPerformanceMode: boolean;
  enableAnimations: boolean;
  particleCount: number;
  refreshInterval: number;
  enableBlur: boolean;
  enableGradients: boolean;
  enableTransitions: boolean;
  togglePerformanceMode: (enabled: boolean) => void;
}

// Detect if we're running on a Raspberry Pi or low-end device
const detectRaspberryPi = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';
  
  // Check for ARM architecture indicators
  const isARM = platform.includes('arm') || 
                userAgent.includes('armv') ||
                userAgent.includes('aarch64');
  
  // Check for Raspberry Pi specific indicators
  const isRPi = userAgent.includes('raspbian') ||
                userAgent.includes('raspberry') ||
                platform.includes('linux arm');
  
  // Check for Chromium on Linux (common Pi setup)
  const isChromiumLinux = userAgent.includes('chromium') && 
                          userAgent.includes('linux');
  
  return isRPi || (isARM && isChromiumLinux);
};

// Detect low-end device based on various metrics
const detectLowEndDevice = (): boolean => {
  // Check hardware concurrency (CPU cores)
  const cores = navigator.hardwareConcurrency || 1;
  if (cores <= 4) return true;
  
  // Check memory (if available)
  const memory = (navigator as any).deviceMemory;
  if (memory && memory <= 4) return true;
  
  // Check for slow canvas performance
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      ctx.fillRect(Math.random() * 100, Math.random() * 100, 10, 10);
    }
    const renderTime = performance.now() - start;
    
    // If it takes more than 50ms to render 1000 rects, it's slow
    return renderTime > 50;
  } catch {
    return true;
  }
};

export const usePerformanceMode = (): PerformanceInfo => {
  const queryClient = useQueryClient();
  const [performanceInfo, setPerformanceInfo] = useState<PerformanceInfo>({
    isLowEnd: false,
    isRaspberryPi: false,
    isPerformanceMode: false,
    enableAnimations: true,
    particleCount: 800,
    refreshInterval: 30000,
    enableBlur: true,
    enableGradients: true,
    enableTransitions: true,
    togglePerformanceMode: (enabled: boolean) => {
      localStorage.setItem('performance-mode', enabled ? 'enabled' : 'disabled');
      // Force re-render by updating state instead of reloading
      setPerformanceInfo(prev => ({ ...prev, isPerformanceMode: enabled }));
    },
  });

  useEffect(() => {
    const isRaspberryPi = detectRaspberryPi();
    const isLowEnd = isRaspberryPi || detectLowEndDevice();
    
    // Also check for user preference
    const userPreference = localStorage.getItem('performance-mode');
    const forcePerformanceMode = userPreference === 'enabled';
    
    const shouldOptimize = isLowEnd || forcePerformanceMode;
    
    dlog('Performance Detection:', {
      isRaspberryPi,
      isLowEnd,
      forcePerformanceMode,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      cores: navigator.hardwareConcurrency,
      memory: (navigator as any).deviceMemory
    });

    setPerformanceInfo({
      isLowEnd,
      isRaspberryPi,
      isPerformanceMode: shouldOptimize,
      enableAnimations: !shouldOptimize,
      particleCount: shouldOptimize ? 200 : 800, // Further reduce for Pi
      refreshInterval: shouldOptimize ? 60000 : 30000, // Less frequent updates
      enableBlur: !shouldOptimize,
      enableGradients: !shouldOptimize,
      enableTransitions: !shouldOptimize,
      togglePerformanceMode: (enabled: boolean) => {
        localStorage.setItem('performance-mode', enabled ? 'enabled' : 'disabled');
        // Update state to trigger re-render with new performance settings
        setPerformanceInfo(prev => ({ ...prev, isPerformanceMode: enabled }));
        // Broadcast so other hook consumers update too
        window.dispatchEvent(new CustomEvent('performanceModeChanged', { detail: { enabled } }));
      },
    });
  }, []);

  // Listen for global performance mode changes (broadcast by togglePerformanceMode)
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const custom = e as CustomEvent<{ enabled: boolean }>;
        const enabled = !!custom.detail?.enabled;
        setPerformanceInfo(prev => ({
          ...prev,
          isPerformanceMode: enabled,
          enableAnimations: !enabled,
          particleCount: enabled ? 200 : 800,
          refreshInterval: enabled ? 60000 : 30000,
          enableBlur: !enabled,
          enableGradients: !enabled,
          enableTransitions: !enabled,
        }));
      } catch {}
    };
    window.addEventListener('performanceModeChanged', handler as EventListener);
    return () => {
      window.removeEventListener('performanceModeChanged', handler as EventListener);
    };
  }, []);

  return performanceInfo;
};

// Helper function to toggle performance mode manually
export const togglePerformanceMode = (enabled: boolean) => {
  localStorage.setItem('performance-mode', enabled ? 'enabled' : 'disabled');
  // Dispatch a custom event to notify components of the change
  window.dispatchEvent(new CustomEvent('performanceModeChanged', { detail: { enabled } }));
};
