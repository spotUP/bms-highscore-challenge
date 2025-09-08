import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import WheelOfFortune from './WheelOfFortune';
import AdvancedConfetti from './AdvancedConfetti';

interface SpinTheWheelProps {
  isOpen: boolean;
  onClose: () => void;
  leaderboardNames: string[];
}

const SpinTheWheel = ({ isOpen, onClose, leaderboardNames }: SpinTheWheelProps) => {
  const [winner, setWinner] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleWinner = (winnerName: string) => {
    console.log('Winner received:', winnerName);
    console.log('Available names:', leaderboardNames);
    setWinner(winnerName);
    setShowConfetti(true);
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


  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="bg-gray-900 text-white border-white/20 max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden">
          <div className="py-6 max-h-[70vh] overflow-y-auto">
            {!winner ? (
              <WheelOfFortune names={leaderboardNames} onWinner={handleWinner} />
            ) : (
              <div className="text-center space-y-6">
                <div className="text-6xl animate-bounce">🎉</div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-bold text-arcade-neonYellow animate-pulse">
                    Congratulations!
                  </h2>
                  <h3 className="text-3xl font-bold text-arcade-neonPink">
                    {winner}
                  </h3>
                  <p className="text-xl text-gray-300">
                    You are our lucky winner! 🏆
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-center gap-4 pt-6">
                  <Button
                    onClick={resetWheel}
                    className="bg-arcade-neonCyan hover:bg-arcade-neonCyan/80 text-black font-bold"
                  >
                    Spin Again
                  </Button>
                  <Button
                    onClick={handleClose}
                    variant="outline"
                    className="border-white text-white hover:bg-white hover:text-black"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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