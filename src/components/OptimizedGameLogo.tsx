import React, { useState, useEffect, useRef } from 'react';
import { useRaspberryPiOptimizations } from '@/hooks/useRaspberryPiOptimizations';

interface OptimizedGameLogoProps {
  src: string | null;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

const OptimizedGameLogo: React.FC<OptimizedGameLogoProps> = ({
  src,
  alt,
  className = '',
  fallback
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const { shouldOptimize, observeElement } = useRaspberryPiOptimizations();

  useEffect(() => {
    if (!imgRef.current || !shouldOptimize) {
      setIsVisible(true);
      return;
    }

    // Use Intersection Observer for lazy loading
    const cleanup = observeElement(imgRef.current, () => {
      setIsVisible(true);
    });

    return cleanup;
  }, [shouldOptimize, observeElement]);

  // Show placeholder while loading
  if (!src || error) {
    return fallback || (
      <div className={`${className} bg-gray-800 flex items-center justify-center`}>
        <span className="text-4xl opacity-50">🎮</span>
      </div>
    );
  }

  // For performance mode, use simpler loading
  if (shouldOptimize) {
    return (
      <div ref={imgRef} className={`${className} relative`}>
        {!isLoaded && (
          <div className="absolute inset-0 bg-gray-800 animate-pulse" />
        )}
        {isVisible && (
          <img
            src={src}
            alt={alt}
            className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
            loading="lazy"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            onError={() => setError(true)}
          />
        )}
      </div>
    );
  }

  // Standard loading with animations
  return (
    <div ref={imgRef} className={`${className} relative`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
};

export default OptimizedGameLogo;