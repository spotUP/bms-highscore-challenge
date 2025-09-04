import React, { useEffect, useState } from 'react';

interface HyperspaceLineProps {
  delay: number;
  duration: number;
  left: string;
  opacity: number;
}

const HyperspaceLine: React.FC<HyperspaceLineProps> = ({ delay, duration, left, opacity }) => {
  return (
    <div
      className="absolute top-0 w-px bg-white"
      style={{
        left,
        height: '100vh',
        opacity,
        animation: `hyperspace ${duration}s linear ${delay}s infinite`,
        transformOrigin: 'center top',
      }}
    />
  );
};

const HyperspaceEffect: React.FC = () => {
  const [lines, setLines] = useState<HyperspaceLineProps[]>([]);

  useEffect(() => {
    // Generate random hyperspace lines
    const generateLines = () => {
      const newLines: HyperspaceLineProps[] = [];
      
      for (let i = 0; i < 100; i++) {
        newLines.push({
          delay: Math.random() * 3,
          duration: 1 + Math.random() * 2, // 1-3 seconds
          left: `${Math.random() * 100}%`,
          opacity: 0.1 + Math.random() * 0.4, // 0.1 to 0.5 opacity
        });
      }
      
      setLines(newLines);
    };

    generateLines();
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-blue-900/5 to-purple-900/10" />
      {lines.map((line, index) => (
        <HyperspaceLine key={index} {...line} />
      ))}
      
      {/* Central glow effect */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-blue-400/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
    </div>
  );
};

export default HyperspaceEffect;