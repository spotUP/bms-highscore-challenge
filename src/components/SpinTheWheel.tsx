import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import WheelOfFortune from './WheelOfFortune';

interface SpinTheWheelProps {
  isOpen: boolean;
  onClose: () => void;
  leaderboardNames: string[];
}

const SpinTheWheel = ({ isOpen, onClose, leaderboardNames }: SpinTheWheelProps) => {
  const [winner, setWinner] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleWinner = (winnerName: string) => {
    setWinner(winnerName);
    setShowConfetti(true);
    
    // Hide confetti after 5 seconds
    setTimeout(() => {
      setShowConfetti(false);
    }, 5000);
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

  // Confetti animation CSS
  useEffect(() => {
    if (showConfetti) {
      // Create confetti elements
      const confettiContainer = document.getElementById('confetti-container');
      if (confettiContainer) {
        // Clear existing confetti
        confettiContainer.innerHTML = '';
        
        // Create 50 confetti pieces
        for (let i = 0; i < 50; i++) {
          const confetti = document.createElement('div');
          confetti.className = 'confetti-piece';
          confetti.style.left = Math.random() * 100 + '%';
          confetti.style.animationDelay = Math.random() * 3 + 's';
          confetti.style.backgroundColor = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'][Math.floor(Math.random() * 6)];
          confettiContainer.appendChild(confetti);
        }
      }
    }
  }, [showConfetti]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="bg-gray-900 text-white border-white/20 max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-arcade-neonPink via-arcade-neonCyan to-arcade-neonYellow text-transparent bg-clip-text">
              🎡 Spin the Wheel 🎡
            </DialogTitle>
          </DialogHeader>
          
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

      {/* Confetti Container */}
      {showConfetti && (
        <div
          id="confetti-container"
          className="fixed inset-0 pointer-events-none z-[60]"
          style={{
            background: 'transparent'
          }}
        />
      )}

      {/* Global CSS for confetti animation */}
      {showConfetti && (
        <style dangerouslySetInnerHTML={{
          __html: `
            .confetti-piece {
              position: absolute;
              width: 10px;
              height: 10px;
              background: #FFD700;
              animation: confetti-fall 3s linear infinite;
            }

            @keyframes confetti-fall {
              0% {
                transform: translateY(-100vh) rotate(0deg);
                opacity: 1;
              }
              100% {
                transform: translateY(100vh) rotate(720deg);
                opacity: 0;
              }
            }

            .confetti-piece:nth-child(odd) {
              animation-duration: 2.5s;
            }

            .confetti-piece:nth-child(even) {
              animation-duration: 3.5s;
            }

            .confetti-piece:nth-child(3n) {
              animation-duration: 2s;
            }

            .confetti-piece:nth-child(4n) {
              width: 6px;
              height: 6px;
            }

            .confetti-piece:nth-child(5n) {
              width: 12px;
              height: 12px;
            }
          `
        }} />
      )}
    </>
  );
};

export default SpinTheWheel;