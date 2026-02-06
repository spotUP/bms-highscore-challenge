import { useState, useEffect, createContext, useContext } from 'react';
import { api, setRememberMe, AuthUser, AuthSession } from '@/lib/api-client';
import { useNetworkStatus } from './useNetworkStatus';

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  signUp: (email: string, password: string, username?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string, remember?: boolean) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rr_isAdmin') === 'true';
    } catch {
      return false;
    }
  });
  const isOnline = useNetworkStatus();
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener
    const { data: { subscription } } = api.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        console.log('Auth state change:', event, session?.user?.email || 'no user');

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Handle session events
        if (event === 'SIGNED_OUT') {
          setIsAdmin(false);
          try { localStorage.removeItem('rr_isAdmin'); } catch {}
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed successfully');
        } else if (event === 'SIGNED_IN' || (event === 'TOKEN_REFRESHED' && session?.user)) {
          // Check admin role for sign-in or successful token refresh
          setTimeout(() => {
            if (mounted && session?.user) {
              checkAdminRole(session.user.id);
            }
          }, 100);
        }
      }
    );

    // Check for existing session with better error handling
    const initializeSession = async () => {
      try {
        const { data: { session }, error } = await api.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error('Error getting session:', error);
          // Try to recover by refreshing session if we have refresh token
          try {
            const { data: refreshData, error: refreshError } = await api.auth.refreshSession();
            if (!refreshError && refreshData?.session && mounted) {
              setSession(refreshData.session);
              setUser(refreshData.session.user);
              setTimeout(() => {
                if (mounted) checkAdminRole(refreshData.session.user.id);
              }, 100);
            }
          } catch (refreshErr) {
            console.error('Session recovery failed:', refreshErr);
          }
        } else {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            setTimeout(() => {
              if (mounted) checkAdminRole(session.user.id);
            }, 100);
          }
        }
      } catch (err) {
        console.error('Session initialization failed:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Network reconnection effect - try to recover session when coming back online
  useEffect(() => {
    if (!isOnline || user) return; // Don't retry if offline or already signed in

    const attemptSessionRecovery = async () => {
      if (retryCount < 3) { // Limit retries
        console.log(`Attempting session recovery (attempt ${retryCount + 1})`);
        try {
          const { data: { session }, error } = await api.auth.getSession();
          if (!error && session && !user) {
            console.log('Session recovered after network reconnection');
            setSession(session);
            setUser(session.user);
            if (session.user) {
              setTimeout(() => checkAdminRole(session.user.id), 100);
            }
            setRetryCount(0); // Reset on success
          }
        } catch (err) {
          console.error('Session recovery failed:', err);
          setRetryCount(prev => prev + 1);
        }
      }
    };

    // Wait a moment after coming online to attempt recovery
    const timer = setTimeout(attemptSessionRecovery, 1000);
    return () => clearTimeout(timer);
  }, [isOnline, user, retryCount]);

  // Reset retry count when user signs in successfully
  useEffect(() => {
    if (user) {
      setRetryCount(0);
    }
  }, [user]);

  const checkAdminRole = async (userId: string) => {
    try {
      const { data, error } = await api
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (!error) {
        const val = !!data;
        setIsAdmin(val);
        try { localStorage.setItem('rr_isAdmin', val ? 'true' : 'false'); } catch {}
      }
    } catch (error) {
      console.error('Error checking admin role:', error);
    }
  };

  const signUp = async (email: string, password: string, username?: string) => {
    // Use /auth so our Auth page can capture tokens on redirect (signup/magiclink)
    const redirectUrl = `${window.location.origin}/auth`;
    
    const { error } = await api.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username: username || email.split('@')[0],
          full_name: username || email.split('@')[0]
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string, remember: boolean = true) => {
    // Persist preference before sign-in so tokens are stored in the desired storage
    setRememberMe(remember);

    // If offline, return a helpful error
    if (!isOnline) {
      return {
        error: {
          message: "No internet connection. Please check your network and try again."
        }
      };
    }

    const { error } = await api.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    
    const { error } = await api.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
  };

  const signOut = async () => {
    await api.auth.signOut();
    setIsAdmin(false);
    try { localStorage.removeItem('rr_isAdmin'); } catch {}
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
