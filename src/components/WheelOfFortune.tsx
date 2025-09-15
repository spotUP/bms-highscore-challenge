import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface WheelOfFortuneProps {
  names: string[];
  onWinner: (winner: string) => void;
}

// Classic Wheel of Fortune colors - bright and vibrant
const getSegmentColors = () => {
  // Classic game show colors: bright, contrasting, and exciting
  return [
    '#FF6B35', // Bright Orange
    '#F7931E', // Golden Orange
    '#FFD23F', // Bright Yellow
    '#06FFA5', // Neon Green
    '#4ECDC4', // Turquoise
    '#45B7D1', // Sky Blue
    '#96CEB4', // Mint Green
    '#FFEAA7', // Cream Yellow
    '#DDA0DD', // Plum Purple
    '#FF69B4', // Hot Pink
    '#32CD32', // Lime Green
    '#FF4500', // Red Orange
    '#00CED1', // Dark Turquoise
    '#9370DB', // Medium Purple
    '#FF1493', // Deep Pink
    '#00FF7F', // Spring Green
    '#FF8C00', // Dark Orange
    '#7B68EE', // Medium Slate Blue
    '#FF6347', // Tomato Red
    '#40E0D0', // Turquoise
    '#DA70D6', // Orchid
    '#98FB98', // Pale Green
    '#F0E68C', // Khaki
    '#DEB887', // Burlywood
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
  const lastTickAngle = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [tickerAnimated, setTickerAnimated] = useState(false);

  // Initialize colors and shuffle names when they change
  useEffect(() => {
    setSegmentColors(getSegmentColors());
    setShuffledNames(shuffleArray(names));
  }, [names]);

  const segmentAngle = 360 / shuffledNames.length;

  // Create natural click sound using Web Audio API
  const playTickSound = (velocity: number) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // Simple, natural click sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      // Generate brief noise burst for natural click texture
      const bufferSize = audioContext.sampleRate * 0.02; // 20ms of noise
      const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // Create filtered noise that sounds like plastic/wood contact
      for (let i = 0; i < bufferSize; i++) {
        const decay = Math.pow(1 - (i / bufferSize), 3); // Quick exponential decay
        output[i] = (Math.random() * 2 - 1) * decay;
      }

      const noiseSource = audioContext.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      // High-pass filter for crisp click
      const filter = audioContext.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1000 + velocity * 50, audioContext.currentTime);
      filter.Q.setValueAtTime(1, audioContext.currentTime);

      // Quick tone burst for the 'click'
      const freq = 1800 + (velocity * 100); // Higher frequency for speed
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(freq * 0.2, audioContext.currentTime + 0.008);

      // Very sharp envelope for instant click
      const volume = Math.min(velocity / 30, 0.15);
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.02);

      // Use triangle wave for more natural sound than square
      oscillator.type = 'triangle';

      // Connect: noise and tone -> filter -> gain -> output
      noiseSource.connect(filter);
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Play the click
      const now = audioContext.currentTime;
      oscillator.start(now);
      noiseSource.start(now);
      oscillator.stop(now + 0.02);
      noiseSource.stop(now + 0.02);

    } catch (error) {
      console.log('Audio not available:', error);
    }
  };

  // Smooth physics-based spinning like Wheel of Names
  const spinWheel = () => {
    if (isSpinning || shuffledNames.length === 0) return;

    setIsSpinning(true);

    // Random initial velocity with some variation - increased for longer spin
    const baseVelocity = 25 + Math.random() * 15; // 25-40 degrees per frame
    const velocity = baseVelocity;
    setSpinVelocity(velocity);

    // Reset tick tracking
    lastTickAngle.current = 0;

    const animate = () => {
      setSpinVelocity(prev => {
        const newVelocity = prev * 0.985; // Slower deceleration for longer spin

        setCurrentRotation(prevRot => {
          const newRotation = prevRot + newVelocity;

          // Calculate tick sounds - match the visual pegs exactly
          const pegsPerSegment = 2;
          const totalPegs = shuffledNames.length * pegsPerSegment;
          const pegAngle = 360 / totalPegs;

          // Normalize rotations to 0-360 range for consistent comparison
          const normalizedCurrent = ((newRotation % 360) + 360) % 360;
          const normalizedLast = ((lastTickAngle.current % 360) + 360) % 360;

          // Calculate which peg position we're at
          const currentPegIndex = Math.floor(normalizedCurrent / pegAngle);
          const lastPegIndex = Math.floor(normalizedLast / pegAngle);

          // Play sound and animate ticker when we cross a peg boundary (accounts for wrap-around at 360°)
          if (currentPegIndex !== lastPegIndex && newVelocity > 0.5) {
            playTickSound(newVelocity);

            // Animate the ticker
            setTickerAnimated(true);
            setTimeout(() => setTickerAnimated(false), 100); // Quick flash
          }

          lastTickAngle.current = newRotation;

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

  // Cleanup animation and audio on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
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
    <div className="flex flex-col items-center space-y-6 h-full">
      {/* Wheel Container - Wheel of Names style */}
      <div className="relative">
        {/* Main wheel - classic Wheel of Fortune styling */}
        <div
          ref={wheelRef}
          className="relative w-[600px] h-[600px] rounded-full shadow-2xl"
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
            border: '8px solid #FFD700', // Gold border like classic game shows
            boxShadow: '0 0 30px rgba(255, 215, 0, 0.3), inset 0 0 20px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Wheel pegs/tickers around the edge */}
          {Array.from({ length: shuffledNames.length * 2 }, (_, index) => {
            const pegAngle = (360 / (shuffledNames.length * 2)) * index;
            const pegRadius = 295; // Just inside the border
            const pegX = Math.cos((pegAngle - 90) * Math.PI / 180) * pegRadius;
            const pegY = Math.sin((pegAngle - 90) * Math.PI / 180) * pegRadius;

            return (
              <div
                key={`peg-${index}`}
                className="absolute w-3 h-6 rounded-sm z-20"
                style={{
                  left: `calc(50% + ${pegX}px)`,
                  top: `calc(50% + ${pegY}px)`,
                  transform: `translate(-50%, -50%) rotate(${pegAngle}deg)`,
                  background: 'linear-gradient(135deg, #C0C0C0 0%, #808080 50%, #404040 100%)',
                  border: '1px solid #606060',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.3)',
                }}
              />
            );
          })}

          {/* Center hub - classic game show styling */}
          <div className="absolute top-1/2 left-1/2 w-32 h-32 rounded-full transform -translate-x-1/2 -translate-y-1/2 z-10"
               style={{
                 background: 'radial-gradient(circle, #FFD700 0%, #FFA500 50%, #FF8C00 100%)',
                 border: '4px solid #B8860B',
                 boxShadow: '0 0 15px rgba(255, 215, 0, 0.5), inset 0 2px 5px rgba(255, 255, 255, 0.3)'
               }}>
            <div className="w-full h-full rounded-full flex items-center justify-center">
              <div className="w-10 h-10 rounded-full"
                   style={{
                     background: 'radial-gradient(circle, #8B0000 0%, #DC143C  100%)',
                     boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.3)'
                   }}></div>
            </div>
          </div>

          {/* Player names - positioned radially like Wheel of Fortune */}
          {shuffledNames.map((name, index) => {
            const segmentCenterAngle = segmentAngle * index + segmentAngle / 2;

            // Calculate dynamic radius based on name length
            // Wheel radius is 300px, border is 8px, so usable radius is 292px
            // Estimate text width: roughly 2.8rem = ~45px per character at this font size
            const estimatedTextWidth = name.length * 22; // Conservative estimate
            const maxRadius = 292 - 50; // 50px safety margin from edge for better visual spacing
            const minRadius = 180; // Don't go too close to center

            // Calculate radius that positions the text with good spacing from the wheel edge
            const dynamicRadius = Math.max(minRadius, maxRadius - (estimatedTextWidth / 2));

            const x = Math.cos((segmentCenterAngle - 90) * Math.PI / 180) * dynamicRadius;
            const y = Math.sin((segmentCenterAngle - 90) * Math.PI / 180) * dynamicRadius;

            // Wheel of Fortune style: text always points toward center, readable from outside
            // For proper Wheel of Fortune look, text should be oriented radially
            let rotationAngle = segmentCenterAngle - 90; // Point toward center

            // For segments on the left side (90° to 270°), flip text to keep it readable
            if (segmentCenterAngle > 90 && segmentCenterAngle < 270) {
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
                  maxWidth: '360px',
                  textAlign: 'center',
                  lineHeight: '1.1',
                  fontWeight: '900', // Extra bold for better visibility
                  letterSpacing: '0.5px',
                  fontSize: '2.8rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: '#FFFFFF',
                }}
              >
                {name}
              </div>
            );
          })}
        </div>

        {/* Pointer - classic game show styling */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 translate-y-4 z-40">
          <div className="relative transform rotate-180">
            {/* Main pointer */}
            <div className="w-0 h-0 border-l-16 border-r-16 border-b-32 border-l-transparent border-r-transparent"
                 style={{
                   borderBottomColor: '#FFD700',
                   filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.3))'
                 }}></div>
            {/* Pointer highlight */}
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-16 border-l-transparent border-r-transparent"
                 style={{
                   borderBottomColor: '#FFFF99'
                 }}></div>
          </div>
        </div>

        {/* Static ticker peg that creates the ticking sound */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 translate-y-1 z-50">
          <div
            className={`w-2 h-8 rounded-sm transition-transform duration-150 ease-out ${
              tickerAnimated ? 'transform rotate-12 translate-x-1' : 'transform rotate-0 translate-x-0'
            }`}
            style={{
              background: 'linear-gradient(135deg, #B8860B 0%, #DAA520 50%, #FFD700 100%)',
              border: '1px solid #8B7355',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
              transformOrigin: 'top center', // Pivot from the top like a real ticker
            }}
          />
        </div>
      </div>

      {/* Spin Button - classic game show styling */}
      <Button
        onClick={handleSpin}
        disabled={isSpinning}
        className="font-bold text-lg px-12 py-6 rounded-xl shadow-xl transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        style={{
          background: isSpinning
            ? 'linear-gradient(145deg, #888888, #666666)'
            : 'linear-gradient(145deg, #FFD700, #FFA500, #FF8C00)',
          color: '#000000',
          border: '3px solid #B8860B',
          boxShadow: isSpinning
            ? '0 4px 15px rgba(0, 0, 0, 0.3), inset 0 2px 5px rgba(255, 255, 255, 0.2)'
            : '0 8px 25px rgba(255, 215, 0, 0.4), inset 0 2px 5px rgba(255, 255, 255, 0.3)',
          textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)'
        }}
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