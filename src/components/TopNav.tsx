import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import TournamentDropdown from '@/components/TournamentDropdown';
import SmartMenu from '@/components/SmartMenu';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePageTransitions } from '@/hooks/usePageTransitions';
import { useTournament } from '@/contexts/TournamentContext';
import { Clock, Edit } from 'lucide-react';

interface TopNavProps {
  onSpinWheel?: () => void;
  animatedNavigate?: (to: string, options?: any) => void;
  rightActions?: React.ReactNode;
  centerNav?: boolean;
  hideBracketsLink?: boolean;
  hideTournamentSelector?: boolean;
  hideTournamentTiming?: boolean;
  hideSpinButton?: boolean;
  hideStatistics?: boolean;
  onShowRules?: () => void;
  hideRulesButton?: boolean;
  leftActions?: React.ReactNode;
}

const TopNav: React.FC<TopNavProps> = ({ onSpinWheel, animatedNavigate: propAnimatedNavigate, rightActions, centerNav = false, hideBracketsLink = false, hideTournamentSelector = false, hideSpinButton = false, hideStatistics = false, onShowRules, hideRulesButton = false, leftActions }) => {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { animatedNavigate } = usePageTransitions({ exitDuration: 600 });
  const { currentTournament, hasPermission } = useTournament();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Use the animated navigate function passed from Layout, or fallback to our own
  const finalAnimatedNavigate = propAnimatedNavigate || animatedNavigate;

  // Helper function to check if we're on the current page
  const isCurrentPage = (path: string) => location.pathname === path;

  // Handle logo click to go to retroranks.com
  const handleLogoClick = () => {
    window.open('https://www.retroranks.com', '_blank');
  };
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

  const handleSpin = () => {
    if (onSpinWheel) return onSpinWheel();
    finalAnimatedNavigate('/');
  };

  return (
    <div className="w-full relative z-20">
      {centerNav ? (
        <div className="flex flex-col items-center gap-3">
          <h1
            className="text-3xl md:text-4xl font-bold animated-gradient leading-tight text-center pl-4 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleLogoClick}
          >
            Retro Ranks
          </h1>
          <div className="flex items-center gap-4">
            <div
              className="flex gap-4 items-center whitespace-nowrap flex-shrink-0 flex-none flex-nowrap min-w-max"
              style={{ width: 'max-content' }}
            >
              {leftActions && leftActions}
              <div
                className="font-arcade font-bold text-lg animated-gradient whitespace-nowrap text-center hidden md:block"
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
              {!hideTournamentSelector && <TournamentDropdown />}

              {/* Tournament timing and edit button */}
              {!hideTournamentSelector && currentTournament && (
                <div className="flex items-center gap-2 ml-2">
                  {currentTournament.end_time && (
                    <div className="flex items-center gap-1 text-gray-300 text-sm">
                      <Clock className="w-4 h-4" />
                      <span>Ends {new Date(currentTournament.end_time).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}</span>
                    </div>
                  )}

                  {hasPermission('owner') && (
                    <button
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border text-blue-300 bg-blue-500/20 border-blue-500/30 cursor-pointer hover:scale-105 transition-transform duration-200"
                      title="Edit Tournament Settings"
                      onClick={() => {
                        // Create a custom event to open tournament edit modal
                        const editEvent = new CustomEvent('openTournamentEdit');
                        document.dispatchEvent(editEvent);
                      }}
                    >
                      <Edit className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              )}

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
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-0">
          <h1
            className="text-3xl md:text-4xl font-bold animated-gradient leading-tight pl-4 cursor-pointer hover:opacity-80 transition-opacity text-center md:text-left"
            onClick={handleLogoClick}
          >
            Retro Ranks
          </h1>
          <div className="md:ml-auto flex items-center justify-center">
            <div
              className="flex gap-2 md:gap-4 items-center whitespace-nowrap flex-shrink-0 flex-none flex-nowrap min-w-max"
              style={{ width: 'max-content' }}
            >
              {leftActions && leftActions}
              <div
                className="font-arcade font-bold text-base md:text-lg animated-gradient whitespace-nowrap text-center hidden md:block"
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
              {!hideTournamentSelector && <TournamentDropdown />}
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
