import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from './useAuth';

export interface UserRole {
  user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export const useUserRoles = () => {
  const [userRole, setUserRole] = useState<string>('user');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadUserRole();
    } else {
      setUserRole('user');
      setIsAdmin(false);
      setIsModerator(false);
      setLoading(false);
    }
  }, [user]);

  const loadUserRole = async () => {
    if (!user) return;

    try {
      const { data, error } = await api
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading user role:', error);
        return;
      }

      const role = data?.role || 'user';
      setUserRole(role);
      setIsAdmin(role === 'admin');
      setIsModerator(role === 'admin'); // Only admin for now since moderator doesn't exist in enum
    } catch (error) {
      console.error('Error loading user role:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (requiredRole: string): boolean => {
    const roleHierarchy = {
      'user': 0,
      'moderator': 1,
      'admin': 2
    };

    const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
    const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

    return userLevel >= requiredLevel;
  };

  return {
    userRole,
    isAdmin,
    isModerator,
    loading,
    hasPermission,
    refreshRole: loadUserRole
  };
};
