import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Menu, X, Home, BarChart3, Trophy, Brackets, Settings, LogOut, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";
import PublicTournamentBrowser from "@/components/PublicTournamentBrowser";
import HelpMenu from "@/components/HelpMenu";
import { useHelpGuide } from "@/hooks/useHelpGuide";

interface DesktopHamburgerMenuProps {
  animatedNavigate: (path: string) => void;
  hideBracketsLink?: boolean;
  hideStatistics?: boolean;
  rightActions?: React.ReactNode;
}

const DesktopHamburgerMenu: React.FC<DesktopHamburgerMenuProps> = ({
  animatedNavigate,
  hideBracketsLink = false,
  hideStatistics = false,
  rightActions
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const { startTour, tours } = useHelpGuide();

  const isCurrentPage = (path: string) => location.pathname === path;

  const handleMenuToggle = () => {
    console.log('Hamburger menu toggle clicked, current state:', isOpen);
    setIsOpen(!isOpen);
  };

  const handleNavigation = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const handleAnimatedNavigation = (path: string) => {
    // Close menu immediately to prevent flickering during page transition
    setIsOpen(false);

    // Small delay to allow menu close animation to complete
    setTimeout(() => {
      animatedNavigate(path);
    }, 150);
  };

  const handleTakeTour = () => {
    console.log('🎭 Admin hamburger menu: Take the Tour clicked');
    const welcomeTour = tours.find(tour => tour.id === 'welcome');
    if (welcomeTour) {
      console.log('🎭 Found welcome tour, starting...');
      startTour(welcomeTour);
      setIsOpen(false); // Close the menu
    } else {
      console.error('❌ Welcome tour not found in hamburger menu');
    }
  };

  // Close menu when location changes (prevents flickering during navigation)
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  console.log('DesktopHamburgerMenu render, isOpen:', isOpen, 'user:', !!user, 'isAdmin:', isAdmin, 'adminPages:', adminPages.length);

  const renderMenuItem = (path: string, label: string, index: number = 0) => {
    if (isCurrentPage(path)) return null;

    return (
      <Button
        key={path}
        variant="ghost"
        onClick={() => handleAnimatedNavigation(path)}
        className="w-full justify-start text-left transition-all duration-200 hover:scale-105 hover:bg-white/10 hover:shadow-sm hover:translate-x-1"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <span className={`transition-all duration-200 ${isOpen ? 'animate-fade-in-up' : ''}`}>
          {label}
        </span>
      </Button>
    );
  };

  // Smart page detection - automatically discovers available pages
  const getAvailablePages = () => {
    const basePages = [
      { path: '/', label: 'Highscores', icon: Home, category: 'main' },
      { path: '/statistics', label: 'Statistics', icon: BarChart3, category: 'main', hidden: hideStatistics },
      { path: '/achievements', label: 'Achievements', icon: Trophy, category: 'main' },
    ];

    const adminPages = [
      { path: '/admin/brackets', label: 'Brackets', icon: Brackets, category: 'admin', hidden: hideBracketsLink },
      { path: '/admin', label: 'Admin Panel', icon: Settings, category: 'admin' },
    ];

    // Filter based on permissions and visibility
    const availablePages = [
      ...basePages.filter(page => !page.hidden),
      ...(isAdmin ? adminPages.filter(page => !page.hidden) : [])
    ];

    // Remove current page from menu
    return availablePages.filter(page => !isCurrentPage(page.path));
  };

  const renderSmartMenu = () => {
    const pages = getAvailablePages();
    let itemIndex = 0;

    // Group pages by category
    const mainPages = pages.filter(p => p.category === 'main');
    const adminPages = pages.filter(p => p.category === 'admin');

    console.log('🎭 DesktopHamburgerMenu renderSmartMenu:', {
      isAdmin,
      mainPagesCount: mainPages.length,
      adminPagesCount: adminPages.length,
      adminPagesOrIsAdmin: adminPages.length > 0 || isAdmin,
      tours: tours.length
    });

    return (
      <>
        <div className={`text-gray-300 text-sm mb-3 border-b border-white/20 pb-2 transition-all duration-300 ${
          isOpen ? 'animate-fade-in-up' : ''
        }`}>
          <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-medium">
            Welcome, {user?.email}
          </span>
          <div className="text-xs text-gray-400 mt-1">
            Currently on: {location.pathname === '/' ? 'Highscores' : location.pathname.split('/').pop()?.replace(/^\w/, c => c.toUpperCase())}
          </div>
        </div>

        {/* Main Navigation */}
        {mainPages.map((page) => {
          const IconComponent = page.icon;
          return (
            <Button
              key={page.path}
              variant="ghost"
              onClick={() => handleAnimatedNavigation(page.path)}
              className="w-full justify-start text-left transition-all duration-200 hover:scale-105 hover:bg-white/10 hover:shadow-sm hover:translate-x-1"
              style={{ animationDelay: `${itemIndex++ * 50}ms` }}
            >
              <div className={`flex items-center gap-3 transition-all duration-200 ${isOpen ? 'animate-fade-in-up' : ''}`}>
                <IconComponent size={16} className="text-white/70" />
                <span>{page.label}</span>
              </div>
            </Button>
          );
        })}

        {/* Admin Section */}
        {(adminPages.length > 0 || isAdmin) && (
          <>
            <div className="border-t border-white/20 my-3 pt-3">
              <div className="text-xs text-gray-400 mb-3 px-2">Administration</div>
            </div>
            {adminPages.map((page) => {
              const IconComponent = page.icon;
              return (
                <Button
                  key={page.path}
                  variant="ghost"
                  onClick={() => handleAnimatedNavigation(page.path)}
                  className="w-full justify-start text-left transition-all duration-200 hover:scale-105 hover:bg-amber-500/10 hover:shadow-sm hover:translate-x-1"
                  style={{ animationDelay: `${itemIndex++ * 50}ms` }}
                >
                  <div className={`flex items-center gap-3 transition-all duration-200 ${isOpen ? 'animate-fade-in-up' : ''} text-amber-200`}>
                    <IconComponent size={16} className="text-amber-300" />
                    <span>{page.label}</span>
                  </div>
                </Button>
              );
            })}

            {/* Take the Tour button for admins */}
            {isAdmin ? (
              <Button
                variant="ghost"
                onClick={handleTakeTour}
                className="w-full justify-start text-left transition-all duration-200 hover:scale-105 hover:bg-cyan-500/10 hover:shadow-sm hover:translate-x-1"
                style={{ animationDelay: `${itemIndex++ * 50}ms` }}
              >
                <div className={`flex items-center gap-3 transition-all duration-200 ${isOpen ? 'animate-fade-in-up' : ''} text-cyan-200`}>
                  <HelpCircle size={16} className="text-cyan-300" />
                  <span>Take the Tour</span>
                </div>
              </Button>
            ) : (
              <>
                {console.log('🎭 Take the Tour button NOT rendered - isAdmin is false:', isAdmin)}
                {null}
              </>
            )}
          </>
        )}

        {/* Sign Out */}
        <div className="border-t border-white/20 my-3 pt-3">
          <Button
            variant="ghost"
            onClick={() => handleNavigation(signOut)}
            className={`w-full justify-start text-left transition-all duration-200 hover:scale-105 hover:bg-red-500/20 hover:text-red-400 hover:translate-x-1 ${
              isOpen ? 'animate-fade-in-up' : ''
            }`}
            style={{ animationDelay: `${itemIndex * 50}ms` }}
          >
            <div className="flex items-center gap-3 transition-all duration-200">
              <LogOut size={16} className="text-red-400" />
              <span>Sign Out</span>
            </div>
          </Button>
        </div>
      </>
    );
  };

  const renderAuthenticatedMenu = () => renderSmartMenu();

  const renderUnauthenticatedMenu = () => (
    <>
      <div className="w-full">
        <PublicTournamentBrowser />
      </div>
      <Button
        variant="ghost"
        onClick={() => handleAnimatedNavigation('/auth')}
        className="w-full justify-start text-left"
      >
        Sign In
      </Button>
    </>
  );

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={handleMenuToggle}
        data-testid="desktop-menu-button"
        className={`theme-button transition-all duration-300 hover:scale-105 hover:shadow-md ${
          isOpen ? 'bg-white/10 border-white/40 shadow-lg scale-105' : ''
        }`}
      >
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}>
          {isOpen ? <X size={16} /> : <Menu size={16} />}
        </div>
      </Button>

      <div
        key={`menu-${location.pathname}`}
        className={`absolute top-full right-0 mt-4 mr-3 w-72 bg-black/95 backdrop-blur-md border border-white/30 rounded-xl shadow-2xl z-[99999] transition-all duration-200 ease-out transform origin-top-right ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="p-5 flex flex-col space-y-2">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-xl pointer-events-none" />

          {user ? renderAuthenticatedMenu() : renderUnauthenticatedMenu()}

          {/* Help Menu for authenticated users */}
          {user && (
            <div className="border-t border-white/20 my-3 pt-3">
              <HelpMenu onClose={() => setIsOpen(false)} />
            </div>
          )}

          {rightActions && (
            <div className="pt-2 border-t border-white/20 mt-2 animate-fade-in">
              {rightActions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DesktopHamburgerMenu;