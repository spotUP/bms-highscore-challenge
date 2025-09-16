import { useEffect, useRef, useCallback } from 'react';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeConfig {
  fallbackPolling: boolean;
  pollingInterval: number;
  connectionTimeout: number;
  maxRetries: number;
}

export const useRealtimeOptimizations = () => {
  const { isPerformanceMode, isRaspberryPi, isLowEnd } = usePerformanceMode();
  const connectionHealthRef = useRef({ isHealthy: true, retryCount: 0 });
  const fallbackIntervalRef = useRef<NodeJS.Timeout>();

  // Configuration based on device capabilities
  const getConfig = useCallback((): RealtimeConfig => {
    const isLimitedDevice = isPerformanceMode || isRaspberryPi || isLowEnd;

    return {
      fallbackPolling: isLimitedDevice,
      pollingInterval: isLimitedDevice ? 15000 : 30000, // More frequent for fallback
      connectionTimeout: isLimitedDevice ? 3000 : 5000,
      maxRetries: isLimitedDevice ? 2 : 3
    };
  }, [isPerformanceMode, isRaspberryPi, isLowEnd]);

  // Enhanced subscription with fallback
  const createRobustSubscription = useCallback((
    channelName: string,
    tableName: string,
    filter?: string,
    callback?: (payload: any) => void,
    fallbackCallback?: () => void
  ) => {
    const config = getConfig();
    let channel: any;
    let isSubscribed = false;

    const setupSubscription = () => {
      channel = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: tableName,
          ...(filter && { filter })
        }, (payload) => {
          connectionHealthRef.current = { isHealthy: true, retryCount: 0 };
          if (callback) callback(payload);
        })
        .subscribe((status) => {
          console.log(`Realtime subscription ${channelName}:`, status);

          if (status === 'SUBSCRIBED') {
            isSubscribed = true;
            connectionHealthRef.current = { isHealthy: true, retryCount: 0 };
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            connectionHealthRef.current.isHealthy = false;
            connectionHealthRef.current.retryCount++;

            // Start fallback polling if configured
            if (config.fallbackPolling && fallbackCallback) {
              console.log(`Starting fallback polling for ${channelName}`);
              if (fallbackIntervalRef.current) {
                clearInterval(fallbackIntervalRef.current);
              }
              fallbackIntervalRef.current = setInterval(fallbackCallback, config.pollingInterval);
            }
          }
        });

      return channel;
    };

    // Initial setup
    channel = setupSubscription();

    // Cleanup function
    const cleanup = () => {
      if (channel) {
        try {
          channel.unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing channel:', error);
        }
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = undefined;
      }
    };

    return { cleanup, isHealthy: () => connectionHealthRef.current.isHealthy };
  }, [getConfig]);

  // Monitor connection health
  useEffect(() => {
    const config = getConfig();
    let healthCheckInterval: NodeJS.Timeout;

    if (config.fallbackPolling) {
      // Periodic connection health check for Pi/low-end devices
      healthCheckInterval = setInterval(() => {
        if (!connectionHealthRef.current.isHealthy) {
          console.log('Connection unhealthy, may need fallback polling');
        }
      }, 30000);
    }

    return () => {
      if (healthCheckInterval) clearInterval(healthCheckInterval);
      if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);
    };
  }, [getConfig]);

  return {
    createRobustSubscription,
    isConnectionHealthy: () => connectionHealthRef.current.isHealthy,
    config: getConfig()
  };
};