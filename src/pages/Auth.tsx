import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getPageLayout, getCardStyle, getButtonStyle, getTypographyStyle, PageHeader, PageContainer } from '@/utils/designSystem';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [username, setUsername] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if this is a password reset flow
  useEffect(() => {
    // Check both URL search params and hash fragment
    const type = searchParams.get('type');
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    
    // Also check hash fragment for error information
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const hashType = hashParams.get('type');
    const hashAccessToken = hashParams.get('access_token');
    const hashRefreshToken = hashParams.get('refresh_token');
    const error = hashParams.get('error');
    const errorCode = hashParams.get('error_code');
    const errorDescription = hashParams.get('error_description');
    
    // Debug logging
    console.log('URL params:', { type, accessToken: !!accessToken, refreshToken: !!refreshToken });
    console.log('Hash params:', { type: hashType, accessToken: !!hashAccessToken, refreshToken: !!hashRefreshToken, error, errorCode });
    console.log('Full URL:', window.location.href);

    // Handle error cases from hash
    if (error) {
      if (errorCode === 'otp_expired') {
        // Prefer type from hash (Supabase uses hash fragment), fallback to search param
        const expiredType = (hashType || type) === 'recovery' ? 'recovery' : 'invite';
        toast({
          variant: "destructive",
          title: "Link expired",
          description: "Your link expired or was auto-clicked by a scanner. You can verify using the 6-digit code."
        });
        // Send the user to the code verification page with a preselected flow and email if we have it
        let forwardUrl = `/auth/verify?type=${expiredType}`;
        if (expiredType === 'recovery') {
          try {
            const last = localStorage.getItem('last_reset_email');
            if (last) forwardUrl += `&email=${encodeURIComponent(last)}`;
          } catch {}
        }
        navigate(forwardUrl);
      } else {
        toast({
          variant: "destructive",
          title: "Reset link error",
          description: errorDescription || "There was an error with the password reset link."
        });
        const errType = (hashType || type) === 'recovery' ? 'recovery' : 'invite';
        let expiredUrl = `/auth/expired?type=${errType}&error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`;
        if (errType === 'recovery') {
          try {
            const last = localStorage.getItem('last_reset_email');
            if (last) expiredUrl += `&email=${encodeURIComponent(last)}`;
          } catch {}
        }
        navigate(expiredUrl);
      }
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Check for valid tokens (from either search params or hash)
    const finalType = type || hashType;
    const finalAccessToken = accessToken || hashAccessToken;
    const finalRefreshToken = refreshToken || hashRefreshToken;

    if (finalType === 'recovery' && finalAccessToken && finalRefreshToken) {
      console.log('Setting password reset mode');
      setIsPasswordReset(true);
      // Set the session with the tokens from the URL
      supabase.auth.setSession({
        access_token: finalAccessToken,
        refresh_token: finalRefreshToken
      }).then(({ data, error }) => {
        if (error) {
          console.error('Error setting session:', error);
          toast({
            variant: "destructive",
            title: "Invalid reset link",
            description: "This password reset link is invalid or has expired."
          });
          setIsPasswordReset(false);
        } else {
          console.log('Session set successfully for password reset');
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      });
    } else if ((finalType === 'signup' || finalType === 'magiclink') && finalAccessToken && finalRefreshToken) {
      console.log('Handling signup/magiclink redirect; setting session');
      supabase.auth.setSession({
        access_token: finalAccessToken,
        refresh_token: finalRefreshToken
      }).then(({ data, error }) => {
        if (error) {
          console.error('Error setting session after signup:', error);
          toast({
            variant: "destructive",
            title: "Sign in link error",
            description: "There was a problem completing sign in. Please try again."
          });
        } else {
          toast({
            title: "Welcome!",
            description: "Your account has been confirmed and you are signed in."
          });
          // Clean up URL and navigate home
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate('/');
        }
      });
    } else {
      console.log('Not a password reset flow or missing parameters');
    }
  }, [searchParams, toast]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    // Remove annoying loading state
    // setIsLoading(true);

    try {
      const { error } = await signIn(email, password, remember);
      if (error) {
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description: error.message
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You've successfully signed in."
        });
        navigate('/');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred"
      });
    } finally {
      // setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signUp(email, password, username);
      if (error) {
        toast({
          variant: "destructive",
          title: "Sign up failed",
          description: error.message
        });
      } else {
        toast({
          title: "Account created!",
          description: "Check your email to confirm your account."
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Persist the last reset email so we can prefill on /auth/verify if link is expired
      try { localStorage.setItem('last_reset_email', resetEmail); } catch {}
      const { error } = await resetPassword(resetEmail);
      if (error) {
        toast({
          variant: "destructive",
          title: "Password reset failed",
          description: error.message
        });
      } else {
        toast({
          title: "Password reset sent!",
          description: "Check your email for password reset instructions."
        });
        setShowForgotPassword(false);
        setResetEmail('');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same."
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters long."
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Password update failed",
          description: error.message
        });
      } else {
        toast({
          title: "Password updated!",
          description: "Your password has been successfully updated."
        });
        setIsPasswordReset(false);
        navigate('/');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show password reset form if this is a password reset flow
  if (isPasswordReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
            <CardDescription>
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" variant="outline" className="w-full" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pageLayout = getPageLayout();
  
  return (
    <div {...pageLayout}>
      <div className="flex items-center justify-center min-h-screen">
        <Card className={getCardStyle('primary') + " w-full max-w-md mx-4"}>
          <CardHeader className="text-center">
            <CardTitle className={getTypographyStyle('h2')}>Arcade Highscores</CardTitle>
            <CardDescription className="text-gray-400">
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox id="remember-me" checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                    <Label htmlFor="remember-me">Remember me</Label>
                  </div>
                  <Button type="submit" variant="outline">
                  Sign In
                  </Button>
                </div>
                <div className="text-center mt-4">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm text-muted-foreground"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    Forgot your password?
                  </Button>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-username">Username</Label>
                  <Input
                    id="signup-username"
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" variant="outline" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Creating account...' : 'Sign Up'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            If your email link expired or was auto-clicked by a scanner, you can
            <Link to="/auth/verify" className="ml-1 underline">verify using the 6-digit code</Link>.
          </div>
        </CardContent>
      </Card>

      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>
                Enter your email address and we'll send you a password reset link.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="Enter your email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmail('');
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="outline" className="flex-1" disabled={isLoading}>
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}