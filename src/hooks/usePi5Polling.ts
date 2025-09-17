import { useEffect, useRef, useCallback, useMemo } from 'react';

interface Pi5PollingConfig {
  enabled: boolean;
  interval: number;
  onPoll: () => void;
  onVisibilityChange?: () => void;
}

export const usePi5Polling = ({ enabled, interval, onPoll, onVisibilityChange }: Pi5PollingConfig) => {
  const intervalRef = useRef<NodeJS.Timeout>();
  const lastPollRef = useRef<number>(0);
  const isActiveRef = useRef<boolean>(true);

  // Memoized Pi5 detection to prevent constant re-calculation and logging
  const isPi5Firefox = useMemo(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isFirefox = userAgent.includes('firefox');
    const isLinux = userAgent.includes('linux');
    const isARM = userAgent.includes('aarch64') || userAgent.includes('armv');
    const result = isFirefox && isLinux && isARM;

    // Only log once when memoized
    console.log('Pi5 Detection (memoized):', {
      userAgent,
      isFirefox,
      isLinux,
      isARM,
      result
    });

    return result;
  }, []); // Empty dependency array ensures this runs only once

  // Aggressive polling function
  const poll = useCallback(() => {
    const now = Date.now();

    // Prevent too frequent polling
    if (now - lastPollRef.current < interval - 1000) {
      return;
    }

    lastPollRef.current = now;
    console.log('Pi5 Polling: Executing poll at', new Date().toISOString());

    try {
      onPoll();
    } catch (error) {
      console.error('Pi5 Polling: Error during poll:', error);
    }
  }, [interval, onPoll]);

  // Set up aggressive polling for Pi 5
  useEffect(() => {
    if (!enabled) return;

    const needsAgressivePolling = isPi5Firefox;

    if (needsAgressivePolling) {
      console.log('Pi5 Polling: Setting up aggressive polling every', interval, 'ms');

      // Initial poll
      setTimeout(poll, 1000);

      // Regular polling
      intervalRef.current = setInterval(poll, interval);

      // Poll when tab becomes visible
      const handleVisibilityChange = () => {
        if (!document.hidden && isActiveRef.current) {
          console.log('Pi5 Polling: Tab became visible, polling immediately');
          setTimeout(poll, 500);
          if (onVisibilityChange) {
            onVisibilityChange();
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Poll on window focus
      const handleFocus = () => {
        if (isActiveRef.current) {
          console.log('Pi5 Polling: Window focused, polling immediately');
          setTimeout(poll, 500);
        }
      };

      window.addEventListener('focus', handleFocus);

      // Poll on mouse/keyboard activity (throttled)
      let activityTimeout: NodeJS.Timeout;
      const handleActivity = () => {
        if (activityTimeout) clearTimeout(activityTimeout);
        activityTimeout = setTimeout(() => {
          if (isActiveRef.current && Date.now() - lastPollRef.current > 10000) {
            console.log('Pi5 Polling: User activity detected, polling');
            poll();
          }
        }, 2000);
      };

      // Light activity monitoring
      document.addEventListener('click', handleActivity, { passive: true });
      document.addEventListener('keydown', handleActivity, { passive: true });

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        if (activityTimeout) {
          clearTimeout(activityTimeout);
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('click', handleActivity);
        document.removeEventListener('keydown', handleActivity);
        isActiveRef.current = false;
      };
    }
  }, [enabled, interval, poll, onVisibilityChange, isPi5Firefox]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      isActiveRef.current = false;
    };
  }, []);

  return {
    forcePoll: poll,
    isPi5: isPi5Firefox
  };
};