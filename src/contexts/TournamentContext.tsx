import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { dlog } from '@/lib/debug';

export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  created_by: string; // This is what the database actually has
  is_public: boolean;
  created_at: string;
  updated_at: string;
  // Optional properties that may not exist in database
  owner_id?: string; // Alias for created_by for compatibility
  is_active?: boolean;
  logo_url?: string | null;
  theme_color?: string;
  demolition_man_active?: boolean; // Toggle for Demolition Man leaderboard
  is_locked?: boolean; // New: lock/unlock tournaments (default false)
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
  cloneTournament: (sourceTournamentId: string, data: CreateTournamentData) => Promise<Tournament | null>;
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
  const queryClient = useQueryClient();

  // Load user's tournaments (or default tournament for anonymous users)
  const loadUserTournaments = async () => {
    dlog('Loading tournaments for user:', user?.id || 'anonymous');

    // For anonymous users, load the default tournament
    if (!user) {
      dlog('Anonymous user detected, loading default tournament');
      try {
        let defaultTournament: any | null = null;
        let error: any = null;
        const { data: bySlug, error: errSlug } = await supabase
          .from('tournaments')
          .select('*')
          .eq('slug', 'default-arcade')
          .eq('is_public', true)
          .limit(1)
          .maybeSingle();
        if (bySlug) {
          defaultTournament = bySlug;
        } else {
          const { data: byName, error: errName } = await supabase
            .from('tournaments')
            .select('*')
            .eq('name', 'Default Arcade Tournament')
            .eq('is_public', true)
            .limit(1)
            .maybeSingle();
          defaultTournament = byName;
          error = errSlug || errName || null;
        }

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error loading default tournament:', error);
        }

        if (defaultTournament) {
          dlog('Found default tournament:', defaultTournament.name, 'ID:', defaultTournament.id);
          setUserTournaments([defaultTournament]);
          setCurrentTournament(defaultTournament);
          setCurrentUserRole(null); // Anonymous users have no role
        } else {
          dlog('No default tournament found, checking all tournaments...');
          // Debug: Check what tournaments exist
          const { data: allTournaments } = await supabase
            .from('tournaments')
            .select('id, name, slug, is_public')
            .eq('is_public', true);
          dlog('All tournaments:', allTournaments);
          // Show all public tournaments in the selector for anonymous users
          setUserTournaments(allTournaments || []);
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

    dlog('Loading tournaments for authenticated user:', user.id);

    try {
      // Load tournaments from the new tournament system
      // Try a simpler query first to test basic access
      dlog('Testing basic tournament_members access...');
      const { data: basicTest, error: basicError } = await supabase
        .from('tournament_members')
        .select('id, user_id, tournament_id, role, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      dlog('Basic test result:', { basicTest, basicError });

      // Now try the full query
      const { data: memberships, error } = await supabase
        .from('tournament_members')
        .select('tournament_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true);

      dlog('Tournament memberships (ids only) result:', { memberships, error });
      dlog('Error details:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        fullError: error
      });
      dlog('Error keys:', Object.keys(error || {}));
      dlog('Error stringified:', JSON.stringify(error, null, 2));

      if (error) throw error;

      const tournamentIds = (memberships || []).map((m: any) => m.tournament_id);
      let tournaments: any[] = [];
      if (tournamentIds.length > 0) {
        const { data: tList, error: tErr } = await supabase
          .from('tournaments')
          .select('*')
          .in('id', tournamentIds);
        if (tErr) throw tErr;
        tournaments = tList || [];
      }
      dlog('Found tournaments by ids:', tournaments);
      setUserTournaments(tournaments);

      // Selection priority:
      // 1) Previously stored selection
      // 2) Tournament flagged is_active (if schema provides it)
      // 3) Most recently updated tournament
      // 4) First available
      let selectedTournament: any = null;

      const storedTournamentId = localStorage.getItem('currentTournamentId');
      dlog('Stored tournament ID:', storedTournamentId);
      if (storedTournamentId) {
        selectedTournament = tournaments.find(t => t.id === storedTournamentId) || null;
        dlog('Found stored tournament:', selectedTournament);
      }

      if (!selectedTournament) {
        const activeTournament = tournaments.find((t: any) => t && (t as any).is_active === true);
        if (activeTournament) {
          selectedTournament = activeTournament;
          dlog('Using active tournament flag:', selectedTournament);
        }
      }

      if (!selectedTournament && tournaments.length > 0) {
        const byUpdatedAt = [...tournaments].sort((a: any, b: any) => {
          const aTime = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
          const bTime = b?.updated_at ? new Date(b.updated_at).getTime() : 0;
          return bTime - aTime;
        });
        selectedTournament = byUpdatedAt[0] || tournaments[0];
        dlog('Using most recently updated/first tournament:', selectedTournament);
      }

      if (selectedTournament) {
        const membership = memberships?.find((m: any) => m.tournament_id === selectedTournament.id);
        dlog('Setting current tournament:', selectedTournament.name, 'with role:', membership?.role);
        setCurrentTournament(selectedTournament);
        setCurrentUserRole(membership?.role || null);
        localStorage.setItem('currentTournamentId', selectedTournament.id);
      } else {
        dlog('No tournaments found for user, loading default public tournament...');
        // If authenticated user has no tournaments, load the default public tournament
        try {
          let defaultTournament: any | null = null;
          let error: any = null;
          const { data: bySlug, error: errSlug } = await supabase
            .from('tournaments')
            .select('*')
            .eq('slug', 'default-arcade')
            .eq('is_public', true)
            .limit(1)
            .maybeSingle();
          if (bySlug) {
            defaultTournament = bySlug;
          } else {
            const { data: byName, error: errName } = await supabase
              .from('tournaments')
              .select('*')
              .eq('name', 'Default Arcade Tournament')
              .eq('is_public', true)
              .limit(1)
              .maybeSingle();
            defaultTournament = byName;
            error = errSlug || errName || null;
          }

          if (defaultTournament && !error) {
            dlog('Found default tournament for new user:', defaultTournament.name);
            setUserTournaments([defaultTournament]);
            setCurrentTournament(defaultTournament);
            setCurrentUserRole(null); // No membership role in default tournament
            localStorage.setItem('currentTournamentId', defaultTournament.id);
          } else {
            dlog('No default tournament found for new user');
          }
        } catch (error) {
          console.error('Error loading default tournament for new user:', error);
        }
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
    dlog('switchTournament called with:', tournament);
    dlog('Current user:', user?.id);
    
    try {
      // For anonymous users accessing public tournaments, don't check membership
      if (!user && tournament.is_public) {
        dlog('Anonymous user accessing public tournament:', tournament.name);
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

      dlog('Membership query result:', { membership, error });

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
        dlog('Setting public tournament:', tournament.name, 'with role:', membership?.role || 'public_viewer');
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

      dlog('Setting private tournament:', tournament.name, 'with role:', membership.role);
      setCurrentTournament(tournament);
      setCurrentUserRole(membership.role);
      localStorage.setItem('currentTournamentId', tournament.id);
      
      toast({
        title: "Tournament Switched",
        description: `Switched to ${tournament.name}`,
      });
      
      // Invalidate React Query cache to update all data
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['scores'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
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
      // Extract demolition_man_active from data since it's not in the database schema
      const { demolition_man_active, ...tournamentData } = data;
      
      // Try initial insert
      let { data: tournament, error } = await supabase
        .from('tournaments')
        .insert({
          ...tournamentData,
          created_by: user.id,
          is_public: data.is_public ?? false,
        })
        .select()
        .single();

      // If slug is duplicate, retry once with a short random suffix
      if (error && error.code === '23505' && (error.message || '').includes('tournaments_slug_key')) {
        const suffix = Math.random().toString(36).slice(2, 6);
        const retrySlug = `${tournamentData.slug}-${suffix}`.toLowerCase();
        const retryPayload = {
          ...tournamentData,
          slug: retrySlug,
          created_by: user.id,
          is_public: data.is_public ?? false,
        };
        console.warn('Slug duplicate detected. Retrying with slug:', retrySlug);
        const retry = await supabase
          .from('tournaments')
          .insert(retryPayload)
          .select()
          .single();
        tournament = retry.data as any;
        error = retry.error as any;
      }

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
      
      let errorMessage = "Failed to create tournament";
      if (error.code === '23505' && (error.message || '').includes('tournaments_slug_key')) {
        errorMessage = "A tournament with this slug already exists. Please choose a different slug.";
      } else if (error.code === '42501') {
        errorMessage = "Permission denied when creating tournament. Your account may lack insert rights or RLS blocked the action.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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

  // Clone tournament (minimal safe clone: create new tournament and set current user as owner)
  const cloneTournament = async (
    sourceTournamentId: string,
    data: CreateTournamentData
  ): Promise<Tournament | null> => {
    if (!user) return null;

    try {
      console.log('Calling clone-tournament function with:', {
        sourceTournamentId,
        name: data.name,
        slug: data.slug,
        is_public: data.is_public ?? false,
        created_by: user.id,
      });

      const { data: result, error } = await supabase.functions.invoke('clone-tournament', {
        body: {
          sourceTournamentId,
          name: data.name,
          slug: data.slug,
          is_public: data.is_public ?? false,
          created_by: user.id,
        },
      });
      
      console.log('Clone function response:', { result, error });
      
      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to clone tournament');
      }

      if (!result || !result.tournament) {
        console.error('Invalid response from clone function:', result);
        throw new Error('Invalid response from clone function');
      }

      await refreshTournaments();
      toast({ title: 'Success', description: 'Tournament cloned successfully' });
      return result.tournament as Tournament;
    } catch (error: any) {
      console.error('Error cloning tournament:', error);
      const errorMessage = error.message || error.toString() || 'Failed to clone tournament';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      return null;
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
    cloneTournament,
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
