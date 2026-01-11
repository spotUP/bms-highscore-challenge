import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import WheelOfFortune from './WheelOfFortune';
import AdvancedConfetti from './AdvancedConfetti';
import BoingModal from './BoingModal';

interface SpinTheWheelProps {
  isOpen: boolean;
  onClose: () => void;
  leaderboardNames: string[];
}

const SpinTheWheel = ({ isOpen, onClose, leaderboardNames }: SpinTheWheelProps) => {
  const [winner, setWinner] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play crowd cheering sound from audio file
  const playCrowdCheer = () => {
    try {
      console.log('Playing crowd cheer audio file...');

      const audio = new Audio('/crowd.mp3');
      audio.volume = 0.7; // Adjust volume as needed
      audio.play().catch(error => {
        console.log('Could not play crowd audio:', error);
      });

      console.log('Crowd cheer audio started!');

    } catch (error) {
      console.log('Audio not available:', error);
    }
  };

  const handleWinner = (winnerName: string) => {
    console.log('Winner received:', winnerName);
    console.log('Available names:', leaderboardNames);
    setWinner(winnerName);
    setShowConfetti(true);

    // Play crowd cheer immediately when winner is announced
    setTimeout(() => {
      console.log('Playing crowd cheer...');
      playCrowdCheer();
    }, 100); // Very small delay to ensure UI updates first
  };

  const handleConfettiComplete = () => {
    setShowConfetti(false);
  };

  const handleClose = () => {
    setWinner(null);
    setShowConfetti(false);
    onClose();
  };

  const resetWheel = () => {
    setWinner(null);
    setShowConfetti(false);
  };

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      // Don't close audio context as it interferes with ongoing sounds
      // Audio contexts will be garbage collected when no longer referenced
    };
  }, []);


  return (
    <>
      <BoingModal
        isOpen={isOpen}
        onClose={handleClose}
        className="theme-card border-white/20 max-w-3xl w-[75vw] max-h-[80vh] overflow-hidden"
      >
        <div className="max-h-[70vh] overflow-y-auto">
            {!winner ? (
              <WheelOfFortune names={leaderboardNames} onWinner={handleWinner} />
            ) : (
              <div className="text-center space-y-6 pt-8">
                <div className="text-6xl animate-bounce">🎉</div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-bold animated-gradient animate-pulse">
                    Congratulations!
                  </h2>
                  <h3 className="text-3xl font-bold animated-gradient-vertical">
                    {winner}
                  </h3>
                  <p className="text-xl text-white/80">
                    You are our lucky winner! 🏆
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row justify-center gap-4 pt-6">
                  <Button
                    onClick={resetWheel}
                    className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold"
                  >
                    Spin Again
                  </Button>
                  <Button
                    onClick={handleClose}
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
        </div>
      </BoingModal>

      {/* Advanced Confetti - Portal to document body */}
      {showConfetti && createPortal(
        <AdvancedConfetti 
          isActive={showConfetti} 
          onComplete={handleConfettiComplete}
        />,
        document.body
      )}
    </>
  );
};

export default SpinTheWheel;