import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { supabase } from '@/integrations/supabase/client';
import { TestTube, CheckCircle, AlertCircle, Clock, Mail, Send, Settings } from 'lucide-react';
import { getCardStyle, getTypographyStyle } from '@/utils/designSystem';

const FunctionTests: React.FC = () => {
  const [manageHealth, setManageHealth] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [inviteHealth, setInviteHealth] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [manageErrorDetail, setManageErrorDetail] = useState<string | null>(null);
  const [inviteErrorDetail, setInviteErrorDetail] = useState<string | null>(null);
  const [isHealthDialogOpen, setIsHealthDialogOpen] = useState(false);
  const [isEmailTestDialogOpen, setIsEmailTestDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [emailTestRunning, setEmailTestRunning] = useState(false);
  const [emailTestResults, setEmailTestResults] = useState<any>(null);
  const [smtpTestRunning, setSmtpTestRunning] = useState(false);
  const [smtpTestResults, setSmtpTestResults] = useState<any>(null);
  const { toast } = useToast();

  const testEmailDelivery = async (email: string) => {
    if (!email || !email.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setEmailTestRunning(true);
    setEmailTestResults(null);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess?.session?.access_token;

      if (!accessToken) {
        toast({
          title: "Not signed in",
          description: "Please sign in to run email tests.",
          variant: "destructive",
        });
        return;
      }


      // Test the invite-user function with actual email delivery
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, role: 'user' },
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const results = {
        timestamp: new Date().toISOString(),
        email,
        success: !error && data?.success,
        fallbackUsed: data?.action_link ? true : false,
        message: data?.message,
        actionLink: data?.action_link,
        userData: data?.user,
        error: error || null,
        rawResponse: data
      };

      setEmailTestResults(results);

      if (results.success) {
        if (results.fallbackUsed) {
          toast({
            title: "Email Test - Fallback Used ⚠️",
            description: `Invite link generated instead of email. SMTP may not be configured.`,
            variant: "destructive",
            action: (
              <ToastAction altText="View details" onClick={() => setIsEmailTestDialogOpen(true)}>
                View Details
              </ToastAction>
            ),
          });
        } else {
          toast({
            title: "Email Test Success ✅",
            description: `Invitation email should be sent to ${email}`,
          });
        }
      } else {
        toast({
          title: "Email Test Failed ❌",
          description: results.error?.message || "Email delivery test failed",
          variant: "destructive",
          action: (
            <ToastAction altText="View details" onClick={() => setIsEmailTestDialogOpen(true)}>
              View Details
            </ToastAction>
          ),
        });
      }
    } catch (err: any) {
      console.error('Email test error:', err);
      setEmailTestResults({
        timestamp: new Date().toISOString(),
        email,
        success: false,
        error: err,
        message: `Exception: ${err.message}`
      });

      toast({
        title: "Email Test Error ❌",
        description: err?.message || 'Email test failed with exception',
        variant: "destructive",
        action: (
          <ToastAction altText="View details" onClick={() => setIsEmailTestDialogOpen(true)}>
            View Details
          </ToastAction>
        ),
      });
    } finally {
      setEmailTestRunning(false);
    }
  };

  const diagnoseSMTPIssue = async () => {
    setSmtpTestRunning(true);
    setSmtpTestResults(null);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess?.session?.access_token;

      if (!accessToken) {
        toast({
          title: "Not signed in",
          description: "Please sign in to run SMTP diagnostics.",
          variant: "destructive",
        });
        return;
      }


      // Test with a very specific diagnostic approach
      const diagnosticEmail = 'smtp-test-' + Date.now() + '@example.com';

      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: diagnosticEmail, role: 'user' },
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      // Capture extensive diagnostic info
      const diagnostics = {
        timestamp: new Date().toISOString(),
        testEmail: diagnosticEmail,
        functionSuccess: !error && data?.success,
        fallbackDetected: !!(data?.action_link),
        supabaseError: error,
        responseData: data,

        // Analysis
        smtpConfigured: !data?.action_link, // If no action_link, SMTP worked
        errorPattern: error?.message || data?.message || 'No error message',

        // Common SMTP Issues
        possibleIssues: []
      };

      // Analyze the response for common SMTP issues
      const errorMsg = (error?.message || data?.message || '').toLowerCase();

      if (diagnostics.fallbackDetected) {
        diagnostics.possibleIssues.push('SMTP not configured or failed - fallback link generated');

        if (errorMsg.includes('smtp')) {
          diagnostics.possibleIssues.push('SMTP-specific error detected');
        }
        if (errorMsg.includes('authentication') || errorMsg.includes('auth')) {
          diagnostics.possibleIssues.push('SMTP authentication failure');
        }
        if (errorMsg.includes('tls') || errorMsg.includes('ssl')) {
          diagnostics.possibleIssues.push('TLS/SSL connection issue');
        }
        if (errorMsg.includes('timeout') || errorMsg.includes('connection')) {
          diagnostics.possibleIssues.push('Connection timeout or network issue');
        }
        if (errorMsg.includes('rate') || errorMsg.includes('limit')) {
          diagnostics.possibleIssues.push('Rate limiting or quota exceeded');
        }
      }

      setSmtpTestResults(diagnostics);

      if (diagnostics.smtpConfigured) {
        toast({
          title: "SMTP Working ✅",
          description: `SMTP appears to be configured correctly`,
        });
      } else {
        toast({
          title: "SMTP Issue Detected ⚠️",
          description: `${diagnostics.possibleIssues.length} potential issues found`,
          variant: "destructive",
          action: (
            <ToastAction altText="View diagnostics" onClick={() => setIsEmailTestDialogOpen(true)}>
              View Diagnostics
            </ToastAction>
          ),
        });
      }

    } catch (err: any) {
      console.error('SMTP diagnostic error:', err);
      setSmtpTestResults({
        timestamp: new Date().toISOString(),
        error: err,
        possibleIssues: ['Diagnostic test failed with exception']
      });

      toast({
        title: "Diagnostic Error ❌",
        description: err?.message || 'SMTP diagnostic failed',
        variant: "destructive",
      });
    } finally {
      setSmtpTestRunning(false);
    }
  };

  const checkFunctionHealth = async (opts?: { silent?: boolean }) => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess?.session?.access_token;
      if (!accessToken) {
        toast({
          title: "Not signed in",
          description: "Please sign in to run function health checks.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'health' },
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (error) {
        setManageHealth('error');
        setManageErrorDetail(JSON.stringify(error, null, 2));
        throw error;
      }

      if (data?.configured) {
        setManageHealth('ok');
        setManageErrorDetail(null);
        if (!opts?.silent) {
          toast({
            title: "Manage-Users Function Healthy",
            description: `Secrets present: URL=${data.hasSupabaseUrl ? 'yes' : 'no'}, ServiceKey=${data.hasServiceKey ? 'yes' : 'no'}`,
          });
        }
      } else {
        setManageHealth('error');
        setManageErrorDetail(JSON.stringify(data, null, 2));
        if (!opts?.silent) {
          toast({
            title: "Function Not Configured",
            description: `Missing secrets. URL=${data?.hasSupabaseUrl ? 'yes' : 'no'}, ServiceKey=${data?.hasServiceKey ? 'yes' : 'no'}`,
            variant: "destructive",
            action: (
              <ToastAction altText="View details" onClick={() => setIsHealthDialogOpen(true)}>
                View details
              </ToastAction>
            ),
          });
        }
      }
    } catch (err: any) {
      console.error('Health check failed:', err);
      if (!opts?.silent) {
        toast({
          title: "Error",
          description: err?.message || 'Failed to check function health',
          variant: "destructive",
          action: (
            <ToastAction altText="View details" onClick={() => setIsHealthDialogOpen(true)}>
              View details
            </ToastAction>
          ),
        });
      }
    }
  };

  const checkInviteFunctionHealth = async (opts?: { silent?: boolean }) => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess?.session?.access_token;
      if (!accessToken) {
        toast({
          title: "Not signed in",
          description: "Please sign in to run function health checks.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { action: 'health' },
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (error) {
        setInviteHealth('error');
        setInviteErrorDetail(JSON.stringify(error, null, 2));
        throw error;
      }

      if (data?.configured) {
        setInviteHealth('ok');
        setInviteErrorDetail(null);
        if (!opts?.silent) {
          toast({
            title: "Invite-User Function Healthy",
            description: `Secrets present: URL=${data.hasSupabaseUrl ? 'yes' : 'no'}, ServiceKey=${data.hasServiceKey ? 'yes' : 'no'}`,
          });
        }
      } else {
        setInviteHealth('error');
        setInviteErrorDetail(JSON.stringify(data, null, 2));
        if (!opts?.silent) {
          toast({
            title: "Function Not Configured",
            description: `Missing secrets. URL=${data?.hasSupabaseUrl ? 'yes' : 'no'}, ServiceKey=${data?.hasServiceKey ? 'yes' : 'no'}`,
            variant: "destructive",
            action: (
              <ToastAction altText="View details" onClick={() => setIsHealthDialogOpen(true)}>
                View details
              </ToastAction>
            ),
          });
        }
      }
    } catch (err: any) {
      console.error('Invite health check failed:', err);
      if (!opts?.silent) {
        toast({
          title: "Error",
          description: err?.message || 'Failed to check invite function health',
          variant: "destructive",
          action: (
            <ToastAction altText="View details" onClick={() => setIsHealthDialogOpen(true)}>
              View details
            </ToastAction>
          ),
        });
      }
    }
  };

  const checkAllFunctionsHealth = async (opts?: { silent?: boolean }) => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess?.session?.access_token;
      if (!accessToken) {
        toast({
          title: "Not signed in",
          description: "Please sign in to run function health checks.",
          variant: "destructive",
        });
        return;
      }

      const headers = { Authorization: `Bearer ${accessToken}` } as Record<string, string>;
      const [manageRes, inviteRes] = await Promise.allSettled([
        supabase.functions.invoke('manage-users', { body: { action: 'health' }, headers }),
        supabase.functions.invoke('invite-user', { body: { action: 'health' }, headers }),
      ]);

      const manageOk = manageRes.status === 'fulfilled' && (manageRes.value.data?.configured === true);
      const inviteOk = inviteRes.status === 'fulfilled' && (inviteRes.value.data?.configured === true);

      setManageHealth(manageOk ? 'ok' : 'error');
      setInviteHealth(inviteOk ? 'ok' : 'error');
      if (manageRes.status === 'rejected') setManageErrorDetail(String(manageRes.reason));
      if (inviteRes.status === 'rejected') setInviteErrorDetail(String(inviteRes.reason));

      if (manageOk && inviteOk) {
        if (!opts?.silent) {
          toast({
            title: "All Functions Healthy",
            description: "manage-users: OK • invite-user: OK",
          });
        }
      } else {
        const manageMsg = manageOk ? 'OK' : 'ERR';
        const inviteMsg = inviteOk ? 'OK' : 'ERR';
        if (!opts?.silent) {
          toast({
            title: "Function Health Issues",
            description: `manage-users: ${manageMsg} • invite-user: ${inviteMsg}`,
            variant: "destructive",
            action: (
              <ToastAction altText="View details" onClick={() => setIsHealthDialogOpen(true)}>
                View details
              </ToastAction>
            ),
          });
        }
      }
    } catch (err: any) {
      console.error('All functions health failed:', err);
      if (!opts?.silent) {
        toast({
          title: "Error",
          description: err?.message || 'Failed to check functions health',
          variant: "destructive",
          action: (
            <ToastAction altText="View details" onClick={() => setIsHealthDialogOpen(true)}>
              View details
            </ToastAction>
          ),
        });
      }
    }
  };

  useEffect(() => {
    // Initial silent health refresh and periodic auto-refresh (every 2 minutes)
    checkAllFunctionsHealth({ silent: true });
    const t = setInterval(() => checkAllFunctionsHealth({ silent: true }), 120000);
    return () => clearInterval(t);
  }, []);

  const getHealthIcon = (status: 'unknown' | 'ok' | 'error') => {
    switch (status) {
      case 'ok': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getHealthBadge = (status: 'unknown' | 'ok' | 'error') => {
    const variants = {
      ok: 'bg-green-600/20 text-green-400',
      error: 'bg-red-600/20 text-red-400',
      unknown: 'bg-gray-600/20 text-gray-300'
    };
    const text = {
      ok: 'OK',
      error: 'ERR',
      unknown: 'UNKNOWN'
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${variants[status]}`}>
        {text[status]}
      </span>
    );
  };

  return (
    <>
      <Card className={getCardStyle('primary')}>
        <CardHeader>
          <CardTitle className={`${getTypographyStyle('h3')} flex items-center gap-2`}>
            <TestTube className="w-5 h-5 text-blue-400" />
            Function Health Tests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getHealthIcon(manageHealth)}
                <span className="font-medium">manage-users</span>
                {getHealthBadge(manageHealth)}
              </div>
              <p className="text-sm text-gray-400">Handles user role management</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getHealthIcon(inviteHealth)}
                <span className="font-medium">invite-user</span>
                {getHealthBadge(inviteHealth)}
              </div>
              <p className="text-sm text-gray-400">Sends user invitations</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => checkAllFunctionsHealth()}>
              Test All Functions
            </Button>
            <Button variant="outline" onClick={() => checkFunctionHealth()}>
              Test Manage Users
            </Button>
            <Button variant="outline" onClick={() => checkInviteFunctionHealth()}>
              Test Invite Function
            </Button>
            <Button variant="outline" onClick={() => setIsHealthDialogOpen(true)}>
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Card className={getCardStyle('primary')}>
        <CardHeader>
          <CardTitle className={`${getTypographyStyle('h3')} flex items-center gap-2`}>
            <Mail className="w-5 h-5 text-green-400" />
            Email Delivery Tests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-email" className="text-white">Test Email Address</Label>
            <div className="flex gap-2">
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="bg-gray-800 border-gray-600 text-white"
                disabled={emailTestRunning}
              />
              <Button
                onClick={() => testEmailDelivery(testEmail)}
                disabled={emailTestRunning || !testEmail}
                variant={emailTestResults?.fallbackUsed ? "destructive" : emailTestResults?.success ? "default" : "outline"}
              >
                <Send className="w-4 h-4 mr-2" />
                {emailTestRunning ? 'Testing...' : 'Test Email'}
              </Button>
            </div>
          </div>

          {emailTestResults && (
            <div className={`p-3 rounded border ${
              emailTestResults.success
                ? emailTestResults.fallbackUsed
                  ? 'bg-yellow-900/20 border-yellow-600 text-yellow-200'
                  : 'bg-green-900/20 border-green-600 text-green-200'
                : 'bg-red-900/20 border-red-600 text-red-200'
            }`}>
              <div className="flex items-center gap-2 font-medium mb-2">
                {emailTestResults.success ? (
                  emailTestResults.fallbackUsed ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {emailTestResults.success
                  ? emailTestResults.fallbackUsed
                    ? 'Fallback Used (SMTP Issue)'
                    : 'Email Test Success'
                  : 'Email Test Failed'
                }
              </div>
              <p className="text-sm opacity-90">{emailTestResults.message}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEmailTestDialogOpen(true)}
                className="mt-2 p-0 h-auto text-xs"
              >
                View Full Results →
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={diagnoseSMTPIssue}
              disabled={smtpTestRunning}
              className="bg-yellow-600 hover:bg-yellow-700 text-black"
            >
              <Settings className="w-4 h-4 mr-2" />
              {smtpTestRunning ? 'Diagnosing...' : 'Diagnose SMTP Issue'}
            </Button>
          </div>

          {smtpTestResults && (
            <div className="bg-yellow-900/20 border border-yellow-600 rounded p-3 text-yellow-200">
              <div className="flex items-center gap-2 font-medium mb-2">
                <AlertCircle className="w-4 h-4" />
                SMTP Diagnostic Results
              </div>
              <div className="text-sm space-y-1">
                <div>Status: <span className={smtpTestResults.smtpConfigured ? 'text-green-400' : 'text-red-400'}>
                  {smtpTestResults.smtpConfigured ? 'SMTP Working' : 'SMTP Issues Detected'}
                </span></div>
                {smtpTestResults.possibleIssues.length > 0 && (
                  <div>Issues Found: {smtpTestResults.possibleIssues.length}</div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEmailTestDialogOpen(true)}
                className="mt-2 p-0 h-auto text-xs"
              >
                View Full Diagnostics →
              </Button>
            </div>
          )}

          <div className="bg-blue-900/20 border border-blue-600 rounded p-3 text-sm text-blue-200">
            <div className="flex items-start gap-2">
              <Settings className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">Email Troubleshooting</p>
                <ul className="space-y-1 text-blue-300/80">
                  <li>• If fallback is used, Supabase SMTP is not configured correctly</li>
                  <li>• Check Auth → Settings → SMTP in Supabase dashboard</li>
                  <li>• Verify SMTP credentials and test connection</li>
                  <li>• Use "Diagnose SMTP Issue" button for detailed analysis</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
        </Card>
      </div>

      {/* Functions Health Details Dialog */}
      <Dialog open={isHealthDialogOpen} onOpenChange={setIsHealthDialogOpen}>
        <DialogContent className="bg-gray-900 text-white border-white/20 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Functions Health & Setup</DialogTitle>
            <DialogDescription>
              Current status for manage-users and invite-user Edge Functions and how to configure secrets.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="font-semibold">manage-users</div>
              {getHealthBadge(manageHealth)}
              {manageErrorDetail && (
                <pre className="text-xs bg-gray-800 p-2 rounded mt-2 whitespace-pre-wrap">
                  {manageErrorDetail}
                </pre>
              )}
            </div>
            <div>
              <div className="font-semibold">invite-user</div>
              {getHealthBadge(inviteHealth)}
              {inviteErrorDetail && (
                <pre className="text-xs bg-gray-800 p-2 rounded mt-2 whitespace-pre-wrap">
                  {inviteErrorDetail}
                </pre>
              )}
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="font-semibold mb-2">Setup Instructions:</div>
              <p className="text-sm text-gray-300">
                To configure these functions, set the following secrets in your Supabase project:
              </p>
              <ul className="text-sm text-gray-300 mt-2 space-y-1">
                <li>• <code>SUPABASE_URL</code> - Your project URL</li>
                <li>• <code>SUPABASE_SERVICE_ROLE_KEY</code> - Your service role key</li>
              </ul>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsHealthDialogOpen(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Test Results Dialog */}
      <Dialog open={isEmailTestDialogOpen} onOpenChange={setIsEmailTestDialogOpen}>
        <DialogContent className="bg-gray-900 text-white border-white/20 max-w-3xl">
          <DialogHeader>
            <DialogTitle>Email Delivery Test Results</DialogTitle>
            <DialogDescription>
              Detailed analysis of the email delivery test and troubleshooting information.
            </DialogDescription>
          </DialogHeader>

          {(emailTestResults || smtpTestResults) && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="font-semibold mb-2">Test Summary</div>
                  <div className="space-y-2 text-sm">
                    {emailTestResults && (
                      <>
                        <div>Email: <span className="font-mono">{emailTestResults.email}</span></div>
                        <div>Timestamp: <span className="font-mono text-xs">{new Date(emailTestResults.timestamp).toLocaleString()}</span></div>
                        <div>Success: <span className={emailTestResults.success ? 'text-green-400' : 'text-red-400'}>{emailTestResults.success ? 'Yes' : 'No'}</span></div>
                        <div>Fallback Used: <span className={emailTestResults.fallbackUsed ? 'text-yellow-400' : 'text-green-400'}>{emailTestResults.fallbackUsed ? 'Yes (SMTP Issue)' : 'No'}</span></div>
                      </>
                    )}
                    {smtpTestResults && (
                      <>
                        <div>SMTP Test: <span className="font-mono text-xs">{new Date(smtpTestResults.timestamp).toLocaleString()}</span></div>
                        <div>SMTP Status: <span className={smtpTestResults.smtpConfigured ? 'text-green-400' : 'text-red-400'}>{smtpTestResults.smtpConfigured ? 'Working' : 'Issues Detected'}</span></div>
                        <div>Issues Found: <span className="text-yellow-400">{smtpTestResults.possibleIssues?.length || 0}</span></div>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="font-semibold mb-2">Diagnosis</div>
                  <div className="text-sm space-y-1">
                    {emailTestResults?.fallbackUsed && (
                      <div className="text-yellow-400">⚠️ Email provider not configured - using fallback link</div>
                    )}
                    {emailTestResults?.success && !emailTestResults?.fallbackUsed && (
                      <div className="text-green-400">✅ Email should be delivered successfully</div>
                    )}
                    {emailTestResults && !emailTestResults.success && (
                      <div className="text-red-400">❌ Email delivery failed completely</div>
                    )}
                    {smtpTestResults?.possibleIssues?.map((issue, idx) => (
                      <div key={idx} className="text-yellow-400">• {issue}</div>
                    ))}
                  </div>
                </div>
              </div>

              {emailTestResults?.actionLink && (
                <div>
                  <div className="font-semibold mb-2">Generated Link (Fallback)</div>
                  <div className="bg-gray-800 p-3 rounded">
                    <code className="text-xs break-all">{emailTestResults.actionLink}</code>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Since email delivery failed, this link was generated as a fallback invitation method.</p>
                </div>
              )}

              {emailTestResults?.error && (
                <div>
                  <div className="font-semibold mb-2 text-red-400">Error Details</div>
                  <pre className="text-xs bg-gray-800 p-3 rounded overflow-auto max-h-32">
{JSON.stringify(emailTestResults.error, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <div className="font-semibold mb-2">Full Response</div>
                <pre className="text-xs bg-gray-800 p-3 rounded overflow-auto max-h-40">
{JSON.stringify(emailTestResults?.rawResponse || emailTestResults, null, 2)}
                </pre>
              </div>

              <div className="bg-blue-900/20 border border-blue-600 rounded p-3">
                <div className="font-semibold mb-2">Troubleshooting Steps</div>
                <div className="text-sm space-y-2">
                  {emailTestResults?.fallbackUsed ? (
                    <>
                      <p><strong>Issue:</strong> SMTP is not configured in Supabase</p>
                      <div>
                        <strong>Fix:</strong>
                        <ol className="list-decimal list-inside mt-1 space-y-1 ml-4">
                          <li>Go to Supabase Dashboard → Authentication → Settings</li>
                          <li>Scroll to "SMTP Settings" section</li>
                          <li>Configure your email provider (Gmail, SendGrid, etc.)</li>
                          <li>Enable SMTP and test the connection</li>
                          <li>Re-run this test after configuration</li>
                        </ol>
                      </div>
                    </>
                  ) : emailTestResults?.success ? (
                    <>
                      <p><strong>Status:</strong> Email should be delivered successfully</p>
                      <p><strong>Next Steps:</strong></p>
                      <ul className="list-disc list-inside ml-4">
                        <li>Check the recipient's inbox (including spam folder)</li>
                        <li>Verify email provider limits and quotas</li>
                        <li>Check Supabase logs for any delivery errors</li>
                      </ul>
                    </>
                  ) : (
                    <>
                      <p><strong>Issue:</strong> Complete email delivery failure</p>
                      <p><strong>Check:</strong></p>
                      <ul className="list-disc list-inside ml-4">
                        <li>Supabase function logs for detailed errors</li>
                        <li>Network connectivity and permissions</li>
                        <li>Authentication token validity</li>
                      </ul>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEmailTestDialogOpen(false)}>Close</Button>
                <Button onClick={() => testEmailDelivery(emailTestResults?.email)} disabled={emailTestRunning}>
                  Re-test Email
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FunctionTests;