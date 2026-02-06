import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageTransitions } from '@/hooks/usePageTransitions';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/contexts/TournamentContext';
import { api } from '@/lib/api-client';
import TopNav from '@/components/TopNav';
import SpinTheWheel from '@/components/SpinTheWheel';

interface LayoutProps {
  children: React.ReactNode;
  hideTopNav?: boolean;
  topNavProps?: {
    hideBracketsLink?: boolean;
    hideTournamentSelector?: boolean;
    hideSpinButton?: boolean;
    hideStatistics?: boolean;
    hideFullscreenButton?: boolean;
    centerNav?: boolean;
    rightActions?: React.ReactNode;
    leftActions?: React.ReactNode;
    onShowRules?: () => void;
    hideRulesButton?: boolean;
  };
}

const Layout: React.FC<LayoutProps> = ({
  children,
  hideTopNav = false,
  topNavProps = {}
}) => {
  const location = useLocation();
  const { isExiting, animatedNavigate } = usePageTransitions({ exitDuration: 550 });
  const [isSpinWheelOpen, setIsSpinWheelOpen] = useState(false);
  const { user } = useAuth();
  const { userTournaments } = useTournament();
  const [leaderboardNames, setLeaderboardNames] = useState<string[]>([]);

  // Pages that should not show TopNav
  const noNavPages = ['/auth', '/auth/verify', '/auth/expired'];
  const shouldShowTopNav = !hideTopNav && !noNavPages.includes(location.pathname);

  // Shuffle function for randomizing names
  const shuffleArray = (array: string[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Load player names from tournaments created by the current user
  useEffect(() => {
    const loadLeaderboardNames = async () => {
      if (!user) {
        setLeaderboardNames([]);
        return;
      }

      // Get tournament IDs created by the current user
      const userTournamentIds = userTournaments
        .filter(tournament => tournament.created_by === user.id)
        .map(tournament => tournament.id);

      if (userTournamentIds.length === 0) {
        setLeaderboardNames([]);
        return;
      }

      try {
        // Get all scores from user's tournaments
        const { data: scores, error } = await api
          .from('scores')
          .select('player_name, game_id')
          .in('tournament_id', userTournamentIds);

        if (error) throw error;

        // Count how many different games each player has scores for
        const playerGameCounts = new Map<string, number>();
        scores?.forEach(score => {
          const currentCount = playerGameCounts.get(score.player_name) || 0;
          playerGameCounts.set(score.player_name, currentCount + 1);
        });

        // Create array where each player appears once per game they have scores for
        const wheelNames: string[] = [];
        playerGameCounts.forEach((gameCount, playerName) => {
          for (let i = 0; i < gameCount; i++) {
            wheelNames.push(playerName);
          }
        });

        setLeaderboardNames(wheelNames);
      } catch (error) {
        console.error('Error loading leaderboard names:', error);
        setLeaderboardNames([]);
      }
    };

    loadLeaderboardNames();
  }, [user, userTournaments]);

  const getRandomizedLeaderboardNames = useMemo(() => {
    return shuffleArray(leaderboardNames);
  }, [leaderboardNames]);

  return (
    <div className="min-h-screen text-white relative z-10 pt-2"
         style={{
           background: 'var(--page-bg)'
         }}>
      {shouldShowTopNav && (
        <TopNav
          onSpinWheel={() => setIsSpinWheelOpen(true)}
          animatedNavigate={animatedNavigate}
          {...topNavProps}
        />
      )}

      <div className={`${shouldShowTopNav ? 'pt-2' : ''}`}>
        {React.isValidElement(children) ?
          React.cloneElement(children, { isExiting }) :
          children
        }
      </div>

      <SpinTheWheel
        isOpen={isSpinWheelOpen}
        onClose={() => setIsSpinWheelOpen(false)}
        leaderboardNames={getRandomizedLeaderboardNames}
      />
    </div>
  );
};

export default Layout;