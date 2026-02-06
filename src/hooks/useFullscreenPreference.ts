import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api-client';

const GUEST_FULLSCREEN_KEY = 'retro-ranks-guest-fullscreen';

export const useFullscreenPreference = () => {
  const { user } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fullscreenEnabled, setFullscreenEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Load fullscreen preference - database for users, localStorage for guests
  useEffect(() => {
    const loadFullscreenPreference = async () => {
      if (user) {
        // Logged in user - load from database (profile should auto-create via trigger)
        try {
          const { data: profile, error } = await api
            .from('profiles')
            .select('fullscreen_enabled')
            .eq('user_id', user.id)
            .single();

          if (error) {
            console.error('Error loading fullscreen preference:', error);
            // Default to false if profile can't be loaded
            setFullscreenEnabled(false);
          } else {
            setFullscreenEnabled(profile?.fullscreen_enabled || false);
          }
        } catch (error) {
          console.error('Error loading fullscreen preference:', error);
          setFullscreenEnabled(false);
        }
      } else {
        // Guest user - use localStorage, default to true (fullscreen enabled)
        try {
          const guestPreference = localStorage.getItem(GUEST_FULLSCREEN_KEY);
          const shouldEnableFullscreen = guestPreference !== null ? guestPreference === 'true' : true; // Default to true for guests

          setFullscreenEnabled(shouldEnableFullscreen);

          // Skip auto-fullscreen for guests - requires user gesture
        } catch (error) {
          console.warn('Error accessing localStorage:', error);
          // Default to fullscreen enabled if localStorage is not available
          setFullscreenEnabled(true);

          // Skip auto-fullscreen - requires user gesture
        }
      }

      setLoading(false);
    };

    loadFullscreenPreference();
  }, [user]);

  // Monitor actual fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Save fullscreen preference - database for users, localStorage for guests
  const updateFullscreenPreference = async (enabled: boolean) => {
    try {
      if (user) {
        // Logged in user - save to database
        try {
          const { error } = await api
            .from('profiles')
            .update({ fullscreen_enabled: enabled })
            .eq('user_id', user.id);

          if (error) {
            console.error('Error updating fullscreen preference:', error);
          }
        } catch (error) {
          console.error('Error updating fullscreen preference:', error);
        }
      } else {
        // Guest user - save to localStorage
        try {
          localStorage.setItem(GUEST_FULLSCREEN_KEY, enabled.toString());
        } catch (error) {
          console.warn('Could not save guest fullscreen preference to localStorage:', error);
        }
      }

      setFullscreenEnabled(enabled);

      // Apply the preference immediately
      if (enabled && !document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
        } catch (err) {
          console.warn('Could not enter fullscreen:', err);
        }
      } else if (!enabled && document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch (err) {
          console.warn('Could not exit fullscreen:', err);
        }
      }
    } catch (error) {
      console.error('Failed to update fullscreen preference:', error);
      // Don't throw the error, just log it to prevent breaking the UI
      console.warn('Fullscreen preference update failed, but continuing...');
    }
  };

  // Toggle fullscreen preference
  const toggleFullscreenPreference = async () => {
    await updateFullscreenPreference(!fullscreenEnabled);
  };

  // Manual fullscreen toggle (without saving preference)
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn('Fullscreen toggle failed:', error);
    }
  };

  return {
    isFullscreen,
    fullscreenEnabled,
    loading,
    updateFullscreenPreference,
    toggleFullscreenPreference,
    toggleFullscreen,
  };
};