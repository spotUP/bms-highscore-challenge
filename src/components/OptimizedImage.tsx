import React, { useState, useEffect } from 'react';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackText?: string;
  onLoad?: () => void;
  onError?: () => void;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  fallbackText,
  onLoad,
  onError,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { isRaspberryPi, isLowEnd } = usePerformanceMode();

  useEffect(() => {
    // Preload image with proper error handling
    const img = new Image();
    
    img.onload = () => {
      setImageLoaded(true);
      onLoad?.();
    };
    
    img.onerror = () => {
      setImageError(true);
      onError?.();
    };
    
    img.src = src;
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, onLoad, onError]);

  // Determine image rendering strategy based on device
  const getImageProps = () => {
    const baseProps = {
      alt,
      className,
      loading: 'lazy' as const,
      decoding: 'async' as const,
    };

    if (isRaspberryPi) {
      return {
        ...baseProps,
        // Optimize for Pi's GPU capabilities
        style: {
          imageRendering: '-webkit-optimize-contrast',
          imageRendering: 'optimize-contrast',
          // Force hardware acceleration
          transform: 'translateZ(0)',
          willChange: 'auto',
        },
      };
    }

    if (isLowEnd) {
      return {
        ...baseProps,
        style: {
          // Disable expensive image filters
          filter: 'none',
        },
      };
    }

    return baseProps;
  };

  if (imageError && fallbackText) {
    return (
      <div className={className} style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: '8px',
        padding: '16px',
        minWidth: '200px',
      }}>
        <span style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>
          {fallbackText}
        </span>
      </div>
    );
  }

  if (!imageLoaded) {
    return (
      <div className={className} style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: '8px',
      }}>
        <div style={{ 
          width: '20px', 
          height: '20px', 
          border: '2px solid #ccc',
          borderTop: '2px solid #666',
          borderRadius: '50%',
          animation: isLowEnd ? 'none' : 'spin 1s linear infinite',
        }} />
      </div>
    );
  }

  return <img src={src} {...getImageProps()} />;
};

export default OptimizedImage;