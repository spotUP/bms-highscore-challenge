import React, { useState, useCallback } from 'react';
import { getGameLogoUrl } from '@/lib/utils';

interface OptimizedImageProps {
  src: string | null;
  alt: string;
  className?: string;
  fallbackIcon?: string;
  onError?: () => void;
}

const OptimizedImage: React.FC<OptimizedImageProps> = React.memo(({
  src,
  alt,
  className = '',
  fallbackIcon = '🎮',
  onError
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleError = useCallback(() => {
    setImageError(true);
    onError?.();
  }, [onError]);

  const handleLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  // If no src or image failed to load, show fallback
  if (!src || imageError) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-800 border border-gray-600 rounded-lg ${className}`}
        title={alt}
      >
        <span className="text-2xl opacity-60">{fallbackIcon}</span>
      </div>
    );
  }

  const optimizedSrc = getGameLogoUrl(src);

  return (
    <div className={`relative ${className}`}>
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 border border-gray-600 rounded-lg animate-pulse">
          <span className="text-2xl opacity-60">{fallbackIcon}</span>
        </div>
      )}
      <img
        src={optimizedSrc || undefined}
        alt={alt}
        className={`w-full h-full object-cover rounded-lg transition-opacity duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onError={handleError}
        onLoad={handleLoad}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;
