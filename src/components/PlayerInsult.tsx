import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import AdvancedConfetti from './AdvancedConfetti';

interface PlayerInsultProps {
  isVisible: boolean;
  playerName: string;
  onComplete: () => void;
}

const PLAYER_MESSAGES = {
  default: [
    "That score is absolutely GLORIOUS! You are the gaming champion! 👑",
    "Wow! Your gaming skills are legendary - you're a true arcade master! 🏆",
    "That score is so amazing, it should be carved in stone! 🗿",
    "Incredible! You play like a gaming god descended from the heavens! ⚡",
    "Your score is so high, it's practically touching the stars! ⭐",
    "Magnificent! You are the gaming equivalent of a superhero! 🦸‍♂️",
    "That score is so brilliant, it's lighting up the entire arcade! 💡",
    "Outstanding! You play with the precision of a master craftsman! 🎯",
    "Your gaming prowess is so legendary, it should be in a museum! 🏛️",
    "Spectacular! You are the gaming equivalent of a rock star! 🎸",
    "That score is so phenomenal, it's breaking the sound barrier! 🚀",
    "Extraordinary! You play like you have gaming superpowers! 💪",
    "Your score is so magnificent, it's making the arcade machines bow! 🤖",
    "Incredible! You are the gaming equivalent of a wizard! 🧙‍♂️",
    "That score is so amazing, it's creating a gaming legend! 📚",
    "Fantastic! You play with the grace of a gaming ballerina! 🩰",
    "Your gaming skills are so legendary, they should be studied! 🔬",
    "Brilliant! You are the gaming equivalent of a master chef! 👨‍🍳",
    "That score is so glorious, it's making the high score table weep with joy! 😭",
    "Magnificent! You are the gaming equivalent of a Nobel Prize winner! 🏅"
  ]
};

const PlayerInsult: React.FC<PlayerInsultProps> = ({ isVisible, playerName, onComplete }) => {
  const [currentInsult, setCurrentInsult] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const messageSelectedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isVisible && !messageSelectedRef.current) {
      // Pick a random message for the specific player (only once)
      // All players now get positive messages
      const playerMessages = PLAYER_MESSAGES.default;
      const randomMessage = playerMessages[Math.floor(Math.random() * playerMessages.length)];
      setCurrentInsult(randomMessage);
      setIsAnimating(true);
      messageSelectedRef.current = true;
      
      // Start confetti effect
      setShowConfetti(true);

      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Hide after 10 seconds
      timerRef.current = setTimeout(() => {
        setIsAnimating(false);
        setShowConfetti(false); // Stop confetti
        setTimeout(() => {
          onComplete(); // Use the original callback directly
        }, 400); // Wait for elastic bounce out animation (400ms)
      }, 10000);
    } else if (!isVisible) {
      // Reset when component becomes invisible
      messageSelectedRef.current = false;
      setCurrentInsult('');
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isVisible, playerName, onComplete]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!isVisible) return null;

  return createPortal(
    <>
      {/* Confetti Effect */}
      <AdvancedConfetti 
        isActive={showConfetti} 
        onComplete={() => setShowConfetti(false)}
      />
      
      {/* Message Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
        <div
          className={`
            text-white p-8 rounded-2xl shadow-2xl
            text-center max-w-md mx-4 transform
            ${isAnimating ? 'elastic-bounce-in' : 'elastic-bounce-out'}
          `}
          style={{
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)', // Gold gradient for everyone
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            border: '2px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          <div className="text-4xl mb-4">
            👑
          </div>
          <p className="text-lg leading-relaxed font-medium">
            {currentInsult}
          </p>
        </div>
      </div>
    </>,
    document.body
  );
};

export default PlayerInsult;
