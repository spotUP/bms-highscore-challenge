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
      <h3 className="text-xl font-bold text-arcade-neonYellow flex items-center justify-center gap-2">
        <QrCode className="animate-glow" />
        Submit Score
      </h3>
      <div className="flex justify-center">
        <canvas 
          ref={canvasRef}
          className="border-2 border-arcade-neonCyan/30 rounded-lg bg-black/40 p-4"
        />
      </div>
      <p className="text-sm text-gray-300">
        Scan with your phone to submit a score for <span className="text-arcade-neonCyan font-semibold">{gameName}</span>
      </p>
    </div>
  );
};

export default QRCodeDisplay;