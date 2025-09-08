import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();

  const roles = [
    { value: 'admin', label: 'Admin', color: 'destructive' },
    { value: 'moderator', label: 'Moderator', color: 'secondary' },
    { value: 'user', label: 'User', color: 'outline' }
  ];

  useEffect(() => {
    loadUsers();
    loadUserRoles();
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
      const { error } = await supabase
        .from('user_roles')
        .upsert(
          { user_id: userId, role: newRole, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );

      if (error) {
        throw error;
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
    if (!newUserEmail) return;

    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: newUserEmail, role: newUserRole }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast({
          title: "Success",
          description: `Invitation sent to ${newUserEmail}`,
        });

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
        description: error instanceof Error ? error.message : "Failed to invite user.",
        variant: "destructive",
      });
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', user_id: userId }
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
                            onClick={() => deleteUser(user.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
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
