import React, { useState, useEffect } from 'react';
import { Skeleton } from "@/components/ui/skeleton";

interface SimpleLogoPlaceholderProps {
  gameName: string;
  className?: string;
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

export const SimpleLogoPlaceholder: React.FC<SimpleLogoPlaceholderProps> = ({
  gameName,
  className = ''
}) => {
  const [showPlaceholder, setShowPlaceholder] = useState(false);

  useEffect(() => {
    // Show skeleton for a brief moment, then show placeholder
    const timer = setTimeout(() => {
      setShowPlaceholder(true);
    }, 300); // Very short delay

    return () => clearTimeout(timer);
  }, []);

  if (!showPlaceholder) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="w-full h-full p-4 flex flex-col items-center justify-center">
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  return <ColoredPlaceholder gameName={gameName} className={className} />;
};