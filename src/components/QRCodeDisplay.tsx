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
          dark: '#FFFFFF', // white QR code pattern
          light: '#00000000' // transparent background
        }
      });
    }
  }, [gameId]);

  return (
    <div className="space-y-4 p-6 bg-black/20 rounded-lg backdrop-blur-sm text-center">
      <div className="flex justify-center">
        <div 
          className="rounded-lg p-4 animated-gradient"
          style={{
            background: 'linear-gradient(45deg, #ff00ff, #00ffff, #ffff00, #ff00ff, #00ffff, #ffff00)',
            backgroundSize: '300% 300%',
            animation: 'gradientShift 4s ease-in-out infinite'
          }}
        >
          <canvas 
            ref={canvasRef}
            className="rounded-lg"
            style={{ background: 'transparent' }}
          />
        </div>
      </div>
    </div>
  );
};

export default QRCodeDisplay;