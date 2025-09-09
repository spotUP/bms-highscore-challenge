import React, { useEffect } from 'react';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';

interface PerformanceWrapperProps {
  children: React.ReactNode;
}

const PerformanceWrapper: React.FC<PerformanceWrapperProps> = ({ children }) => {
  const { isLowEnd, isRaspberryPi, enableAnimations } = usePerformanceMode();

  useEffect(() => {
    // Apply performance classes to document body
    const body = document.body;
    
    // Remove any existing performance classes
    body.classList.remove('performance-mode', 'raspberry-pi-mode', 'low-end-device');
    
    // Apply appropriate classes based on device detection
    if (!enableAnimations || isLowEnd) {
      body.classList.add('performance-mode');
    }
    
    if (isRaspberryPi) {
      body.classList.add('raspberry-pi-mode');
    }
    
    if (isLowEnd) {
      body.classList.add('low-end-device');
    }

    // Set additional performance hints for Chromium
    if (isRaspberryPi) {
      // Disable smooth scrolling on Pi for better performance
      document.documentElement.style.scrollBehavior = 'auto';
      
      // Hint to browser about reduced motion preference
      if (!document.documentElement.style.getPropertyValue('--reduce-motion')) {
        document.documentElement.style.setProperty('--reduce-motion', 'reduce');
      }
    }

    return () => {
      // Cleanup on unmount
      body.classList.remove('performance-mode', 'raspberry-pi-mode', 'low-end-device');
    };
  }, [isLowEnd, isRaspberryPi, enableAnimations]);

  return <>{children}</>;
};

export default PerformanceWrapper;
