import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PlayerInsultProps {
  isVisible: boolean;
  playerName: string;
  onComplete: () => void;
}

const PLAYER_INSULTS = {
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
  ]
};

const PlayerInsult: React.FC<PlayerInsultProps> = ({ isVisible, playerName, onComplete }) => {
  const [currentInsult, setCurrentInsult] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      // Pick a random insult for the specific player
      const playerInsults = PLAYER_INSULTS[playerName.toLowerCase() as keyof typeof PLAYER_INSULTS];
      if (playerInsults) {
        const randomInsult = playerInsults[Math.floor(Math.random() * playerInsults.length)];
        setCurrentInsult(randomInsult);
        setIsAnimating(true);
      }

      // Hide after 10 seconds
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setTimeout(() => {
          onComplete();
        }, 500); // Wait for fade out animation
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
      <div 
        className={`
          bg-gradient-to-r from-red-600 to-orange-500 text-white p-8 rounded-2xl shadow-2xl 
          text-center max-w-md mx-4 transform transition-all duration-500 ease-in-out
          ${isAnimating ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}
        `}
        style={{
          background: 'linear-gradient(135deg, #dc2626, #ea580c, #f59e0b)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          border: '2px solid rgba(255, 255, 255, 0.2)'
        }}
      >
        <div className="text-4xl mb-4">🎮</div>
        <h2 className="text-2xl font-bold mb-4 text-yellow-200">
          Special Message for {playerName}!
        </h2>
        <p className="text-lg leading-relaxed font-medium">
          {currentInsult}
        </p>
        <div className="mt-6 text-sm text-yellow-100 opacity-75">
          This message will disappear in 10 seconds...
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PlayerInsult;
