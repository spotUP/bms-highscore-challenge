import React, { ComponentType, lazy } from 'react';

// Dynamic imports for heavy components
export const LazyCharts = {
  ScoreDistributionChart: lazy(() => import('@/components/charts/ScoreDistributionChart')),
  PlayerPerformanceChart: lazy(() => import('@/components/charts/PlayerPerformanceChart')),
  GamePopularityChart: lazy(() => import('@/components/charts/GamePopularityChart')),
  AchievementProgressChart: lazy(() => import('@/components/charts/AchievementProgressChart')),
  PlayerScoreHistoryChart: lazy(() => import('@/components/charts/PlayerScoreHistoryChart')),
};

// Dynamic imports for admin components
export const LazyAdmin = {
  WebhookConfig: lazy(() => import('@/components/WebhookConfig')),
  SecurityAuditLog: lazy(() => import('@/components/SecurityAuditLog')),
};

// Dynamic imports for game components
export const LazyGame = {
  SpinTheWheel: lazy(() => import('@/components/SpinTheWheel')),
  WheelOfFortune: lazy(() => import('@/components/WheelOfFortune')),
  GameLogoSuggestions: lazy(() => import('@/components/GameLogoSuggestions')),
};

// Dynamic imports for utility components
export const LazyUtils = {
  QRCodeDisplay: lazy(() => import('@/components/QRCodeDisplay')),
  QRScanner: lazy(() => import('@/components/QRScanner')),
  ImagePasteUpload: lazy(() => import('@/components/ImagePasteUpload')),
};

// Utility function to create lazy components with error boundaries
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: ComponentType
) {
  const LazyComponent = lazy(importFn);
  
  return (props: React.ComponentProps<T>) => (
    <React.Suspense fallback={fallback ? React.createElement(fallback) : <div>Loading...</div>}>
      <LazyComponent {...props} />
    </React.Suspense>
  );
}

// Preload functions for critical components
export const preloadComponents = {
  charts: () => Promise.all([
    import('@/components/charts/ScoreDistributionChart'),
    import('@/components/charts/PlayerPerformanceChart'),
    import('@/components/charts/GamePopularityChart'),
    import('@/components/charts/AchievementProgressChart'),
  ]),
  
  admin: () => Promise.all([
    import('@/components/WebhookConfig'),
    import('@/components/SecurityAuditLog'),
  ]),
  
  game: () => Promise.all([
    import('@/components/SpinTheWheel'),
    import('@/components/WheelOfFortune'),
  ]),
};

// Intersection Observer for lazy loading
export const useIntersectionObserver = (
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = React.useState(false);
  const [hasIntersected, setHasIntersected] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref, hasIntersected, options]);

  return { isIntersecting, hasIntersected };
};
