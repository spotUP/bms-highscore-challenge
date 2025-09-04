import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';

interface QRCodeDisplayProps {
  gameId: string;
  gameName: string;
}

const QRCodeDisplay = ({ gameId, gameName }: QRCodeDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (canvasRef.current) {
      const url = `${window.location.origin}/mobile-entry?game=${gameId}`;
      
      QRCode.toCanvas(canvasRef.current, url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#00FFFF', // arcade-neonCyan
          light: '#0000' // transparent
        }
      });
    }
  }, [gameId]);

  return (
    <div className="space-y-4 p-6 bg-black/20 rounded-lg backdrop-blur-sm text-center">
      <div className="flex justify-center">
        <canvas 
          ref={canvasRef}
          className="border-2 border-arcade-neonCyan/30 rounded-lg bg-black/40 p-4 animated-gradient-border"
          style={{
            background: 'linear-gradient(45deg, #ff00ff, #00ffff, #ffff00, #ff00ff, #00ffff, #ffff00)',
            backgroundSize: '300% 300%',
            animation: 'gradientShift 4s ease-in-out infinite',
            padding: '4px'
          }}
        />
      </div>
    </div>
  );
};

export default QRCodeDisplay;