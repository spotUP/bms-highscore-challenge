import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface UsePageTransitionsOptions {
  exitDuration?: number;
  onExitStart?: () => void;
  onExitComplete?: () => void;
}

export const usePageTransitions = (options: UsePageTransitionsOptions = {}) => {
  const { exitDuration = 600, onExitStart, onExitComplete } = options;
  const navigate = useNavigate();
  const location = useLocation();
  const [isExiting, setIsExiting] = useState(false);
  const exitingRef = useRef(false);

  // Create a custom navigate function that triggers exit animations
  const animatedNavigate = useCallback((to: string, options?: any) => {
    console.log(' animatedNavigate called:', to, 'current:', location.pathname);

    if (to !== location.pathname && !exitingRef.current) {
      console.log(' Starting exit animation');
      exitingRef.current = true;
      setIsExiting(true);
      onExitStart?.();

      // Complete navigation after animation
      setTimeout(() => {
        console.log(' Animation complete, navigating to:', to);
        setIsExiting(false);
        exitingRef.current = false;
        onExitComplete?.();
        navigate(to, options);
      }, exitDuration);
    } else {
      console.log(' Navigation blocked - same path or already exiting');
    }
  }, [location.pathname, exitDuration, navigate, onExitStart, onExitComplete]);


  return {
    isExiting,
    exitDuration,
    animatedNavigate
  };
};