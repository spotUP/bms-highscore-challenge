import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

const VHSOverlay: React.FC = () => {
  const { theme } = useTheme();
  if (theme !== 'tron') return null;

  return (
    <div className="vhs-overlay">
      <div className="vhs-layer vhs-scanlines" />
      <div className="vhs-layer vhs-flicker" />
      <div className="vhs-layer vhs-glitchbars" />
    </div>
  );
};

export default VHSOverlay;
