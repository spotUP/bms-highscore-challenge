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
    '#FF8C00', // Dark Orange (changed from Bright Orange)
    '#FF8C00', // Dark Orange (changed from Golden Orange)
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
  const [wheelNames, setWheelNames] = useState<string[]>([]);
  const [segmentColors, setSegmentColors] = useState<string[]>([]);
  const wheelRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const lastTickAngle = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [tickerAnimated, setTickerAnimated] = useState(false);

  // Initialize colors and use names directly (allowing duplicates)
  useEffect(() => {
    setSegmentColors(getSegmentColors());
    setWheelNames(names); // Use names directly without shuffling to allow duplicates
  }, [names]);

  const segmentAngle = 360 / wheelNames.length;

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
    if (isSpinning || wheelNames.length === 0) return;

    setIsSpinning(true);

    // Random initial velocity with some variation - doubled for much longer spin
    const baseVelocity = 50 + Math.random() * 30; // 50-80 degrees per frame (doubled)
    const velocity = baseVelocity;
    setSpinVelocity(velocity);

    // Reset tick tracking
    lastTickAngle.current = 0;

    const animate = () => {
      setSpinVelocity(prev => {
        let newVelocity = prev * 0.992; // Even slower deceleration for much longer spin

        setCurrentRotation(prevRot => {
          let actualNewRotation = prevRot + newVelocity;

          // Calculate tick sounds - match the visual pegs exactly
          const pegsPerSegment = 2;
          const totalPegs = wheelNames.length * pegsPerSegment;
          const pegAngle = 360 / totalPegs;

          // Normalize rotations to 0-360 range for consistent comparison
          const normalizedCurrent = ((actualNewRotation % 360) + 360) % 360;
          const normalizedLast = ((lastTickAngle.current % 360) + 360) % 360;

          // Calculate which peg position we're at
          const currentPegIndex = Math.floor(normalizedCurrent / pegAngle);
          const lastPegIndex = Math.floor(normalizedLast / pegAngle);

          // Play sound and animate ticker when we cross a peg boundary (accounts for wrap-around at 360°)
          if (currentPegIndex !== lastPegIndex) {
            // Add friction effect - if wheel is moving very slowly, ticker might stick/catch
            const frictionThreshold = 2.0; // Velocity below which ticker has friction
            const shouldTick = newVelocity > frictionThreshold || Math.random() > 0.3; // 70% chance to tick even when slow

            if (shouldTick) {
              playTickSound(newVelocity);

              // Animate the ticker with rubberband spring effect
              setTickerAnimated(true);
              // Spring back after the peg passes
              setTimeout(() => setTickerAnimated(false), 400); // Much longer for boingier effect
            }
            // If we don't tick due to friction, add extra deceleration and bounce-back effect
            else if (newVelocity <= frictionThreshold) {
              // Add significant friction when ticker catches
              newVelocity *= 0.7; // Dramatic slow down

              // Create bounce-back effect - wheel temporarily reverses direction slightly
              const bounceAmount = Math.random() * 0.5 + 0.2; // 0.2 to 0.7 degrees
              actualNewRotation = prevRot - bounceAmount; // Small bounce backwards
            }
          }

          lastTickAngle.current = actualNewRotation;

          if (newVelocity > 0.1) {
            animationRef.current = requestAnimationFrame(animate);
            return actualNewRotation;
          } else {
            // Wheel has stopped - calculate winner
            // The pointer is at the top (0 degrees), so we need to find which segment it's pointing to
            // We need to account for the fact that segments start from the top and go clockwise
            const normalizedRotation = ((actualNewRotation % 360) + 360) % 360;
            // Calculate which segment the pointer is pointing to
            // Since segments are positioned clockwise from the top, we need to reverse the calculation
            // Add 1 to account for the offset (pointer points to the correct segment)
            const segmentIndex = Math.floor(normalizedRotation / segmentAngle);
            const winnerIndex = (wheelNames.length - segmentIndex - 1) % wheelNames.length;
            const winner = wheelNames[winnerIndex];

            console.log('Winner calculation:', {
              currentRotation: actualNewRotation,
              normalizedRotation,
              segmentAngle,
              segmentIndex,
              winnerIndex,
              winner,
              wheelNames
            });

            setTimeout(() => {
              setIsSpinning(false);
              onWinner(winner);
            }, 500); // Small delay for dramatic effect

            return actualNewRotation;
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

  // Spin the wheel directly without reshuffling
  const handleSpin = () => {
    spinWheel();
  };

  if (wheelNames.length === 0) {
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
            background: `conic-gradient(${wheelNames.map((_, index) => {
              const color = segmentColors[index % segmentColors.length];
              const startAngle = (360 / wheelNames.length) * index;
              const endAngle = (360 / wheelNames.length) * (index + 1);
              return `${color} ${startAngle}deg ${endAngle}deg`;
            }).join(', ')})`,
            transition: isSpinning ? 'none' : 'transform 0.2s ease-out',
            willChange: isSpinning ? 'transform' : 'auto',
            border: '8px solid #FFD700', // Gold border like classic game shows
            boxShadow: '0 0 30px rgba(255, 215, 0, 0.3), inset 0 0 20px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Wheel pegs/tickers around the edge */}
          {Array.from({ length: wheelNames.length * 2 }, (_, index) => {
            const pegAngle = (360 / (wheelNames.length * 2)) * index;
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

          {/* Hypnotic spiral overlay */}
          <div className="absolute inset-0 w-full h-full rounded-full z-5 pointer-events-none overflow-hidden">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 600 600"
              className="absolute inset-0"
              style={{ mixBlendMode: 'overlay' }}
            >
              <defs>
                {/* Gradient for varying spiral width */}
                <linearGradient id="spiralGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255, 255, 255, 0.1)" stopWidth="2"/>
                  <stop offset="50%" stopColor="rgba(255, 255, 255, 0.6)" stopWidth="20"/>
                  <stop offset="100%" stopColor="rgba(255, 255, 255, 0.1)" stopWidth="2"/>
                </linearGradient>
              </defs>

              {/* Create spiral arms with variable width */}
              {Array.from({ length: 6 }, (_, armIndex) => {
                const armOffset = (armIndex * 60); // 6 arms, 60 degrees apart
                const segments = [];

                // Break into very small segments for smooth width variation
                for (let i = 0; i < 540; i += 3) { // Very small 3-degree segments
                  const progress = i / 540; // 0 to 1 along the spiral
                  const angle = (i + armOffset) * Math.PI / 180;
                  const radius = 20 + progress * 270;
                  const x = 300 + radius * Math.cos(angle);
                  const y = 300 + radius * Math.sin(angle);

                  // Next point
                  const nextI = Math.min(i + 3, 540);
                  const nextAngle = (nextI + armOffset) * Math.PI / 180;
                  const nextRadius = 20 + (nextI / 540) * 270;
                  const nextX = 300 + nextRadius * Math.cos(nextAngle);
                  const nextY = 300 + nextRadius * Math.sin(nextAngle);

                  // More dramatic width variation: very thin to very thick
                  const strokeWidth = 1 + Math.sin(progress * Math.PI) * 25; // 1px to 26px

                  segments.push(
                    <path
                      key={`spiral-${armIndex}-${i}`}
                      d={`M ${x} ${y} L ${nextX} ${nextY}`}
                      stroke="white"
                      strokeWidth={strokeWidth}
                      fill="none"
                      strokeLinecap="round"
                    />
                  );
                }

                return segments;
              })}
            </svg>
          </div>

          {/* Rainbow overlay */}
          <div
            className="absolute inset-0 w-full h-full rounded-full z-8 pointer-events-none"
            style={{
              background: `conic-gradient(
                from 0deg,
                rgba(255, 0, 0, 0.6) 0deg,
                rgba(255, 165, 0, 0.6) 51deg,
                rgba(255, 255, 0, 0.6) 102deg,
                rgba(0, 255, 0, 0.6) 153deg,
                rgba(0, 255, 255, 0.6) 180deg,
                rgba(0, 0, 255, 0.6) 204deg,
                rgba(128, 0, 128, 0.6) 255deg,
                rgba(255, 0, 255, 0.6) 306deg,
                rgba(255, 0, 0, 0.6) 360deg
              )`,
              filter: 'saturate(130%) brightness(105%)'
            }}
          />

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
          {wheelNames.map((name, index) => {
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
                  textShadow: '3px 3px 0 #000000, -3px -3px 0 #000000, 3px -3px 0 #000000, -3px 3px 0 #000000, 2px 2px 0 #000000, -2px -2px 0 #000000, 2px -2px 0 #000000, -2px 2px 0 #000000, 1px 1px 0 #000000, -1px -1px 0 #000000, 1px -1px 0 #000000, -1px 1px 0 #000000',
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

      </div>

      {/* Static ticker peg that creates the ticking sound - positioned outside wheel container */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-4 z-50">
        <div
          className={`w-3 h-12 rounded-md ${
            tickerAnimated ? 'animate-ticker-spring' : 'transform rotate-0 translate-x-0'
          }`}
          style={{
            background: 'linear-gradient(135deg, #B8860B 0%, #DAA520 50%, #FFD700 100%)',
            border: '1px solid #8B7355',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
            transformOrigin: 'top center', // Pivot from the top like a real ticker
          }}
        />
      </div>

      {/* Spin Button */}
      <Button
        variant="outline"
        onClick={handleSpin}
        disabled={isSpinning}
        className="text-lg px-12 py-6 transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
          {wheelNames.length} entr{wheelNames.length !== 1 ? 'ies' : 'y'} ready to spin
        </p>
        <p className="text-muted-foreground/70 text-xs mt-1">
          Names can appear multiple times based on entries
        </p>
      </div>
    </div>
  );
};

export default WheelOfFortune;