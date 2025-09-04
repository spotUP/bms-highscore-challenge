import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';

interface QRCodeDisplayProps {
  gameId: string;
  gameName: string;
}

const QRCodeDisplay = ({ gameId, gameName }: QRCodeDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  
  useEffect(() => {
    if (canvasRef.current) {
      const url = `${window.location.origin}/mobile-entry?game=${gameId}`;
      
      QRCode.toCanvas(canvasRef.current, url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000', // black QR code pattern
          light: '#FFFFFF' // white background
        }
      }, (error) => {
        if (!error && canvasRef.current) {
          setQrDataUrl(canvasRef.current.toDataURL());
        }
      });
    }
  }, [gameId]);

  return (
    <div className="space-y-4 p-6 bg-black/20 rounded-lg backdrop-blur-sm text-center">
      <div className="flex justify-center">
        <div className="relative">
          <canvas 
            ref={canvasRef}
            className="opacity-0 absolute"
          />
          {qrDataUrl && (
            <div 
              className="rounded-lg"
              style={{
                background: 'linear-gradient(45deg, #ff00ff, #00ffff, #ffff00, #ff00ff, #00ffff, #ffff00)',
                backgroundSize: '300% 300%',
                animation: 'gradientShift 4s ease-in-out infinite',
                WebkitMask: `url(${qrDataUrl})`,
                mask: `url(${qrDataUrl})`,
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
                width: '200px',
                height: '200px'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default QRCodeDisplay;