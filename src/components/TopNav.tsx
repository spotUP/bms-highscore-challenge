import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import ThemeSelector from '@/components/ThemeSelector';
import PerformanceModeToggle from '@/components/PerformanceModeToggle';
import TournamentDropdown from '@/components/TournamentDropdown';
import PublicTournamentBrowser from '@/components/PublicTournamentBrowser';
import MobileMenu from '@/components/MobileMenu';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface TopNavProps {
  onSpinWheel?: () => void;
  rightActions?: React.ReactNode;
  centerNav?: boolean;
  hideBracketsLink?: boolean;
  hideTournamentSelector?: boolean;
  hideSpinButton?: boolean;
  hideStatistics?: boolean;
}

const TopNav: React.FC<TopNavProps> = ({ onSpinWheel, rightActions, centerNav = false, hideBracketsLink = false, hideTournamentSelector = false, hideSpinButton = false, hideStatistics = false }) => {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
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
    navigate('/');
  };

  return (
    <div className="w-full relative z-20" style={{ contain: 'layout paint' }}>
      {centerNav ? (
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-3xl md:text-4xl font-bold animated-gradient leading-tight text-center">Retro Ranks</h1>
          <div className="flex items-center gap-4">
            <div
              className="hidden md:flex gap-4 items-center whitespace-nowrap flex-shrink-0 flex-none flex-nowrap min-w-max"
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
                  <Button variant="outline" size="sm" className="theme-button" onClick={toggleFullscreen}>
                    {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  </Button>
                  {!hideTournamentSelector && <TournamentDropdown />}
                  {!hideSpinButton && <Button variant="outline" onClick={handleSpin}>Spin the Wheel</Button>}
                  {!hideStatistics && <Button variant="outline" onClick={() => navigate('/statistics')}>Statistics</Button>}
                  <Button
                    variant="outline"
                    onClick={() => isAdmin && navigate('/admin')}
                    style={{ visibility: isAdmin ? 'visible' : 'hidden' }}
                    tabIndex={isAdmin ? 0 : -1}
                    aria-hidden={!isAdmin}
                    disabled={!isAdmin}
                  >
                    Admin Panel
                  </Button>
                  {!hideBracketsLink && (
                    <Button variant="outline" onClick={() => navigate('/admin/brackets')}>Brackets</Button>
                  )}
                  {rightActions}
                  <Button variant="outline" onClick={signOut}>Sign Out</Button>
                </>
              ) : (
                <>
                  <PublicTournamentBrowser />
                  <Button onClick={() => navigate('/auth')} variant="outline">Sign In</Button>
                </>
              )}
            </div>
            <MobileMenu onSpinWheel={handleSpin} />
          </div>
        </div>
      ) : (
        <div className="flex items-center">
          <h1 className="text-3xl md:text-4xl font-bold animated-gradient leading-tight">Retro Ranks</h1>
          <div className="ml-auto flex items-center">
            <div
              className="hidden md:flex gap-4 items-center whitespace-nowrap flex-shrink-0 flex-none flex-nowrap min-w-max"
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
                  <Button variant="outline" size="sm" className="theme-button" onClick={toggleFullscreen}>
                    {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  </Button>
                  <TournamentDropdown />
                  <Button variant="outline" onClick={handleSpin}>Spin the Wheel</Button>
                  <Button variant="outline" onClick={() => navigate('/statistics')}>Statistics</Button>
                  <Button
                    variant="outline"
                    onClick={() => isAdmin && navigate('/admin')}
                    style={{ visibility: isAdmin ? 'visible' : 'hidden' }}
                    tabIndex={isAdmin ? 0 : -1}
                    aria-hidden={!isAdmin}
                    disabled={!isAdmin}
                  >
                    Admin Panel
                  </Button>
                  {!hideBracketsLink && (
                    <Button variant="outline" onClick={() => navigate('/admin/brackets')}>Brackets</Button>
                  )}
                  {rightActions}
                  <Button variant="outline" onClick={signOut}>Sign Out</Button>
                </>
              ) : (
                <>
                  <PublicTournamentBrowser />
                  <Button onClick={() => navigate('/auth')} variant="outline">Sign In</Button>
                </>
              )}
            </div>
            <MobileMenu onSpinWheel={handleSpin} />
          </div>
        </div>
      )}
    </div>
  );
};

export default TopNav;
