import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface WheelOfFortuneProps {
  names: string[];
  onWinner: (winner: string) => void;
}

// Theme-aware segment colors
const getSegmentColors = () => {
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  
  // Try to get theme colors, fallback to defaults
  const primary = computedStyle.getPropertyValue('--primary')?.trim() || '#0ea5e9';
  const secondary = computedStyle.getPropertyValue('--secondary')?.trim() || '#64748b';
  const accent = computedStyle.getPropertyValue('--accent')?.trim() || '#f59e0b';
  
  // Generate theme-based color palette
  return [
    primary, secondary, accent,
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#FF9F43', '#10AC84', '#EE5A24'
  ];
};

// Fisher-Yates shuffle algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const WheelOfFortune = ({ names, onWinner }: WheelOfFortuneProps) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [spinVelocity, setSpinVelocity] = useState(0);
  const [shuffledNames, setShuffledNames] = useState<string[]>([]);
  const [segmentColors, setSegmentColors] = useState<string[]>([]);
  const wheelRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  // Initialize colors and shuffle names when they change
  useEffect(() => {
    setSegmentColors(getSegmentColors());
    setShuffledNames(shuffleArray(names));
  }, [names]);

  const segmentAngle = 360 / shuffledNames.length;

  // Smooth physics-based spinning like Wheel of Names
  const spinWheel = () => {
    if (isSpinning || shuffledNames.length === 0) return;

    setIsSpinning(true);
    
    // Random initial velocity with some variation - increased for longer spin
    const baseVelocity = 25 + Math.random() * 15; // 25-40 degrees per frame
    const velocity = baseVelocity;
    setSpinVelocity(velocity);
    
    const animate = () => {
      setSpinVelocity(prev => {
        const newVelocity = prev * 0.985; // Slower deceleration for longer spin
        
        setCurrentRotation(prevRot => {
          const newRotation = prevRot + newVelocity;
          
          if (newVelocity > 0.1) {
            animationRef.current = requestAnimationFrame(animate);
            return newRotation;
          } else {
            // Wheel has stopped - calculate winner
            // The pointer is at the top (0 degrees), so we need to find which segment it's pointing to
            // We need to account for the fact that segments start from the top and go clockwise
            const normalizedRotation = ((newRotation % 360) + 360) % 360;
            // Calculate which segment the pointer is pointing to
            // Since segments are positioned clockwise from the top, we need to reverse the calculation
            // Add 1 to account for the offset (pointer points to the correct segment)
            const segmentIndex = Math.floor(normalizedRotation / segmentAngle);
            const winnerIndex = (shuffledNames.length - segmentIndex - 1) % shuffledNames.length;
            const winner = shuffledNames[winnerIndex];
            
            console.log('Winner calculation:', {
              currentRotation: newRotation,
              normalizedRotation,
              segmentAngle,
              segmentIndex,
              winnerIndex,
              winner,
              shuffledNames
            });
            
            setTimeout(() => {
              setIsSpinning(false);
              onWinner(winner);
            }, 500); // Small delay for dramatic effect
            
            return newRotation;
          }
        });
        
        return newVelocity;
      });
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Reshuffle names when clicking spin
  const handleSpin = () => {
    setShuffledNames(shuffleArray(names));
    setTimeout(() => spinWheel(), 50); // Small delay to ensure shuffle is complete
  };

  if (shuffledNames.length === 0) {
    return (
      <div className="text-center text-gray-600">
        <div className="mb-6">
          <div className="w-32 h-32 mx-auto rounded-full border-4 border-dashed border-gray-300 flex items-center justify-center">
            <span className="text-gray-400 text-4xl">?</span>
          </div>
        </div>
        <p className="text-xl mb-2 font-semibold">No players found!</p>
        <p className="text-gray-400">Add some scores to the leaderboard first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-8">
      {/* Wheel Container - Wheel of Names style */}
      <div className="relative">
        {/* Main wheel - themed styling */}
        <div
          ref={wheelRef}
          className="relative w-96 h-96 rounded-full border-4 border-white/20 shadow-xl theme-card"
          style={{
            transform: `rotate(${currentRotation}deg)`,
            background: `conic-gradient(${shuffledNames.map((_, index) => {
              const color = segmentColors[index % segmentColors.length];
              const startAngle = (360 / shuffledNames.length) * index;
              const endAngle = (360 / shuffledNames.length) * (index + 1);
              return `${color} ${startAngle}deg ${endAngle}deg`;
            }).join(', ')})`,
            transition: isSpinning ? 'none' : 'transform 0.2s ease-out',
            willChange: isSpinning ? 'transform' : 'auto',
          }}
        >
          {/* Center hub - themed styling */}
          <div className="absolute top-1/2 left-1/2 w-16 h-16 bg-background rounded-full transform -translate-x-1/2 -translate-y-1/2 border-2 border-white/20 z-10 shadow-lg">
            <div className="w-full h-full rounded-full bg-muted flex items-center justify-center">
              <div className="w-4 h-4 bg-primary rounded-full"></div>
            </div>
          </div>

          {/* Player names - positioned at outer edges */}
          {shuffledNames.map((name, index) => {
            const segmentCenterAngle = segmentAngle * index + segmentAngle / 2;
            // Position names at the outer edge of each segment
            const radius = 170; // Outer edge of the segment
            const x = Math.cos((segmentCenterAngle - 90) * Math.PI / 180) * radius;
            const y = Math.sin((segmentCenterAngle - 90) * Math.PI / 180) * radius;
            
            // Rotate names to follow the wheel's curve
            let rotationAngle = segmentCenterAngle;
            // Flip text that would be upside down to keep it readable
            if (rotationAngle > 90 && rotationAngle < 270) {
              rotationAngle += 180;
            }
            
            return (
              <div
                key={`name-${index}`}
                className="absolute text-white font-bold text-sm z-30"
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  transform: `translate(-50%, -50%) rotate(${rotationAngle}deg)`,
                  transformOrigin: 'center',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                  maxWidth: '120px',
                  textAlign: 'center',
                  lineHeight: '1.1',
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                  fontSize: '0.9rem'
                }}
              >
                {name}
              </div>
            );
          })}
        </div>

        {/* Pointer - themed styling */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2 z-40">
          <div className="w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-primary shadow-md"></div>
        </div>
      </div>

      {/* Spin Button - themed styling */}
      <Button
        onClick={handleSpin}
        disabled={isSpinning}
        className="bg-primary hover:bg-primary/80 text-primary-foreground font-semibold text-lg px-8 py-4 rounded-lg shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSpinning ? (
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            <span>Spinning...</span>
          </div>
        ) : (
          'Spin the Wheel'
        )}
      </Button>

      {/* Player Info - themed styling */}
      <div className="text-center">
        <p className="text-muted-foreground text-sm">
          {shuffledNames.length} entr{shuffledNames.length !== 1 ? 'ies' : 'y'} ready to spin
        </p>
        <p className="text-muted-foreground/70 text-xs mt-1">
          Names are shuffled randomly for each spin
        </p>
      </div>
    </div>
  );
};

export default WheelOfFortune;