import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, Shield, UserPlus, Edit, Trash2, Mail, Calendar } from 'lucide-react';
import { getCardStyle, getTypographyStyle } from '@/utils/designSystem';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  role?: string;
}

interface UserRole {
  user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const { toast } = useToast();

  // Inline health status badges
  const [manageHealth, setManageHealth] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [inviteHealth, setInviteHealth] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [manageErrorDetail, setManageErrorDetail] = useState<string | null>(null);
  const [inviteErrorDetail, setInviteErrorDetail] = useState<string | null>(null);
  const [isHealthDialogOpen, setIsHealthDialogOpen] = useState(false);

  const roles = [
    { value: 'admin', label: 'Admin', color: 'destructive' },
    { value: 'moderator', label: 'Moderator', color: 'secondary' },
    { value: 'user', label: 'User', color: 'outline' }
  ];

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

  const resendInvite = async (user: User) => {
    try {
      const role = getUserRole(user.id) || 'user';
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: user.email, role }
      });

      if (error) throw error;

      if (data?.success) {
        if (data.action_link) {
          try { await navigator.clipboard.writeText(data.action_link); } catch {}
          toast({
            title: 'Invite re-sent',
            description: `A fresh invite link was generated and copied to your clipboard for ${user.email}.`,
          });
        } else {
          toast({ title: 'Invite re-sent', description: `A new invite has been prepared for ${user.email}.` });
        }
      } else {
        throw new Error(data?.error || 'Failed to resend invite');
      }
    } catch (err: any) {
      console.error('Resend invite failed:', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message || 'Failed to resend invite' });
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
        const manageMsg = manageOk ? 'OK' : 'Missing secrets / error';
        const inviteMsg = inviteOk ? 'OK' : 'Missing secrets / error';
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
            title: "Invite Function Not Configured",
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

  useEffect(() => {
    loadUsers();
    loadUserRoles();
    // Initial silent health refresh and periodic auto-refresh (every 2 minutes)
    checkAllFunctionsHealth({ silent: true });
    const t = setInterval(() => checkAllFunctionsHealth({ silent: true }), 120000);
    return () => clearInterval(t);
  }, []);

  const loadUsers = async () => {
    try {
      // Use Edge Function to get users (has proper admin access)
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list' }
      });
      
      if (error) {
        console.error('Error loading users:', error);
        toast({
          title: "Error",
          description: "Failed to load users. Make sure you have admin privileges.",
          variant: "destructive",
        });
        return;
      }

      if (data.success) {
        setUsers(data.users);
      } else {
        throw new Error(data.error || 'Failed to load users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "Failed to load users.",
        variant: "destructive",
      });
    }
  };

  const loadUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading user roles:', error);
        return;
      }

      setUserRoles(data || []);
    } catch (error) {
      console.error('Error loading user roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserRole = (userId: string): string => {
    const userRole = userRoles.find(role => role.user_id === userId);
    return userRole?.role || 'user';
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      // Check if the role already exists for this user
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole as 'admin' | 'user' })
          .eq('user_id', userId);

        if (error) {
          throw error;
        }
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole as 'admin' | 'user' });

        if (error) {
          throw error;
        }
      }

      toast({
        title: "Success",
        description: "User role updated successfully.",
      });

      loadUserRoles();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role.",
        variant: "destructive",
      });
    }
  };

  const inviteUser = async () => {
    if (!newUserEmail) {
      toast({
        title: "Email required",
        description: "Please enter an email address to invite.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: newUserEmail, role: newUserRole }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        // If we received an invite link from the function, copy it to clipboard and show it
        if (data.action_link) {
          try { await navigator.clipboard.writeText(data.action_link); } catch {}
          toast({
            title: "Invite link ready",
            description: `An invite link was generated and copied to your clipboard. Share it with ${newUserEmail}.`,
          });
        } else {
          toast({
            title: "Success",
            description: `Invitation prepared for ${newUserEmail}`,
          });
        }

        setNewUserEmail('');
        setNewUserRole('user');
        setIsDialogOpen(false);
        loadUsers();
        loadUserRoles();
      } else {
        throw new Error(data.error || 'Failed to invite user');
      }
    } catch (error) {
      console.error('Error inviting user:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : (typeof error === 'string' ? error : "Failed to invite user."),
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', user_id: userToDelete.id }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast({
          title: "Success",
          description: "User deleted successfully.",
        });

        loadUsers();
        loadUserRoles();
        setDeleteDialogOpen(false);
        setUserToDelete(null);
      } else {
        throw new Error(data.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user.",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    const roleConfig = roles.find(r => r.value === role);
    return roleConfig?.color as any || 'outline';
  };

  if (loading) {
    return (
      <Card className={getCardStyle('primary')}>
        <CardHeader>
          <CardTitle className={getTypographyStyle('h3')}>
            <Users className="w-5 h-5 mr-2 inline" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-arcade-neonCyan mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading users...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={getCardStyle('primary')}>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className={getTypographyStyle('h3')}>
            <Users className="w-5 h-5 mr-2 inline" />
            User Management
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsHealthDialogOpen(true)}>
              Function Help
            </Button>
            <Button variant="outline" onClick={() => checkAllFunctionsHealth()}>
              Check All Functions
            </Button>
            <Button variant="outline" onClick={() => checkFunctionHealth()}>
              Check Function Status
              {manageHealth !== 'unknown' && (
                <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs ${manageHealth==='ok' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                  {manageHealth === 'ok' ? 'OK' : 'ERR'}
                </span>
              )}
            </Button>
            <Button variant="outline" onClick={() => checkInviteFunctionHealth()}>
              Check Invite Function
              {inviteHealth !== 'unknown' && (
                <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs ${inviteHealth==='ok' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                  {inviteHealth === 'ok' ? 'OK' : 'ERR'}
                </span>
              )}
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="w-4 h-4 mr-2" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 text-white border-white/20">
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
                <DialogDescription>
                  Send an invitation email to a new user and assign them a role.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="bg-gray-800 border-gray-600"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={newUserRole} onValueChange={setNewUserRole}>
                    <SelectTrigger className="bg-gray-800 border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            {role.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={inviteUser} variant="outline" className="flex-1">
                    Send Invitation
                  </Button>
                  <Button 
                    onClick={() => setIsDialogOpen(false)} 
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
            </Dialog>
          </div>

          {/* Delete User Confirmation Dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="bg-gray-900 text-white border-white/20">
              <DialogHeader>
                <DialogTitle>Delete User</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete {userToDelete?.email}? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 justify-end">
                <Button 
                  onClick={() => setDeleteDialogOpen(false)} 
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={confirmDeleteUser} 
                  variant="destructive"
                >
                  Delete User
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Functions Health Details Dialog */}
          <Dialog open={isHealthDialogOpen} onOpenChange={setIsHealthDialogOpen}>
            <DialogContent className="bg-gray-900 text-white border-white/20 max-w-2xl">
              <DialogHeader>
                <DialogTitle>Functions Health & Setup</DialogTitle>
                <DialogDescription>
                  Current status for manage-users and invite-user Edge Functions and how to configure secrets.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="font-semibold">manage-users</div>
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs mt-1 ${manageHealth==='ok' ? 'bg-green-600/20 text-green-400' : manageHealth==='error' ? 'bg-red-600/20 text-red-400' : 'bg-gray-600/20 text-gray-300'}`}>
                    {manageHealth === 'ok' ? 'OK' : manageHealth === 'error' ? 'ERR' : 'UNKNOWN'}
                  </div>
                  {manageErrorDetail && (
                    <pre className="mt-2 p-2 bg-black/40 border border-white/10 rounded overflow-auto max-h-48 whitespace-pre-wrap">
{manageErrorDetail}
                    </pre>
                  )}
                </div>
                <div>
                  <div className="font-semibold">invite-user</div>
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs mt-1 ${inviteHealth==='ok' ? 'bg-green-600/20 text-green-400' : inviteHealth==='error' ? 'bg-red-600/20 text-red-400' : 'bg-gray-600/20 text-gray-300'}`}>
                    {inviteHealth === 'ok' ? 'OK' : inviteHealth === 'error' ? 'ERR' : 'UNKNOWN'}
                  </div>
                  {inviteErrorDetail && (
                    <pre className="mt-2 p-2 bg-black/40 border border-white/10 rounded overflow-auto max-h-48 whitespace-pre-wrap">
{inviteErrorDetail}
                    </pre>
                  )}
                </div>
                <div className="pt-2 border-t border-white/10">
                  <div className="font-semibold mb-1">Project-level secrets (recommended)</div>
                  <ul className="list-disc pl-5 text-gray-300">
                    <li><code>FUNCTION_SUPABASE_URL</code> = your project URL (e.g., https://tnsgrwntmnzpaifmutqh.supabase.co)</li>
                    <li><code>FUNCTION_SERVICE_ROLE_KEY</code> = your Service Role Key</li>
                    <li><code>PUBLIC_SITE_URL</code> or <code>SITE_URL</code> = your site URL (for invite redirects)</li>
                  </ul>
                  <p className="mt-2 text-gray-400">These are read at runtime by both functions. No redeploy needed after changing.</p>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setIsHealthDialogOpen(false)}>Close</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-gray-400 mb-4">
            Total Users: {users.length} | Admins: {userRoles.filter(r => r.role === 'admin').length}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const userRole = getUserRole(user.id);
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={userRole}
                          onValueChange={(newRole) => updateUserRole(user.id, newRole)}
                        >
                          <SelectTrigger className="w-32">
                            <Badge variant={getRoleBadgeVariant(userRole)}>
                              {roles.find(r => r.value === userRole)?.label || userRole}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                <Badge variant={getRoleBadgeVariant(role.value)}>
                                  {role.label}
                                </Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.email_confirmed_at ? "default" : "secondary"}>
                          {user.email_confirmed_at ? "Confirmed" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span className="text-sm">
                            {new Date(user.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-400">
                          {user.last_sign_in_at 
                            ? new Date(user.last_sign_in_at).toLocaleDateString()
                            : 'Never'
                          }
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteUser(user)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                          {!user.email_confirmed_at && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resendInvite(user)}
                              className="text-arcade-neonCyan hover:text-cyan-300"
                            >
                              Resend Invite
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-400">No users found</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UserManagement;
