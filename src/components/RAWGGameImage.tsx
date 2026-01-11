import React, { useState, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Image } from 'lucide-react';

interface RAWGGameImageProps {
  gameName: string;
  className?: string;
  alt?: string;
  onError?: () => void;
  enableLazyLoading?: boolean;
  fallbackImageUrl?: string | null;
}

interface ColoredPlaceholderProps {
  gameName: string;
  className?: string;
}

const ColoredPlaceholder: React.FC<ColoredPlaceholderProps> = ({ gameName, className }) => {
  const [isLoaded, setIsLoaded] = React.useState(false);

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

  // Trigger animation after a short delay to match other images
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 350); // Slightly longer delay to match skeleton + animation timing
    return () => clearTimeout(timer);
  }, [gameName]);

  return (
    <div
      className={`${className} flex items-center justify-center ${bgColor} text-white`}
      style={{
        opacity: isLoaded ? 1 : 0,
        transform: isLoaded ? 'scale(1)' : 'scale(1.05)',
        transition: 'opacity 2s ease-out, transform 2s ease-out'
      }}
    >
      <div className="text-center p-4">
        <div className="text-lg font-bold mb-1">
          {gameName.length > 20 ? `${gameName.substring(0, 20)}...` : gameName}
        </div>
        <div className="text-sm opacity-75">No Image</div>
      </div>
    </div>
  );
};

export const RAWGGameImage: React.FC<RAWGGameImageProps> = ({
  gameName,
  className = '',
  alt,
  onError,
  enableLazyLoading = false,
  fallbackImageUrl
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [minDelayPassed, setMinDelayPassed] = useState(false);
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

  // Add minimum delay for skeleton visibility - ensures consistent timing for all cards
  useEffect(() => {
    if (isVisible) {
      setMinDelayPassed(false);
      const timer = setTimeout(() => {
        setMinDelayPassed(true);
      }, 300); // Show skeleton for at least 300ms for consistent experience
      return () => clearTimeout(timer);
    }
  }, [isVisible, gameName]);

  useEffect(() => {
    const fetchRAWGImage = async () => {
      if (!gameName || !isVisible) return;

      setIsLoading(true);
      setError(false);
      setImageLoaded(false);

      // Add minimal delay to respect API rate limits
      const delay = Math.random() * 200 + 100; // 100-300ms delay
      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        const apiKey = import.meta.env.VITE_RAWG_API_KEY;
        if (!apiKey) {
          setError(true);
          return;
        }


        // Preprocess game name for better RAWG matching
        let processedName = gameName
          // Remove common arcade prefixes/suffixes
          .replace(/^(The\s+)?/i, '') // Remove "The " prefix
          .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical info like "(Arcade)" or "(Japan)"
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();

        // Don't remove dash content for R-Type games as the subtitle is important
        if (!gameName.toLowerCase().startsWith('r-type')) {
          processedName = processedName.replace(/\s*-\s*.*$/, ''); // Remove everything after dash (often version info)
        }

        // Try multiple search strategies
        const searchQueries = [
          processedName, // Cleaned name
          gameName, // Original name as fallback
        ];

        let bestMatch = null;
        let response = null;

        // Try each search query until we find a good match
        for (const query of searchQueries) {
          response = await fetch(
            `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(query)}&page_size=3`
          );

          if (!response.ok) continue;

          const data = await response.json();

          // Look for exact or close matches
          if (data.results?.length > 0) {
            for (const game of data.results) {
              const nameMatch = game.name.toLowerCase() === query.toLowerCase();
              const closeMatch = game.name.toLowerCase().includes(query.toLowerCase()) ||
                                query.toLowerCase().includes(game.name.toLowerCase());

              if (nameMatch) {
                bestMatch = game;
                break;
              } else if (closeMatch && !bestMatch) {
                bestMatch = game;
              }
            }

            if (bestMatch) break;
          }
        }

        if (!response.ok) {
          throw new Error(`RAWG API error: ${response.status}`);
        }

        if (bestMatch && bestMatch.background_image) {
          setImageUrl(bestMatch.background_image);
        } else {
          setError(true);
        }
      } catch (err) {
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch image if the element is visible (or lazy loading is disabled)
    if (gameName && isVisible) {
      fetchRAWGImage();
    }
  }, [gameName, isVisible]);

  // Show skeleton loading state or image
  if (isLoading || !isVisible || !minDelayPassed) {
    return (
      <div
        ref={elementRef}
        className={`${className} rounded-md relative overflow-hidden bg-gradient-to-r from-card via-muted to-card animate-pulse`}
        style={{
          backgroundSize: '200% 100%',
          animation: 'shimmer 2.0s ease-in-out infinite'
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <Image className="w-8 h-8 text-gray-500" />
        </div>
      </div>
    );
  }

  // Show actual RAWG image if available
  if (imageUrl && !error) {
    return (
      <div className={`${className} relative`}>
        {!imageLoaded && (
          <div
            className={`${className} absolute inset-0 rounded-md overflow-hidden bg-gradient-to-r from-card via-muted to-card animate-pulse z-10`}
            style={{
              backgroundSize: '200% 100%',
              animation: 'shimmer 2.0s ease-in-out infinite'
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <Image className="w-8 h-8 text-gray-500" />
            </div>
          </div>
        )}
        <img
          src={imageUrl}
          alt={alt || `${gameName} screenshot`}
          className={`${className} object-cover`}
          onError={() => {
            setError(true);
            onError?.();
          }}
          onLoad={() => {
            // Force a small delay to ensure animation always runs, even for cached images
            setTimeout(() => {
              setImageLoaded(true);
            }, 50);
          }}
          style={{
            maxHeight: '100%',
            maxWidth: '100%',
            opacity: imageLoaded ? 1 : 0,
            transform: imageLoaded ? 'scale(1)' : 'scale(1.05)',
            transition: 'opacity 2s ease-out, transform 2s ease-out'
          }}
        />
      </div>
    );
  }

  // Try fallback image before colored placeholder (when RAWG fails or has no image)
  if (fallbackImageUrl && error && !imageUrl) {
    return (
      <img
        src={fallbackImageUrl}
        alt={alt || `${gameName} logo`}
        className={`${className} object-contain bg-gray-900 p-2`}
        onError={() => {
          onError?.();
        }}
      />
    );
  }


  // Final fallback to colored placeholder
  return <ColoredPlaceholder gameName={gameName} className={className} />;
};