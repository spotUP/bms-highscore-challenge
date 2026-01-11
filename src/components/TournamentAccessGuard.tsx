import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTournament, Tournament } from '@/contexts/TournamentContext';

interface TournamentAccessGuardProps {
  children: React.ReactNode;
}

const TournamentAccessGuard: React.FC<TournamentAccessGuardProps> = ({ children }) => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { switchTournament, userTournaments, currentTournament } = useTournament();
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    const checkTournamentAccess = async () => {
      if (!slug) {
        setIsChecking(false);
        setHasAccess(false);
        return;
      }

      try {
        // First, get the tournament by slug
        const { data: tournamentData, error: tournamentError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('slug', slug)
          .single();

        if (tournamentError || !tournamentData) {
          setIsChecking(false);
          setHasAccess(false);
          return;
        }

        // Ensure the tournament data matches the Tournament interface
        const tournament: Tournament = {
          id: tournamentData.id,
          name: tournamentData.name,
          description: tournamentData.description,
          slug: tournamentData.slug,
          created_by: tournamentData.created_by,
          is_public: tournamentData.is_public,
          created_at: tournamentData.created_at,
          updated_at: tournamentData.updated_at,
        };

        setTournament(tournament);

        // If tournament is public, allow access
        if (tournament.is_public) {
          setHasAccess(true);
          setIsChecking(false);
          
          // Switch to this tournament if not already set
          if (currentTournament?.id !== tournament.id) {
            try {
              await switchTournament(tournament);
            } catch (error) {
              console.error('Error switching to public tournament:', error);
            }
          }
          return;
        }

        // If tournament is private, check access
        if (!user) {
          setIsChecking(false);
          setHasAccess(false);
          return;
        }

        // Check if user is the owner
        if (tournament.created_by === user.id) {
          setHasAccess(true);
          setIsChecking(false);
          
          // Switch to this tournament if not already set
          if (currentTournament?.id !== tournament.id) {
            try {
              await switchTournament(tournament);
            } catch (error) {
              console.error('Error switching to owned tournament:', error);
            }
          }
          return;
        }

        // Check if user is a member
        const { data: membershipData, error: membershipError } = await supabase
          .from('tournament_members')
          .select('id, role, is_active')
          .eq('tournament_id', tournament.id)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (membershipError && membershipError.code !== 'PGRST116') {
          console.error('Error checking membership:', membershipError);
          setIsChecking(false);
          setHasAccess(false);
          return;
        }

        if (membershipData) {
          setHasAccess(true);
          
          // Switch to this tournament if not already set
          if (currentTournament?.id !== tournament.id) {
            try {
              await switchTournament(tournament);
            } catch (error) {
              console.error('Error switching to member tournament:', error);
            }
          }
        } else {
          setHasAccess(false);
        }

      } catch (error) {
        console.error('Error checking tournament access:', error);
        setHasAccess(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkTournamentAccess();
  }, [slug, user?.id, currentTournament?.id]); // Only depend on stable values

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10"
           style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
        <div className="text-center text-white">
          <div className="text-2xl mb-4">🔒</div>
          <div className="text-xl">Checking tournament access...</div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10"
           style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
        <div className="text-center text-white max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
          {tournament ? (
            <div className="space-y-3">
              <p className="text-xl text-gray-300">
                The tournament "<strong>{tournament.name}</strong>" is private.
              </p>
              {user ? (
                <p className="text-gray-400">
                  You need to be invited to access this tournament.
                </p>
              ) : (
                <p className="text-gray-400">
                  You need to sign in to access private tournaments.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xl text-gray-300">
                Tournament not found.
              </p>
              <p className="text-gray-400">
                The tournament "{slug}" does not exist or has been deleted.
              </p>
            </div>
          )}
          <div className="mt-6">
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default TournamentAccessGuard;
