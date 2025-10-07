import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import AdvancedConfetti from './AdvancedConfetti';

interface PlayerInsultProps {
  isVisible: boolean;
  playerName: string;
  onComplete: () => void;
}

const PLAYER_MESSAGES = {
  ronny: [
    "Nice try, Ronny! Maybe next time you'll actually try to win! 😂",
    "Ronny, that score is so low, even a broken arcade machine could beat it! 🎮",
    "Wow Ronny, did you even look at the screen while playing? 🤔",
    "Ronny, your gaming skills are about as sharp as a rubber duck! 🦆",
    "Hey Ronny, I think you forgot to turn on your brain before playing! 🧠",
    "Ronny, that score makes me wonder if you were playing with your feet! 👣",
    "Nice one Ronny! Your score is so bad, it's actually impressive! 🏆",
    "Ronny, did you accidentally submit your shoe size instead of your score? 👟",
    "Wow Ronny, even my grandma could beat that score with her eyes closed! 👵",
    "Ronny, your gaming performance is like a broken record - consistently terrible! 💿",
    "Hey Ronny, I think you need to go back to gaming kindergarten! 🎓",
    "Ronny, that score is so low, it's practically underground! ⛏️",
    "Nice try Ronny! Your score is like a participation trophy - it exists! 🏅",
    "Ronny, did you let your pet goldfish play for you? 🐠",
    "Wow Ronny, your score is so bad, it's almost artistic! 🎨",
    "Hey Ronny, I think you need to upgrade from a potato to a computer! 🥔",
    "Ronny, your gaming skills are like a broken pencil - pointless! ✏️",
    "Nice one Ronny! Your score is so low, it's in the basement! 🏠",
    "Ronny, did you accidentally play the game in reverse? ⏪",
    "Wow Ronny, even a random number generator could do better! 🎲"
  ],
  lars: [
    "Lars, that score is so terrible, it should be in a museum! 🏛️",
    "Hey Lars, did you use a banana as a controller? 🍌",
    "Wow Lars, your gaming skills are about as useful as a chocolate teapot! ☕",
    "Lars, that score makes me think you were playing with oven mitts on! 🧤",
    "Nice try Lars! Your score is so low, it's digging its own grave! ⚰️",
    "Lars, did you accidentally submit your age instead of your score? 👴",
    "Wow Lars, even a sloth could beat that score! 🦥",
    "Hey Lars, I think you need to go back to gaming preschool! 🎒",
    "Lars, your score is so bad, it's actually impressive in its own way! 🎭",
    "Lars, did you let your cat play for you? 🐱",
    "Wow Lars, your gaming performance is like a broken calculator - useless! 🧮",
    "Hey Lars, I think you need to upgrade from a rock to a computer! 🪨",
    "Lars, your gaming skills are like a flat tire - going nowhere! 🚗",
    "Nice one Lars! Your score is so low, it's in the sub-basement! 🏗️",
    "Lars, did you accidentally play the game upside down? 🔄",
    "Wow Lars, even a broken clock could do better twice a day! ⏰",
    "Hey Lars, your score is so bad, it's almost poetic! 📝",
    "Lars, did you use a spoon as a joystick? 🥄",
    "Wow Lars, your gaming skills are like a wet noodle - floppy! 🍝",
    "Lars, that score is so terrible, it's actually kind of beautiful! 🌸"
  ],
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
      const playerKey = playerName.toLowerCase() as keyof typeof PLAYER_MESSAGES;
      const playerMessages = PLAYER_MESSAGES[playerKey] || PLAYER_MESSAGES.default;
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
            background: (playerName.toLowerCase() === 'ronny' || playerName.toLowerCase() === 'lars')
              ? 'linear-gradient(135deg, #dc2626, #ea580c, #f59e0b)' // Red/orange for Ronny and Lars
              : 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)', // Gold gradient for everyone else
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            border: '2px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          <div className="text-4xl mb-4">
            {(playerName.toLowerCase() === 'ronny' || playerName.toLowerCase() === 'lars') ? '🎮' : '👑'}
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
