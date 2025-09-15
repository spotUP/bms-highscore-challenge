import React, { useState, useEffect, useRef } from 'react';
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
  const audioContextRef = useRef<AudioContext | null>(null);

  // Create crowd cheering sound using Web Audio API
  const playCrowdCheer = () => {
    try {
      console.log('Starting crowd cheer function...');

      // Always create a fresh audio context to avoid "closed" state issues
      console.log('Creating fresh audio context...');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      console.log('Audio context state:', audioContext.state);

      if (audioContext.state === 'suspended') {
        console.log('Resuming audio context...');
        audioContext.resume();
      }

      const duration = 4; // 4 seconds of cheering

      // Create multiple noise sources for crowd texture
      const createCrowdLayer = (frequency: number, volume: number, startTime: number, layerDuration: number) => {
        // Generate crowd noise
        const bufferSize = audioContext.sampleRate * layerDuration;
        const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        // Create crowd-like noise with varying intensity
        for (let i = 0; i < bufferSize; i++) {
          const time = i / audioContext.sampleRate;
          const intensity = Math.sin(time * 3) * 0.5 + 0.5; // Varying intensity
          const noise = (Math.random() * 2 - 1) * intensity;
          output[i] = noise * (1 - time / layerDuration * 0.7); // Gradual decay
        }

        const noiseSource = audioContext.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        // Filter for crowd characteristics
        const filter = audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(frequency, audioContext.currentTime + startTime);
        filter.Q.setValueAtTime(2, audioContext.currentTime + startTime);

        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + startTime + 0.1);
        gainNode.gain.linearRampToValueAtTime(volume * 0.8, audioContext.currentTime + startTime + layerDuration * 0.3);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + startTime + layerDuration);

        noiseSource.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);

        noiseSource.start(audioContext.currentTime + startTime);
        noiseSource.stop(audioContext.currentTime + startTime + layerDuration);
      };

      // Layer multiple frequency bands for realistic crowd sound
      console.log('Creating crowd layers...');
      createCrowdLayer(200, 0.15, 0, duration);     // Low voices
      createCrowdLayer(500, 0.12, 0.1, duration);   // Mid voices
      createCrowdLayer(1200, 0.08, 0.2, duration);  // High voices/cheers
      createCrowdLayer(800, 0.10, 0.05, duration);  // Mixed voices

      // Add some applause-like clicks
      console.log('Adding applause clicks...');
      for (let i = 0; i < 20; i++) {
        const clickTime = Math.random() * duration * 0.8;
        setTimeout(() => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();

          osc.frequency.setValueAtTime(2000 + Math.random() * 1000, audioContext.currentTime);
          gain.gain.setValueAtTime(0.05, audioContext.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);

          osc.type = 'square';
          osc.connect(gain);
          gain.connect(audioContext.destination);

          osc.start(audioContext.currentTime);
          osc.stop(audioContext.currentTime + 0.1);
        }, clickTime * 1000);
      }

      console.log('Crowd cheer setup complete!');

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
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="theme-card border-white/20 max-w-7xl w-[98vw] max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="animated-gradient text-xl text-center">
              Spin the Wheel
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-[85vh] overflow-y-auto">
            {!winner ? (
              <WheelOfFortune names={leaderboardNames} onWinner={handleWinner} />
            ) : (
              <div className="text-center space-y-6">
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