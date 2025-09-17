import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Menu, X, Home, BarChart3, Trophy, Brackets, Settings, LogOut, Gamepad2, BookOpen, Maximize, Minimize } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";
import { useFullscreenContext } from "@/contexts/FullscreenContext";

interface SmartMenuProps {
  animatedNavigate: (path: string) => void;
  hideBracketsLink?: boolean;
  hideStatistics?: boolean;
  rightActions?: React.ReactNode;
  onSpinWheel?: () => void;
  hideSpinButton?: boolean;
  onShowRules?: () => void;
  hideRulesButton?: boolean;
  variant?: 'mobile' | 'desktop';
}

const SmartMenu: React.FC<SmartMenuProps> = ({
  animatedNavigate,
  hideBracketsLink = false,
  hideStatistics = false,
  rightActions,
  onSpinWheel,
  hideSpinButton = false,
  onShowRules,
  hideRulesButton = false,
  variant = 'desktop'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const { isFullscreen, toggleFullscreen } = useFullscreenContext();
  const menuRef = useRef<HTMLDivElement>(null);

  const isCurrentPage = (path: string) => location.pathname === path;

  const handleMenuToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleNavigation = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const handleAnimatedNavigation = (path: string) => {
    setIsOpen(false);
    setTimeout(() => {
      animatedNavigate(path);
    }, 150);
  };

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const renderAuthenticatedMenu = () => (
    <>
      <div className="text-gray-300 text-sm mb-3 border-b border-white/20 pb-2">
        <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-medium">
          Welcome, {user?.email}
        </span>
      </div>

      {/* Main Navigation */}
      {!isCurrentPage('/') && (
        <Button variant="ghost" onClick={() => handleAnimatedNavigation('/')} className="w-full justify-start text-left mb-2">
          <Home size={16} className="mr-3" />
          Highscores
        </Button>
      )}

      {!hideStatistics && !isCurrentPage('/statistics') && (
        <Button variant="ghost" onClick={() => handleAnimatedNavigation('/statistics')} className="w-full justify-start text-left mb-2">
          <BarChart3 size={16} className="mr-3" />
          Statistics
        </Button>
      )}

      {!isCurrentPage('/achievements') && (
        <Button variant="ghost" onClick={() => handleAnimatedNavigation('/achievements')} className="w-full justify-start text-left mb-2">
          <Trophy size={16} className="mr-3" />
          Achievements
        </Button>
      )}

      {/* Actions */}
      {onSpinWheel && !hideSpinButton && (
        <Button variant="ghost" onClick={() => handleNavigation(onSpinWheel)} className="w-full justify-start text-left mb-2 hover:bg-blue-500/10 text-blue-200">
          <Gamepad2 size={16} className="mr-3 text-blue-300" />
          Spin the Wheel
        </Button>
      )}

      {onShowRules && !hideRulesButton && (
        <Button variant="ghost" onClick={() => handleNavigation(onShowRules)} className="w-full justify-start text-left mb-2 hover:bg-blue-500/10 text-blue-200">
          <BookOpen size={16} className="mr-3 text-blue-300" />
          Competition Rules
        </Button>
      )}

      {/* Fullscreen Toggle */}
      <Button variant="ghost" onClick={() => handleNavigation(toggleFullscreen)} className="w-full justify-start text-left mb-2 hover:bg-purple-500/10 text-purple-200">
        {isFullscreen ? <Minimize size={16} className="mr-3 text-purple-300" /> : <Maximize size={16} className="mr-3 text-purple-300" />}
        {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      </Button>

      {/* Admin Section */}
      {isAdmin && (
        <>
          <div className="border-t border-white/20 my-3 pt-3">
            <div className="text-xs text-gray-400 mb-3 px-2">Administration</div>
          </div>

          {!hideBracketsLink && !isCurrentPage('/admin/brackets') && (
            <Button variant="ghost" onClick={() => handleAnimatedNavigation('/admin/brackets')} className="w-full justify-start text-left mb-2 hover:bg-amber-500/10 text-amber-200">
              <Brackets size={16} className="mr-3 text-amber-300" />
              Brackets
            </Button>
          )}

          {!isCurrentPage('/admin') && (
            <Button variant="ghost" onClick={() => handleAnimatedNavigation('/admin')} className="w-full justify-start text-left mb-2 hover:bg-amber-500/10 text-amber-200">
              <Settings size={16} className="mr-3 text-amber-300" />
              Admin Panel
            </Button>
          )}
        </>
      )}

      {/* Sign Out */}
      <div className="border-t border-white/20 my-3 pt-3">
        <Button variant="ghost" onClick={() => handleNavigation(signOut)} className="w-full justify-start text-left hover:bg-red-500/20 hover:text-red-400">
          <LogOut size={16} className="mr-3 text-red-400" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="relative pr-4" ref={menuRef}>
      <Button
        variant="outline"
        size={variant === 'mobile' ? 'icon' : 'sm'}
        onClick={handleMenuToggle}
        className={`theme-button transition-all duration-300 hover:scale-105 hover:shadow-md ${
          isOpen ? 'bg-white/10 border-white/40 shadow-lg scale-105' : ''
        } ${variant === 'mobile' ? 'md:hidden' : ''}`}
      >
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}>
          {isOpen ? <X size={16} /> : <Menu size={16} />}
        </div>
      </Button>

      <div
        className={`absolute top-full right-0 mt-4 mx-6 w-80 bg-black/95 backdrop-blur-md border border-white/30 rounded-xl shadow-2xl z-[99999] transition-all duration-200 ease-out transform origin-top-right ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="p-5 flex flex-col space-y-2">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-xl pointer-events-none" />

          {user ? renderAuthenticatedMenu() : (
            <>
              {/* Main Navigation for guests */}
              {!isCurrentPage('/') && (
                <Button variant="ghost" onClick={() => handleAnimatedNavigation('/')} className="w-full justify-start text-left mb-2">
                  <Home size={16} className="mr-3" />
                  Highscores
                </Button>
              )}

              {!hideStatistics && !isCurrentPage('/statistics') && (
                <Button variant="ghost" onClick={() => handleAnimatedNavigation('/statistics')} className="w-full justify-start text-left mb-2">
                  <BarChart3 size={16} className="mr-3" />
                  Statistics
                </Button>
              )}

              {!isCurrentPage('/achievements') && (
                <Button variant="ghost" onClick={() => handleAnimatedNavigation('/achievements')} className="w-full justify-start text-left mb-2">
                  <Trophy size={16} className="mr-3" />
                  Achievements
                </Button>
              )}

              {/* Actions for guests */}
              {onSpinWheel && !hideSpinButton && (
                <Button variant="ghost" onClick={() => handleNavigation(onSpinWheel)} className="w-full justify-start text-left mb-2 hover:bg-blue-500/10 text-blue-200">
                  <Gamepad2 size={16} className="mr-3 text-blue-300" />
                  Spin the Wheel
                </Button>
              )}

              {onShowRules && !hideRulesButton && (
                <Button variant="ghost" onClick={() => handleNavigation(onShowRules)} className="w-full justify-start text-left mb-2 hover:bg-blue-500/10 text-blue-200">
                  <BookOpen size={16} className="mr-3 text-blue-300" />
                  Competition Rules
                </Button>
              )}

              {/* Fullscreen toggle for guests */}
              <Button variant="ghost" onClick={() => handleNavigation(toggleFullscreen)} className="w-full justify-start text-left mb-2 hover:bg-purple-500/10 text-purple-200">
                {isFullscreen ? <Minimize size={16} className="mr-3 text-purple-300" /> : <Maximize size={16} className="mr-3 text-purple-300" />}
                {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              </Button>

              {/* Sign In */}
              <div className="border-t border-white/20 my-3 pt-3">
                <Button variant="ghost" onClick={() => handleAnimatedNavigation('/auth')} className="w-full justify-start text-left">
                  Sign In
                </Button>
              </div>
            </>
          )}

          {rightActions && (
            <div className="pt-2 border-t border-white/20 mt-2">
              {rightActions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartMenu;