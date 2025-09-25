import React, { useState, useEffect, useRef } from 'react';
import { clearLogoService } from '@/services/clearLogoService';

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
        // Get Clear Logo from Cloudflare R2
        const logoMap = await clearLogoService.getClearLogosForGames([gameName]);
        const logoDataUrl = logoMap[gameName];

        if (logoDataUrl) {
          setLogoUrl(logoDataUrl);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching clear logo for', gameName, ':', err);
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

  // Show progressive loading state with game name
  if (isLoading || !isVisible) {
    return (
      <div ref={elementRef} className={`${className} flex items-center justify-center bg-gray-200 text-gray-500`}>
        <div className="text-center p-2 max-w-full overflow-hidden">
          {isVisible ? (
            <>
              <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
              <div className="text-xs font-medium mb-1 truncate px-1" title={gameName}>
                {gameName.length > 15 ? `${gameName.substring(0, 15)}...` : gameName}
              </div>
              <div className="text-xs opacity-60">Loading logo...</div>
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