import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import ThemeSelector from '@/components/ThemeSelector';
import PerformanceModeToggle from '@/components/PerformanceModeToggle';
import TournamentDropdown from '@/components/TournamentDropdown';
import SmartMenu from '@/components/SmartMenu';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePageTransitions } from '@/hooks/usePageTransitions';

interface TopNavProps {
  onSpinWheel?: () => void;
  animatedNavigate?: (to: string, options?: any) => void;
  rightActions?: React.ReactNode;
  centerNav?: boolean;
  hideBracketsLink?: boolean;
  hideTournamentSelector?: boolean;
  hideSpinButton?: boolean;
  hideStatistics?: boolean;
  hideFullscreenButton?: boolean;
  onShowRules?: () => void;
  hideRulesButton?: boolean;
}

const TopNav: React.FC<TopNavProps> = ({ onSpinWheel, animatedNavigate: propAnimatedNavigate, rightActions, centerNav = false, hideBracketsLink = false, hideTournamentSelector = false, hideSpinButton = false, hideStatistics = false, hideFullscreenButton = false, onShowRules, hideRulesButton = false }) => {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { animatedNavigate } = usePageTransitions({ exitDuration: 600 });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Use the animated navigate function passed from Layout, or fallback to our own
  const finalAnimatedNavigate = propAnimatedNavigate || animatedNavigate;

  // Helper function to check if we're on the current page
  const isCurrentPage = (path: string) => location.pathname === path;
  const [isFullscreen, setIsFullscreen] = useState<boolean>(!!document.fullscreenElement);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(prevTime => {
        const prevDisplay = prevTime.toLocaleTimeString('en-GB', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        const newDisplay = now.toLocaleTimeString('en-GB', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        return prevDisplay !== newDisplay ? now : prevTime;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  };

  const handleSpin = () => {
    if (onSpinWheel) return onSpinWheel();
    finalAnimatedNavigate('/');
  };

  return (
    <div className="w-full relative z-20">
      {centerNav ? (
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-3xl md:text-4xl font-bold animated-gradient leading-tight text-center pl-4">Retro Ranks</h1>
          <div className="flex items-center gap-4">
            <div
              className="flex gap-4 items-center whitespace-nowrap flex-shrink-0 flex-none flex-nowrap min-w-max"
              style={{ width: 'max-content' }}
            >
              <div
                className="font-arcade font-bold text-lg animated-gradient whitespace-nowrap text-center"
                style={{
                  minWidth: 96, // enough for 00:00:00 in this font size
                  fontVariantNumeric: 'tabular-nums',
                  WebkitFontFeatureSettings: '"tnum" 1, "lnum" 1',
                  fontFeatureSettings: '"tnum" 1, "lnum" 1',
                }}
                aria-label="Clock"
              >
                {currentTime.toLocaleTimeString('en-GB', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </div>
              <ThemeSelector />
              {user ? (
                <>
                  <PerformanceModeToggle displayType="switch" />
                  {!hideFullscreenButton && (
                    <Button variant="outline" size="sm" className="theme-button" onClick={toggleFullscreen}>
                      {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    </Button>
                  )}
                  {!hideTournamentSelector && <TournamentDropdown />}
                </>
              ) : null}
              <SmartMenu
                animatedNavigate={finalAnimatedNavigate}
                onShowRules={onShowRules}
                onSpinWheel={onSpinWheel}
                hideBracketsLink={hideBracketsLink}
                hideStatistics={hideStatistics}
                hideSpinButton={hideSpinButton}
                hideRulesButton={hideRulesButton}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center">
          <h1 className="text-3xl md:text-4xl font-bold animated-gradient leading-tight pl-4">Retro Ranks</h1>
          <div className="ml-auto flex items-center">
            <div
              className="flex gap-4 items-center whitespace-nowrap flex-shrink-0 flex-none flex-nowrap min-w-max"
              style={{ width: 'max-content' }}
            >
              <div
                className="font-arcade font-bold text-lg animated-gradient whitespace-nowrap text-center"
                style={{
                  minWidth: 96, // enough for 00:00:00 in this font size
                  fontVariantNumeric: 'tabular-nums',
                  WebkitFontFeatureSettings: '"tnum" 1, "lnum" 1',
                  fontFeatureSettings: '"tnum" 1, "lnum" 1',
                }}
                aria-label="Clock"
              >
                {currentTime.toLocaleTimeString('en-GB', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </div>
              <ThemeSelector />
              {user ? (
                <>
                  <PerformanceModeToggle displayType="switch" />
                  {!hideFullscreenButton && (
                    <Button variant="outline" size="sm" className="theme-button" onClick={toggleFullscreen}>
                      {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    </Button>
                  )}
                  <TournamentDropdown />
                </>
              ) : null}
              <SmartMenu
                animatedNavigate={finalAnimatedNavigate}
                onShowRules={onShowRules}
                onSpinWheel={onSpinWheel}
                hideBracketsLink={hideBracketsLink}
                hideStatistics={hideStatistics}
                hideSpinButton={hideSpinButton}
                hideRulesButton={hideRulesButton}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopNav;
