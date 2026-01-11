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
import { supabase } from '@/integrations/supabase/client';
import { Users, Shield, UserPlus, Edit, Trash2, Mail, Calendar } from 'lucide-react';
import { getCardStyle, getTypographyStyle, LoadingSpinner } from '@/utils/designSystem';

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
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [localUsers, setLocalUsers] = useState<User[]>([]);
  const { toast } = useToast();

  const roles = [
    { value: 'admin', label: 'Admin', color: 'destructive' },
    { value: 'moderator', label: 'Moderator', color: 'secondary' },
    { value: 'user', label: 'User', color: 'outline' }
  ];

  const resendInvite = async (user: User) => {
    try {
      const role = getUserRole(user.id) || 'user';
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: user.email,
          role: role
        }
      });

      if (error) throw error;

      toast({
        title: "Invitation Resent",
        description: `Invitation resent to ${user.email} with ${role} role.`,
      });
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to resend invitation",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadUsers();
    loadUserRoles();
  }, []);

  // Update local state when users change
  useEffect(() => {
    setLocalUsers(users);
  }, [users]);

  const loadUsers = async () => {
    try {
      // Use Edge Function to get users (has proper admin access)
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list' }
      });

      if (error) throw error;

      if (data?.success && Array.isArray(data.users)) {
        setUsers(data.users);
      } else if (Array.isArray(data)) {
        // Fallback for direct array response
        setUsers(data);
      } else {
        console.error('Expected users array or success response, got:', data);
        setUsers([]);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*');

      if (error) throw error;
      setUserRoles(data || []);
    } catch (error) {
      console.error('Error loading user roles:', error);
    }
  };

  const getUserRole = (userId: string) => {
    const userRole = userRoles.find(role => role.user_id === userId);
    return userRole?.role || null;
  };

  const inviteUser = async () => {
    if (!newUserEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: newUserEmail.trim(),
          role: newUserRole
        }
      });

      if (error) throw error;

      if (data && data.user) {
        toast({
          title: "Success",
          description: `Invitation sent to ${newUserEmail}`,
        });

        setNewUserEmail('');
        setNewUserRole('user');
        setIsDialogOpen(false);
        loadUsers();
      } else {
        throw new Error('User creation failed - no user data returned');
      }
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to invite user",
        variant: "destructive",
      });
    }
  };

  const createTestUser = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create-test'
        }
      });

      if (error) throw error;

      if (data && data.user) {
        toast({
          title: "✅ Test User Created",
          description: (
            <div className="space-y-1">
              <div><strong>Email:</strong> {data.user.email}</div>
              <div><strong>Password:</strong> {data.user.password}</div>
              <div className="text-xs text-gray-400 mt-2">
                User is ready to login immediately (no email confirmation needed)
              </div>
            </div>
          ),
          duration: 10000, // Show for 10 seconds so user can copy credentials
        });
        loadUsers();
      } else {
        throw new Error('Test user creation failed - no user data returned');
      }
    } catch (error: any) {
      console.error('Error creating test user:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create test user",
        variant: "destructive",
      });
    }
  };

  const handleAnimatedDelete = async (user: User) => {
    // Start the fade-out animation
    setDeletingIds(prev => new Set([...prev, user.id]));

    // Wait for animation, then remove from state (this will trigger the slide-up)
    setTimeout(() => {
      setLocalUsers(prev => prev.filter(u => u.id !== user.id));
      deleteUser(user.id);

      // Clean up animation state after a brief delay to let the slide-up complete
      setTimeout(() => {
        setDeletingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(user.id);
          return newSet;
        });
      }, 50);
    }, 280); // Slightly before animation completes
  };

  const deleteUser = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete',
          user_id: userId
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User deleted successfully.",
      });

      loadUsers();
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: newRole,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User role updated successfully",
      });

      loadUserRoles();
    } catch (error: any) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  if (loading) return (
    <Card className={getCardStyle('primary')}>
      <CardHeader>
        <CardTitle className={`${getTypographyStyle('h3')} flex items-center justify-between`}>
          <span>
            <Users className="w-5 h-5 mr-2 inline" />
            User Management
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="min-h-[200px]" />
      </CardContent>
    </Card>
  );

  return (
    <>
      <Card className={getCardStyle('primary')}>
        <CardHeader>
          <CardTitle className={`${getTypographyStyle('h3')} flex items-center justify-between`}>
            <span>
              <Users className="w-5 h-5 mr-2 inline" />
              User Management
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={createTestUser} className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300">
                <Users className="w-4 h-4 mr-2" />
                Create Test User (Ready to Login)
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
                    Send an invitation to a new user. They'll receive an email with setup instructions.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="text-white">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role" className="text-white">Role</Label>
                    <Select value={newUserRole} onValueChange={setNewUserRole}>
                      <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map(role => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={inviteUser} variant="outline" className="flex-1">
                    Send Invitation
                  </Button>
                </div>
              </DialogContent>
              </Dialog>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border rounded-md overflow-x-auto">
              {/* Header */}
              <div className="grid gap-2 p-3 border-b bg-muted/50 font-medium text-sm min-w-[800px]" style={{ gridTemplateColumns: '2fr 140px 100px 120px 120px 140px' }}>
                <div>Email</div>
                <div>Role</div>
                <div>Status</div>
                <div>Created</div>
                <div>Last Sign In</div>
                <div className="text-right">Actions</div>
              </div>

              {/* Body */}
              <div className="divide-y">
                {localUsers.map((user) => {
                  const userRole = getUserRole(user.id);
                  const role = roles.find(r => r.value === userRole) || roles[2]; // default to 'user'

                  return (
                    <div
                      key={user.id}
                      className={`grid gap-2 p-3 transition-all duration-300 ease-in-out overflow-hidden min-w-[800px] ${
                        deletingIds.has(user.id)
                          ? 'opacity-0 max-h-0 py-0 scale-y-0'
                          : 'opacity-100 max-h-20 scale-y-100'
                      }`}
                      style={{
                        gridTemplateColumns: '2fr 140px 100px 120px 120px 140px',
                        transformOrigin: 'top',
                        transition: 'all 300ms ease-in-out'
                      }}
                    >
                      <div className="font-medium min-w-0">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate" title={user.email}>{user.email}</span>
                        </div>
                      </div>
                      <div>
                        <Select
                          value={userRole || 'user'}
                          onValueChange={(value) => updateUserRole(user.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map(r => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Badge variant={user.email_confirmed_at ? "default" : "secondary"}>
                          {user.email_confirmed_at ? "Confirmed" : "Pending"}
                        </Badge>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-sm text-gray-400">
                          <Calendar className="w-4 h-4" />
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        {user.last_sign_in_at ? (
                          <div className="flex items-center gap-1 text-sm text-gray-400">
                            <Calendar className="w-4 h-4" />
                            {new Date(user.last_sign_in_at).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-gray-500">Never</span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="flex justify-end gap-2">
                          {!user.email_confirmed_at && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resendInvite(user)}
                            >
                              <Mail className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-500 hover:border-red-400 hover:bg-red-500/10"
                            onClick={() => {
                              setUserToDelete(user);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {users.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No users found. Invite your first user to get started.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 text-white border-white/20">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {userToDelete?.email}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-red-500 hover:border-red-400 hover:bg-red-500/10"
              onClick={() => {
                if (userToDelete) {
                  setDeleteDialogOpen(false);
                  handleAnimatedDelete(userToDelete);
                }
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserManagement;