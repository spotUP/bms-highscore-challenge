import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface WheelOfFortuneProps {
  names: string[];
  onWinner: (winner: string) => void;
}

const WheelOfFortune = ({ names, onWinner }: WheelOfFortuneProps) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);

  // Generate colors for each segment
  const segmentColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  const segmentAngle = 360 / names.length;

  const spinWheel = () => {
    if (isSpinning || names.length === 0) return;

    setIsSpinning(true);
    
    // Random spin between 5 and 10 full rotations plus random angle
    const minSpins = 5;
    const maxSpins = 10;
    const spins = Math.random() * (maxSpins - minSpins) + minSpins;
    const finalRotation = rotation + (spins * 360) + Math.random() * 360;
    
    setRotation(finalRotation);

    // Calculate winner after spin completes
    setTimeout(() => {
      const normalizedRotation = (360 - (finalRotation % 360)) % 360;
      const winnerIndex = Math.floor(normalizedRotation / segmentAngle) % names.length;
      const winner = names[winnerIndex];
      
      setIsSpinning(false);
      onWinner(winner);
    }, 4000); // Match CSS animation duration
  };

  const renderSegments = () => {
    return names.map((name, index) => {
      const angle = segmentAngle * index;
      const color = segmentColors[index % segmentColors.length];
      
      return (
        <div
          key={index}
          className="absolute top-0 left-1/2 origin-bottom"
          style={{
            transform: `rotate(${angle}deg)`,
            width: '2px',
            height: '150px',
            transformOrigin: 'bottom center',
          }}
        >
          <div
            className="absolute top-0 left-0 flex items-start justify-center text-xs font-bold text-white text-center pt-2"
            style={{
              width: `${Math.tan((segmentAngle * Math.PI) / 360) * 150 * 2}px`,
              height: '150px',
              background: `conic-gradient(from ${-segmentAngle/2}deg, ${color} 0deg, ${color} ${segmentAngle}deg, transparent ${segmentAngle}deg)`,
              clipPath: `polygon(50% 100%, ${50 - Math.tan((segmentAngle * Math.PI) / 360) * 100}% 0%, ${50 + Math.tan((segmentAngle * Math.PI) / 360) * 100}% 0%)`,
              marginLeft: `-${Math.tan((segmentAngle * Math.PI) / 360) * 150}px`,
            }}
          >
            <span 
              className="transform -rotate-90 whitespace-nowrap text-shadow"
              style={{ 
                fontSize: Math.min(12, 80 / name.length) + 'px',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
              }}
            >
              {name}
            </span>
          </div>
        </div>
      );
    });
  };

  if (names.length === 0) {
    return (
      <div className="text-center text-white">
        <p className="text-xl mb-4">No players found!</p>
        <p className="text-gray-400">Add some scores to the leaderboard first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-8">
      <div className="relative">
        {/* Wheel container */}
        <div
          ref={wheelRef}
          className="relative w-80 h-80 rounded-full border-4 border-white shadow-2xl transition-transform duration-4000 ease-out"
          style={{
            transform: `rotate(${rotation}deg)`,
            background: 'conic-gradient(from 0deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #FFEAA7, #DDA0DD, #98D8C8, #F7DC6F, #BB8FCE, #85C1E9)',
          }}
        >
          {/* Center circle */}
          <div className="absolute top-1/2 left-1/2 w-8 h-8 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2 border-2 border-gray-800 z-10"></div>
          
          {/* Segments */}
          <div className="relative w-full h-full overflow-hidden rounded-full">
            {renderSegments()}
          </div>
        </div>

        {/* Pointer */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2 z-20">
          <div className="w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-white"></div>
        </div>
      </div>

      <Button
        onClick={spinWheel}
        disabled={isSpinning}
        className="bg-arcade-neonYellow hover:bg-arcade-neonYellow/80 text-black font-bold text-xl px-8 py-4 rounded-lg shadow-lg transition-all duration-200 hover:scale-105"
      >
        {isSpinning ? 'Spinning...' : 'SPIN THE WHEEL!'}
      </Button>

      <p className="text-white text-center max-w-md">
        {names.length} player{names.length !== 1 ? 's' : ''} on the wheel
      </p>
    </div>
  );
};

export default WheelOfFortune;