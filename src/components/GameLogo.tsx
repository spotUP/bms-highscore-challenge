import React, { useState, useEffect, useRef } from 'react';
import { launchBoxService } from '@/services/launchboxService';

interface GameLogoProps {
  gameName: string;
  className?: string;
  alt?: string;
  onError?: () => void;
  enableLazyLoading?: boolean;
}

interface ColoredPlaceholderProps {
  gameName: string;
  className?: string;
}

const ColoredPlaceholder: React.FC<ColoredPlaceholderProps> = ({ gameName, className }) => {
  // Generate a consistent color for each game
  const colors = [
    'bg-indigo-500', // indigo
    'bg-violet-500', // violet
    'bg-amber-500', // amber
    'bg-red-500', // red
    'bg-emerald-500', // emerald
    'bg-blue-500', // blue
    'bg-orange-500', // orange
    'bg-teal-500'  // teal
  ];

  const colorIndex = gameName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  const bgColor = colors[colorIndex];

  return (
    <div className={`${className} flex items-center justify-center ${bgColor} text-white`}>
      <div className="text-center p-4">
        <div className="text-lg font-bold mb-1">
          {gameName.length > 20 ? `${gameName.substring(0, 20)}...` : gameName}
        </div>
        <div className="text-sm opacity-75">No Logo</div>
      </div>
    </div>
  );
};

export const GameLogo: React.FC<GameLogoProps> = ({
  gameName,
  className = '',
  alt,
  onError,
  enableLazyLoading = true
}) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!enableLazyLoading) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [enableLazyLoading]);

  useEffect(() => {
    const fetchLogo = async () => {
      setIsLoading(true);
      setError(false);

      try {
        const url = await launchBoxService.getClearLogo(gameName);
        setLogoUrl(url);

        if (!url) {
          setError(true);
        }
      } catch (err) {
        // Check if it's a circuit breaker error (API temporarily down)
        if (err instanceof Error && err.message.includes('Circuit breaker is open')) {
          console.log('LaunchBox API temporarily unavailable for', gameName);
        } else {
          console.error('Error fetching clear logo for', gameName, ':', err);
        }
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch logo if the element is visible (or lazy loading is disabled)
    if (gameName && isVisible) {
      fetchLogo();
    }
  }, [gameName, isVisible]);

  // Show loading state while fetching logo or waiting for visibility
  if (isLoading || !isVisible) {
    return (
      <div ref={elementRef} className={`${className} flex items-center justify-center bg-gray-200 text-gray-500`}>
        <div className="text-center p-2">
          {isVisible ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-1"></div>
              <div className="text-xs opacity-75">Loading...</div>
            </>
          ) : (
            <div className="text-xs opacity-50">•••</div>
          )}
        </div>
      </div>
    );
  }

  // Show actual clear logo if available
  if (logoUrl && !error) {
    return (
      <img
        src={logoUrl}
        alt={alt || `${gameName} logo`}
        className={`${className} object-contain bg-gray-900`}
        onError={() => {
          setError(true);
          onError?.();
        }}
        style={{
          maxHeight: '100%',
          maxWidth: '100%',
          padding: '8px'
        }}
      />
    );
  }

  // Fallback to colored placeholder
  return <ColoredPlaceholder gameName={gameName} className={className} />;
};