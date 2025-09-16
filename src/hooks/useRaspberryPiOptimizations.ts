import { useEffect, useCallback, useRef } from 'react';
import { usePerformanceMode } from './usePerformanceMode';

interface OptimizationConfig {
  disableAnimations?: boolean;
  reduceImageQuality?: boolean;
  enableVirtualScrolling?: boolean;
  throttleUpdates?: boolean;
  preloadCriticalResources?: boolean;
}

export const useRaspberryPiOptimizations = (config: OptimizationConfig = {}) => {
  const { isPerformanceMode, isRaspberryPi, isLowEnd } = usePerformanceMode();
  const rafRef = useRef<number>();
  const throttleTimerRef = useRef<NodeJS.Timeout>();

  // Detect if we're on a Pi or low-end device
  const shouldOptimize = isPerformanceMode || isRaspberryPi || isLowEnd;

  // Throttle function for reducing update frequency
  const throttle = useCallback((callback: () => void, delay: number = 100) => {
    if (!shouldOptimize) {
      callback();
      return;
    }

    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
    }

    throttleTimerRef.current = setTimeout(callback, delay);
  }, [shouldOptimize]);

  // Request animation frame with fallback for better performance
  const scheduleUpdate = useCallback((callback: () => void) => {
    if (!shouldOptimize) {
      callback();
      return;
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(callback);
  }, [shouldOptimize]);

  // Debounce function for search/filter operations
  const debounce = useCallback((func: (...args: any[]) => void, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), shouldOptimize ? wait * 2 : wait);
    };
  }, [shouldOptimize]);

  // Apply global optimizations on mount
  useEffect(() => {
    if (!shouldOptimize) return;

    // Reduce motion for better performance
    document.documentElement.style.setProperty('--reduce-motion', 'reduce');

    // Disable smooth scrolling
    document.documentElement.style.scrollBehavior = 'auto';

    // Add performance hints to body
    document.body.classList.add('rpi-optimized');

    // Optimize image loading
    if (config.reduceImageQuality !== false) {
      // Set lower quality for images
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (!img.dataset.originalSrc) {
          img.dataset.originalSrc = img.src;
        }
        // Add loading lazy attribute
        img.loading = 'lazy';
        // Add decoding async for better performance
        img.decoding = 'async';
      });
    }

    // Optimize video elements if present
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      video.preload = 'none';
    });

    // Clean up on unmount
    return () => {
      document.documentElement.style.removeProperty('--reduce-motion');
      document.documentElement.style.scrollBehavior = '';
      document.body.classList.remove('rpi-optimized');

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [shouldOptimize, config.reduceImageQuality]);

  // Intersection Observer for lazy loading
  const observeElement = useCallback((element: HTMLElement, callback: () => void) => {
    if (!shouldOptimize) {
      callback();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            callback();
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px', // Start loading slightly before visible
        threshold: 0.01
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldOptimize]);

  // Optimize list rendering with virtual scrolling hints
  const getListOptimizations = useCallback((itemCount: number) => {
    if (!shouldOptimize) {
      return {
        overscan: 3,
        estimateSize: () => 50,
        renderAhead: 5
      };
    }

    // More aggressive optimization for Pi
    return {
      overscan: 1, // Minimal overscan
      estimateSize: () => 50,
      renderAhead: 2, // Render fewer items ahead
      scrollThrottle: 100 // Throttle scroll events
    };
  }, [shouldOptimize]);

  return {
    shouldOptimize,
    throttle,
    scheduleUpdate,
    debounce,
    observeElement,
    getListOptimizations,
    isRaspberryPi,
    isLowEnd
  };
};