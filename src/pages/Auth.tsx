import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api-client';
import { getPageLayout, getCardStyle, getButtonStyle, getTypographyStyle, PageHeader, PageContainer } from '@/utils/designSystem';

export default function Auth() {
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
  const [showContinue, setShowContinue] = useState(false);
  const { signIn, signUp, resetPassword, user, isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Password reset now uses email + code flow (no URL tokens).

  // If already signed in, show a quick Continue shortcut and auto-redirect away
  useEffect(() => {
    if (!user) return; // only act when logged in
    if (isPasswordReset) return; // don't redirect during password reset flow

    // Avoid interfering if URL contains auth tokens (handled by the effect above)
    const hasAuthTokens = window.location.search.includes('access_token=') || window.location.hash.includes('access_token=');
    if (hasAuthTokens) return;

    try {
      setShowContinue(true);
      const saved = localStorage.getItem('lastPath');
      // Don’t redirect back to the auth page
      const dest = saved && !saved.startsWith('/auth') ? saved : (isAdmin ? '/admin' : '/');
      const timer = setTimeout(() => navigate(dest, { replace: true }), 1000);
      return () => clearTimeout(timer);
    } catch {
      const timer = setTimeout(() => navigate(isAdmin ? '/admin' : '/', { replace: true }), 1000);
      return () => clearTimeout(timer);
    }
  }, [user, isAdmin, isPasswordReset, navigate]);

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
        navigate(`/auth/verify?type=recovery&email=${encodeURIComponent(resetEmail)}`);
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
      const { error } = await api.auth.updateUser({
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
            <CardTitle className={getTypographyStyle('h2')}>Retro Ranks</CardTitle>
            <CardDescription className="text-gray-400">
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user && showContinue && (
              <div className="mb-4 p-3 rounded-md border border-white/20 bg-black/30 text-white flex items-center justify-between gap-3">
                <div className="text-sm">
                  You’re already signed in{user.email ? ` as ${user.email}` : ''}.
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    try {
                      const saved = localStorage.getItem('lastPath');
                      const dest = saved && !saved.startsWith('/auth') ? saved : (isAdmin ? '/admin' : '/');
                      navigate(dest, { replace: true });
                    } catch {
                      navigate(isAdmin ? '/admin' : '/', { replace: true });
                    }
                  }}
                >
                  Continue
                </Button>
              </div>
            )}
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
