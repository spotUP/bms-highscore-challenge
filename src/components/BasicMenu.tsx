import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";

interface BasicMenuProps {
  animatedNavigate: (path: string) => void;
  onShowRules?: () => void;
}

const BasicMenu: React.FC<BasicMenuProps> = ({ animatedNavigate, onShowRules }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut, isAdmin } = useAuth();
  const location = useLocation();

  const handleClose = () => setIsOpen(false);

  const navigate = (path: string) => {
    handleClose();
    animatedNavigate(path);
  };

  const handleAction = (action: () => void) => {
    handleClose();
    action();
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="theme-button"
      >
        {isOpen ? <X size={16} /> : <Menu size={16} />}
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-4 mx-6 w-80 bg-black/95 backdrop-blur-md border border-white/30 rounded-xl shadow-2xl z-[99999]">
          <div className="p-5 space-y-2">
            {user ? (
              <>
                <div className="text-gray-300 text-sm mb-3 border-b border-white/20 pb-2">
                  Welcome, {user.email}
                </div>

                {location.pathname !== '/' && (
                  <Button variant="ghost" onClick={() => navigate('/')} className="w-full justify-start">
                    Highscores
                  </Button>
                )}

                {location.pathname !== '/achievements' && (
                  <Button variant="ghost" onClick={() => navigate('/achievements')} className="w-full justify-start">
                    Achievements
                  </Button>
                )}

                {onShowRules && (
                  <Button variant="ghost" onClick={() => handleAction(onShowRules)} className="w-full justify-start text-blue-200">
                    Competition Rules
                  </Button>
                )}

                {isAdmin && location.pathname !== '/admin' && (
                  <Button variant="ghost" onClick={() => navigate('/admin')} className="w-full justify-start text-amber-200">
                    Admin Panel
                  </Button>
                )}

                <div className="border-t border-white/20 my-3 pt-3">
                  <Button variant="ghost" onClick={() => handleAction(signOut)} className="w-full justify-start text-red-400">
                    Sign Out
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="ghost" onClick={() => navigate('/auth')} className="w-full justify-start">
                Sign In
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BasicMenu;