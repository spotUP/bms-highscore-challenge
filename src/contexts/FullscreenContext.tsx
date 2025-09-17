import React, { createContext, useContext, ReactNode } from 'react';
import { useFullscreenPreference } from '@/hooks/useFullscreenPreference';

interface FullscreenContextType {
  isFullscreen: boolean;
  fullscreenEnabled: boolean;
  loading: boolean;
  updateFullscreenPreference: (enabled: boolean) => Promise<void>;
  toggleFullscreenPreference: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
}

const FullscreenContext = createContext<FullscreenContextType | undefined>(undefined);

interface FullscreenProviderProps {
  children: ReactNode;
}

export const FullscreenProvider: React.FC<FullscreenProviderProps> = ({ children }) => {
  const fullscreenData = useFullscreenPreference();

  return (
    <FullscreenContext.Provider value={fullscreenData}>
      {children}
    </FullscreenContext.Provider>
  );
};

export const useFullscreenContext = () => {
  const context = useContext(FullscreenContext);
  if (context === undefined) {
    throw new Error('useFullscreenContext must be used within a FullscreenProvider');
  }
  return context;
};