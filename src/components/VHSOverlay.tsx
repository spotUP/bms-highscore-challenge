import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';

const VHSOverlay: React.FC = () => {
  const { theme } = useTheme();
  const { enableAnimations } = usePerformanceMode();
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (theme !== 'tron' || !enableAnimations || prefersReduced) return null;

  return (
    <div className="vhs-overlay">
      <div className="vhs-layer vhs-scanlines" />
      <div className="vhs-layer vhs-flicker" />
      <div className="vhs-layer vhs-glitchbars" />
    </div>
  );
};

export default VHSOverlay;
