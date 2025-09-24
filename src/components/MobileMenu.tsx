import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { usePageTransitions } from "@/hooks/usePageTransitions";
import PerformanceModeToggle from "@/components/PerformanceModeToggle";
import ThemeSelector from "@/components/ThemeSelector";
import PublicTournamentBrowser from "@/components/PublicTournamentBrowser";

interface MobileMenuProps {
  onSpinWheel: () => void;
  hideBracketsLink?: boolean;
  hideSpinButton?: boolean;
  hideStatistics?: boolean;
}

const MobileMenu = ({ onSpinWheel, hideBracketsLink = false, hideSpinButton = false, hideStatistics = false }: MobileMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { animatedNavigate } = usePageTransitions({ exitDuration: 600 });

  // Helper function to check if we're on the current page
  const isCurrentPage = (path: string) => location.pathname === path;

  const handleMenuToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleNavigation = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const handleAnimatedNavigation = (path: string) => {
    animatedNavigate(path);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleMenuToggle}
        className="md:hidden"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-black/90 border border-white/20 rounded-lg shadow-lg z-50">
          <div className="p-4 space-y-2">
            {user ? (
              <>
                <div className="text-gray-300 text-sm mb-2 border-b border-white/20 pb-2">
                  Welcome, {user.email}
                </div>
                <Button
                  variant={isCurrentPage('/') ? 'default' : 'ghost'}
                  onClick={isCurrentPage('/') ? undefined : () => handleAnimatedNavigation('/')}
                  disabled={isCurrentPage('/')}
                  className={`w-full justify-start text-left ${isCurrentPage('/') ? 'cursor-default' : ''}`}
                >
                  Highscores
                </Button>
                {!hideBracketsLink && (
                  <Button
                    variant={isCurrentPage('/admin/brackets') ? 'default' : 'ghost'}
                    onClick={isCurrentPage('/admin/brackets') ? undefined : () => handleAnimatedNavigation('/admin/brackets')}
                    disabled={isCurrentPage('/admin/brackets')}
                    className={`w-full justify-start text-left ${isCurrentPage('/admin/brackets') ? 'cursor-default' : ''}`}
                  >
                    Brackets
                  </Button>
                )}
                {!hideSpinButton && (
                  <Button
                    variant="ghost"
                    onClick={() => handleNavigation(onSpinWheel)}
                    className="w-full justify-start text-left"
                  >
                    Spin the Wheel
                  </Button>
                )}
                {!hideStatistics && (
                  <Button
                    variant={isCurrentPage('/statistics') ? 'default' : 'ghost'}
                    onClick={isCurrentPage('/statistics') ? undefined : () => handleAnimatedNavigation('/statistics')}
                    disabled={isCurrentPage('/statistics')}
                    className={`w-full justify-start text-left ${isCurrentPage('/statistics') ? 'cursor-default' : ''}`}
                  >
                    Statistics
                  </Button>
                )}
                <Button
                  variant={isCurrentPage('/achievements') ? 'default' : 'ghost'}
                  onClick={isCurrentPage('/achievements') ? undefined : () => handleAnimatedNavigation('/achievements')}
                  disabled={isCurrentPage('/achievements')}
                  className={`w-full justify-start text-left ${isCurrentPage('/achievements') ? 'cursor-default' : ''}`}
                >
                  Achievements
                </Button>
                <div className="py-1">
                  <PerformanceModeToggle 
                    variant="ghost" 
                    className="w-full justify-start text-left"
                    showText={true}
                  />
                </div>
                <div className="py-1">
                  <ThemeSelector />
                </div>
                {isAdmin && (
                  <Button
                    variant={isCurrentPage('/admin') ? 'default' : 'ghost'}
                    onClick={isCurrentPage('/admin') ? undefined : () => handleAnimatedNavigation('/admin')}
                    disabled={isCurrentPage('/admin')}
                    className={`w-full justify-start text-left ${isCurrentPage('/admin') ? 'cursor-default' : ''}`}
                  >
                    Admin Panel
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => handleNavigation(signOut)}
                  className="w-full justify-start text-left"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <div className="w-full">
                  <PublicTournamentBrowser />
                </div>
                <Button
                  variant="ghost"
                  onClick={() => handleAnimatedNavigation('/brackets')}
                  className="w-full justify-start text-left"
                >
                  Tournament Brackets
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleAnimatedNavigation('/auth')}
                  className="w-full justify-start text-left"
                >
                  Sign In
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileMenu;