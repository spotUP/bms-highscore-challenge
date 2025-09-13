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
      // Prefer an explicitly configured public site URL to avoid QR codes pointing at preview domains
      const envSiteUrl = (import.meta.env as any).VITE_PUBLIC_SITE_URL || (import.meta.env as any).VITE_SITE_URL;
      const base = (envSiteUrl && typeof envSiteUrl === 'string' ? envSiteUrl : window.location.origin).replace(/\/$/, '');
      const url = `${base}/mobile-entry?game=${gameId}`;
      
      QRCode.toCanvas(canvasRef.current, url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000', // black QR code pattern  
          light: '#FFFFFF00' // transparent background
        }
      }, (error) => {
        if (!error && canvasRef.current) {
          setQrDataUrl(canvasRef.current.toDataURL());
        }
      });
    }
  }, [gameId]);

  return (
    <div className="space-y-4 text-center">
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
                WebkitMaskImage: `url(${qrDataUrl})`,
                maskImage: `url(${qrDataUrl})`,
                WebkitMaskSize: '200px 200px',
                maskSize: '200px 200px',
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