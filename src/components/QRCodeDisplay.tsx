import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';
import { useTournament } from '@/contexts/TournamentContext';

interface QRCodeDisplayProps {
  gameId: string;
  gameName: string;
}

const QRCodeDisplay = ({ gameId, gameName }: QRCodeDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const performanceCanvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const { isPerformanceMode, isRaspberryPi, isLowEnd } = usePerformanceMode();
  const { currentTournament } = useTournament();

  // Check if we should use simplified QR code
  const useSimpleQR = isPerformanceMode || isRaspberryPi || isLowEnd;

  useEffect(() => {
    const targetCanvas = useSimpleQR ? performanceCanvasRef.current : canvasRef.current;

    if (targetCanvas) {
      // Prefer an explicitly configured public site URL to avoid QR codes pointing at preview domains
      const envSiteUrl = (import.meta.env as any).VITE_PUBLIC_SITE_URL || (import.meta.env as any).VITE_SITE_URL;
      const base = (envSiteUrl && typeof envSiteUrl === 'string' ? envSiteUrl : window.location.origin).replace(/\/$/, '');

      // Use tournament-scoped URL if there's a current tournament
      const url = currentTournament
        ? `${base}/t/${currentTournament.slug}/mobile-entry?game=${gameId}`
        : `${base}/mobile-entry?game=${gameId}`;

      // For performance mode, use solid colors for better readability
      const colors = useSimpleQR
        ? {
            dark: '#00FFFF', // Cyan for better visibility
            light: '#000000' // Black background for contrast
          }
        : {
            dark: '#000000', // black QR code pattern
            light: '#FFFFFF00' // transparent background
          };

      QRCode.toCanvas(targetCanvas, url, {
        width: 200,
        margin: 2,
        color: colors
      }, (error) => {
        if (!error && !useSimpleQR && canvasRef.current) {
          setQrDataUrl(canvasRef.current.toDataURL());
        }
      });
    }
  }, [gameId, useSimpleQR, currentTournament]);

  // Performance mode: Simple, readable QR code
  if (useSimpleQR) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="relative">
            <canvas
              ref={performanceCanvasRef}
              className="border-2 border-cyan-500 rounded-lg shadow-lg"
              style={{
                boxShadow: '0 0 20px rgba(0, 255, 255, 0.5)'
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Standard mode: Animated gradient QR code
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