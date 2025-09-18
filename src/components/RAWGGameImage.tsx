import React, { useState, useEffect, useRef } from 'react';

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
  enableLazyLoading = true,
  fallbackImageUrl
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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
    const fetchRAWGImage = async () => {
      if (!gameName || !isVisible) return;

      setIsLoading(true);
      setError(false);

      try {
        const apiKey = import.meta.env.VITE_RAWG_API_KEY;
        if (!apiKey) {
          setError(true);
          return;
        }

        console.log(`🖼️ RAWGGameImage: Fetching image for "${gameName}"`);

        // Preprocess game name for better RAWG matching
        let processedName = gameName
          // Remove common arcade prefixes/suffixes
          .replace(/^(The\s+)?/i, '') // Remove "The " prefix
          .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical info like "(Arcade)" or "(Japan)"
          .replace(/\s*-\s*.*$/, '') // Remove everything after dash (often version info)
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();

        // Try multiple search strategies
        const searchQueries = [
          processedName, // Cleaned name
          gameName, // Original name as fallback
        ];

        let bestMatch = null;
        let response = null;

        // Try each search query until we find a good match
        for (const query of searchQueries) {
          console.log(`🔍 RAWGGameImage: Trying search for "${query}"`);
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
          console.log(`✅ RAWGGameImage: Found image for "${gameName}" -> "${bestMatch.name}"`);
          setImageUrl(bestMatch.background_image);
        } else {
          console.log(`❌ RAWGGameImage: No RAWG image found for "${gameName}", will try fallback`);
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching RAWG image for', gameName, ':', err);
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
              <div className="text-xs opacity-60">Loading...</div>
            </>
          ) : (
            <div className="text-xs opacity-50">•••</div>
          )}
        </div>
      </div>
    );
  }

  // Show actual RAWG image if available
  if (imageUrl && !error) {
    return (
      <img
        src={imageUrl}
        alt={alt || `${gameName} screenshot`}
        className={`${className} object-cover`}
        onError={() => {
          setError(true);
          onError?.();
        }}
        style={{
          maxHeight: '100%',
          maxWidth: '100%'
        }}
      />
    );
  }

  // Try fallback image before colored placeholder (when RAWG fails or has no image)
  if (fallbackImageUrl && error && !imageUrl) {
    console.log(`🔄 RAWGGameImage: Using fallback image for "${gameName}": ${fallbackImageUrl}`);
    return (
      <img
        src={fallbackImageUrl}
        alt={alt || `${gameName} logo`}
        className={`${className} object-contain bg-gray-900 p-2`}
        onError={() => {
          console.log(`❌ RAWGGameImage: Fallback image also failed for "${gameName}"`);
          onError?.();
        }}
      />
    );
  }

  // Final fallback to colored placeholder
  return <ColoredPlaceholder gameName={gameName} className={className} />;
};