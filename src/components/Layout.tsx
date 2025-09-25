import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageTransitions } from '@/hooks/usePageTransitions';
import { useTournamentGameData } from '@/hooks/useTournamentGameData';
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
  const { gameScores } = useTournamentGameData();


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

  // Get player names for the wheel - each player appears once per game they have scores for
  const getLeaderboardNames = useMemo(() => {
    const playerGameCounts = new Map<string, number>();

    // Count how many different games each player has scores for
    Object.values(gameScores).forEach(gameScoreList => {
      const playersInGame = new Set();
      gameScoreList.forEach(score => {
        playersInGame.add(score.player_name);
      });

      playersInGame.forEach(playerName => {
        const currentCount = playerGameCounts.get(playerName as string) || 0;
        playerGameCounts.set(playerName as string, currentCount + 1);
      });
    });

    // Create array where each player appears once per game they have scores for
    const wheelNames: string[] = [];
    playerGameCounts.forEach((gameCount, playerName) => {
      for (let i = 0; i < gameCount; i++) {
        wheelNames.push(playerName);
      }
    });

    return wheelNames;
  }, [gameScores]);

  const getRandomizedLeaderboardNames = useMemo(() => {
    return shuffleArray(getLeaderboardNames);
  }, [getLeaderboardNames]);

  return (
    <div className="min-h-screen text-white relative z-10 pt-4"
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

      <div className={`${shouldShowTopNav ? 'pt-4' : ''}`}>
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