import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  created_by: string; // This is what the database has, not owner_id
  is_public: boolean;
  created_at: string;
  updated_at: string;
  // Optional properties that may not exist in database
  owner_id?: string;
  is_active?: boolean;
  logo_url?: string | null;
  theme_color?: string;
  demolition_man_active?: boolean; // Toggle for Demolition Man leaderboard
}

export interface TournamentMember {
  id: string;
  tournament_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member'; // Updated to match database enum
  joined_at: string;
  invited_by: string | null;
  is_active: boolean;
}

interface TournamentContextType {
  currentTournament: Tournament | null;
  userTournaments: Tournament[];
  currentUserRole: string | null;
  loading: boolean;
  switchTournament: (tournament: Tournament) => void;
  createTournament: (data: CreateTournamentData) => Promise<Tournament | null>;
  updateTournament: (id: string, data: Partial<Tournament>) => Promise<boolean>;
  deleteTournament: (id: string) => Promise<boolean>;
  joinTournament: (slug: string) => Promise<boolean>;
  leaveTournament: (tournamentId: string) => Promise<boolean>;
  inviteUser: (tournamentId: string, email: string, role?: 'admin' | 'member') => Promise<boolean>;
  removeMember: (tournamentId: string, userId: string) => Promise<boolean>;
  updateMemberRole: (tournamentId: string, userId: string, role: 'admin' | 'member') => Promise<boolean>;
  refreshTournaments: () => Promise<void>;
  hasPermission: (permission: 'view' | 'edit' | 'admin' | 'owner') => boolean;
}

interface CreateTournamentData {
  name: string;
  slug: string;
  description?: string;
  is_public?: boolean;
  demolition_man_active?: boolean;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);
  const [userTournaments, setUserTournaments] = useState<Tournament[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load user's tournaments (or default tournament for anonymous users)
  const loadUserTournaments = async () => {
    console.log('Loading tournaments for user:', user?.id || 'anonymous');

    // For anonymous users, load the default tournament
    if (!user) {
      console.log('Anonymous user detected, loading default tournament');
      try {
        const { data: defaultTournament, error } = await supabase
          .from('tournaments')
          .select('*')
          .or('name.eq.Default Arcade Tournament,slug.eq.default-arcade')
          .eq('is_public', true)
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error loading default tournament:', error);
        }

        if (defaultTournament) {
          console.log('Found default tournament:', defaultTournament.name, 'ID:', defaultTournament.id);
          setUserTournaments([defaultTournament]);
          setCurrentTournament(defaultTournament);
          setCurrentUserRole(null); // Anonymous users have no role
        } else {
          console.log('No default tournament found, checking all tournaments...');
          // Debug: Check what tournaments exist
          const { data: allTournaments } = await supabase
            .from('tournaments')
            .select('id, name, slug, is_public');
          console.log('All tournaments:', allTournaments);
          setUserTournaments([]);
          setCurrentTournament(null);
          setCurrentUserRole(null);
        }

        setLoading(false);
        return;
      } catch (error) {
        console.error('Error loading default tournament for anonymous user:', error);
        setUserTournaments([]);
        setCurrentTournament(null);
        setCurrentUserRole(null);
        setLoading(false);
        return;
      }
    }

    console.log('Loading tournaments for authenticated user:', user.id);

    try {
      // Load tournaments from the new tournament system
      // Try a simpler query first to test basic access
      console.log('Testing basic tournament_members access...');
      const { data: basicTest, error: basicError } = await supabase
        .from('tournament_members')
        .select('id, user_id, tournament_id, role, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      console.log('Basic test result:', { basicTest, basicError });

      // Now try the full query
      const { data: memberships, error } = await supabase
        .from('tournament_members')
        .select(`
          *,
          tournaments (*)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      console.log('Tournament memberships result:', { memberships, error });
      console.log('Error details:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        fullError: error
      });
      console.log('Error keys:', Object.keys(error || {}));
      console.log('Error stringified:', JSON.stringify(error, null, 2));

      if (error) throw error;

      const tournaments = memberships?.map(m => m.tournaments).filter(Boolean) || [];
      console.log('Found tournaments:', tournaments);
      setUserTournaments(tournaments);

      // Get current tournament from localStorage or use the first available
      const storedTournamentId = localStorage.getItem('currentTournamentId');
      console.log('Stored tournament ID:', storedTournamentId);
      let selectedTournament = null;

      if (storedTournamentId) {
        selectedTournament = tournaments.find(t => t.id === storedTournamentId);
        console.log('Found stored tournament:', selectedTournament);
      }

      if (!selectedTournament && tournaments.length > 0) {
        selectedTournament = tournaments[0];
        console.log('Using first tournament:', selectedTournament);
      }

      if (selectedTournament) {
        const membership = memberships?.find(m => m.tournament_id === selectedTournament.id);
        console.log('Setting current tournament:', selectedTournament.name, 'with role:', membership?.role);
        setCurrentTournament(selectedTournament);
        setCurrentUserRole(membership?.role || null);
        localStorage.setItem('currentTournamentId', selectedTournament.id);
      } else {
        console.log('No tournaments found or selected');
      }
    } catch (error: any) {
      console.error('Error loading tournaments:', error);
      
      let errorMessage = "Failed to load tournaments";
      let errorDetails = "";
      
      if (error.code === '42P01') {
        errorMessage = "Tournament tables not found";
        errorDetails = "The multiuser migration may not have been applied correctly.";
      } else if (error.code === '42501') {
        errorMessage = "Permission denied";
        errorDetails = "You may not have access to tournament data. Check your user permissions.";
      } else if (error.message) {
        errorDetails = error.message;
      }
      
      toast({
        title: errorMessage,
        description: errorDetails || "Please check the console for more details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Switch to a different tournament
  const switchTournament = async (tournament: Tournament) => {
    console.log('switchTournament called with:', tournament);
    console.log('Current user:', user?.id);
    
    try {
      // For anonymous users accessing public tournaments, don't check membership
      if (!user && tournament.is_public) {
        console.log('Anonymous user accessing public tournament:', tournament.name);
        setCurrentTournament(tournament);
        setCurrentUserRole(null);
        localStorage.setItem('currentTournamentId', tournament.id);
        return;
      }

      // For authenticated users or private tournaments, check membership
      if (!user) {
        console.error('User must be authenticated to access private tournaments');
        toast({
          title: "Authentication Required",
          description: "Please sign in to access this tournament",
          variant: "destructive",
        });
        return;
      }

      // Get user's role in this tournament
      const { data: membership, error } = await supabase
        .from('tournament_members')
        .select('role')
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      console.log('Membership query result:', { membership, error });

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting tournament membership:', error);
        toast({
          title: "Error",
          description: `Failed to get tournament membership: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      // For public tournaments, allow access even without membership
      if (tournament.is_public) {
        console.log('Setting public tournament:', tournament.name, 'with role:', membership?.role || 'public_viewer');
        setCurrentTournament(tournament);
        setCurrentUserRole(membership?.role || null);
        localStorage.setItem('currentTournamentId', tournament.id);
        return;
      }

      // For private tournaments, require membership
      if (!membership) {
        console.error('User is not a member of private tournament');
        toast({
          title: "Access Denied",
          description: "You are not a member of this private tournament",
          variant: "destructive",
        });
        return;
      }

      console.log('Setting private tournament:', tournament.name, 'with role:', membership.role);
      setCurrentTournament(tournament);
      setCurrentUserRole(membership.role);
      localStorage.setItem('currentTournamentId', tournament.id);
      
      toast({
        title: "Tournament Switched",
        description: `Switched to ${tournament.name}`,
      });
      
      // Trigger a page refresh to update all data
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error: any) {
      console.error('Error switching tournament:', error);
      toast({
        title: "Error",
        description: "Failed to switch tournament",
        variant: "destructive",
      });
    }
  };

  // Create a new tournament
  const createTournament = async (data: CreateTournamentData): Promise<Tournament | null> => {
    if (!user) return null;

    try {
      const { data: tournament, error } = await supabase
        .from('tournaments')
        .insert({
          ...data,
          created_by: user.id,
          is_public: data.is_public ?? false,
        })
        .select()
        .single();

      if (error) throw error;

      // Add the creator as the owner
      await supabase
        .from('tournament_members')
        .insert({
          tournament_id: tournament.id,
          user_id: user.id,
          role: 'owner',
          is_active: true,
        });

      await refreshTournaments();
      
      toast({
        title: "Success",
        description: "Tournament created successfully",
      });

      return tournament;
    } catch (error: any) {
      console.error('Error creating tournament:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create tournament",
        variant: "destructive",
      });
      return null;
    }
  };

  // Update tournament
  const updateTournament = async (id: string, data: Partial<Tournament>): Promise<boolean> => {
    try {
      console.log('TournamentContext: updateTournament called with:', { id, data });
      
      const { error } = await supabase
        .from('tournaments')
        .update(data)
        .eq('id', id);

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      await refreshTournaments();
      
      toast({
        title: "Success",
        description: "Tournament updated successfully",
      });

      return true;
    } catch (error: any) {
      console.error('Error updating tournament:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update tournament",
        variant: "destructive",
      });
      return false;
    }
  };

  // Delete tournament
  const deleteTournament = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // If we deleted the current tournament, switch to another one
      if (currentTournament?.id === id) {
        const remaining = userTournaments.filter(t => t.id !== id);
        if (remaining.length > 0) {
          switchTournament(remaining[0]);
        } else {
          setCurrentTournament(null);
          setCurrentUserRole(null);
          localStorage.removeItem('currentTournamentId');
        }
      }

      await refreshTournaments();
      
      toast({
        title: "Success",
        description: "Tournament deleted successfully",
      });

      return true;
    } catch (error: any) {
      console.error('Error deleting tournament:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete tournament",
        variant: "destructive",
      });
      return false;
    }
  };

  // Join a tournament by slug
  const joinTournament = async (slug: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // First, find the tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('id, name, slug, description, is_public, created_by, created_at, updated_at')
        .eq('slug', slug)
        .single();

      if (tournamentError) throw tournamentError;

      if (tournamentError) throw tournamentError;

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('tournament_members')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        toast({
          title: "Already a member",
          description: "You are already a member of this tournament",
        });
        return false;
      }

      // Add user as a member
      const { error } = await supabase
        .from('tournament_members')
        .insert({
          tournament_id: tournament.id,
          user_id: user.id,
          role: 'member' as const, // Use valid enum value
          is_active: true,
        });

      if (error) throw error;

      await refreshTournaments();
      
      toast({
        title: "Success",
        description: `Joined ${tournament.name} successfully`,
      });

      return true;
    } catch (error: any) {
      console.error('Error joining tournament:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to join tournament",
        variant: "destructive",
      });
      return false;
    }
  };

  // Leave tournament
  const leaveTournament = async (tournamentId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('tournament_members')
        .update({ is_active: false })
        .eq('tournament_id', tournamentId)
        .eq('user_id', user.id);

      if (error) throw error;

      await refreshTournaments();
      
      toast({
        title: "Success",
        description: "Left tournament successfully",
      });

      return true;
    } catch (error: any) {
      console.error('Error leaving tournament:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to leave tournament",
        variant: "destructive",
      });
      return false;
    }
  };

  // Invite user to tournament
  const inviteUser = async (tournamentId: string, email: string, role: 'member' | 'admin' = 'member'): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tournament_invitations')
        .insert({
          tournament_id: tournamentId,
          email: email.toLowerCase(),
          role,
          invited_by: user?.id,
          token: crypto.randomUUID(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invitation sent successfully",
      });

      return true;
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
      return false;
    }
  };

  // Remove member from tournament
  const removeMember = async (tournamentId: string, userId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tournament_members')
        .update({ is_active: false })
        .eq('tournament_id', tournamentId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member removed successfully",
      });

      return true;
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      });
      return false;
    }
  };

  // Update member role
  const updateMemberRole = async (tournamentId: string, userId: string, role: 'member' | 'admin'): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tournament_members')
        .update({ role })
        .eq('tournament_id', tournamentId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member role updated successfully",
      });

      return true;
    } catch (error: any) {
      console.error('Error updating member role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update member role",
        variant: "destructive",
      });
      return false;
    }
  };

  // Refresh tournaments
  const refreshTournaments = async () => {
    await loadUserTournaments();
  };

  // Check user permissions
  const hasPermission = (permission: 'view' | 'edit' | 'admin' | 'owner'): boolean => {
    if (!currentUserRole) return false;

    const roleHierarchy = {
      'player': 1,
      'moderator': 2,
      'admin': 3,
      'owner': 4
    };

    const permissionLevels = {
      'view': 1,
      'edit': 2,
      'admin': 3,
      'owner': 4
    };

    const userLevel = roleHierarchy[currentUserRole as keyof typeof roleHierarchy] || 0;
    const requiredLevel = permissionLevels[permission];

    return userLevel >= requiredLevel;
  };

  useEffect(() => {
    loadUserTournaments();
  }, [user]);

  const value: TournamentContextType = {
    currentTournament,
    userTournaments,
    currentUserRole,
    loading,
    switchTournament,
    createTournament,
    updateTournament,
    deleteTournament,
    joinTournament,
    leaveTournament,
    inviteUser,
    removeMember,
    updateMemberRole,
    refreshTournaments,
    hasPermission,
  };

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (context === undefined) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
}
