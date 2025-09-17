import React from 'react';
import { useRAWGImage, isRAWGConfigured } from '@/hooks/useRAWGImage';

interface GameImageProps {
  databaseId?: number | null;
  gameName: string;
  platformName: string;
  className?: string;
  alt?: string;
  onError?: () => void;
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

  const placeholderText = isRAWGConfigured() ? "No Image" : "Set RAWG API Key";

  return (
    <div className={`${className} flex items-center justify-center ${bgColor} text-white`}>
      <div className="text-center p-4">
        <div className="text-lg font-bold mb-1">
          {gameName.length > 20 ? `${gameName.substring(0, 20)}...` : gameName}
        </div>
        <div className="text-sm opacity-75">{placeholderText}</div>
      </div>
    </div>
  );
};

export const GameImage: React.FC<GameImageProps> = ({
  databaseId,
  gameName,
  platformName,
  className = '',
  alt,
  onError
}) => {
  const { imageUrl, isLoading, error } = useRAWGImage({
    gameName,
    platformName,
    enabled: isRAWGConfigured()
  });

  // Show loading state while fetching image
  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-200 text-gray-500`}>
        <div className="text-center p-4">
          <div className="text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  // Show actual game image if available
  if (imageUrl && !error) {
    return (
      <img
        src={imageUrl}
        alt={alt || `${gameName} screenshot`}
        className={`${className} object-cover`}
        onError={() => {
          onError?.();
        }}
      />
    );
  }

  // Fallback to colored placeholder
  return <ColoredPlaceholder gameName={gameName} className={className} />;
};