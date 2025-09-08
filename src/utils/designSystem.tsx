// Design System Constants for BMS Highscore Challenge
// Based on the front page design patterns

import React from 'react';

export const DESIGN_SYSTEM = {
  // Layout
  layout: {
    container: "min-h-screen text-white p-4 md:p-8 relative z-10",
    background: "radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)",
    content: "w-full space-y-8",
    maxWidth: "max-w-7xl mx-auto",
  },

  // Typography
  typography: {
    h1: "text-4xl md:text-6xl font-bold animated-gradient leading-tight py-2",
    h2: "text-3xl md:text-4xl font-bold animated-gradient leading-tight py-2",
    h3: "text-2xl md:text-3xl font-bold text-white leading-tight",
    h4: "text-xl md:text-2xl font-semibold text-white leading-tight",
    body: "text-white",
    bodySecondary: "text-gray-300",
    bodyMuted: "text-gray-400",
    arcade: "font-arcade font-bold text-lg animated-gradient",
    clock: "font-arcade font-bold text-lg animated-gradient",
  },

  // Cards
  cards: {
    primary: "bg-black/30 border-white/20",
    secondary: "bg-gray-900 border-white/20",
    hover: "hover:scale-[1.02] transition-transform duration-200",
    interactive: "cursor-pointer hover:scale-[1.02] transition-transform duration-200",
  },

  // Buttons
  buttons: {
    primary: "bg-arcade-neonPink hover:bg-arcade-neonPink/80 text-black font-bold",
    secondary: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    arcade: "font-arcade text-sm border-2 border-arcade-neonCyan text-arcade-neonCyan hover:bg-arcade-neonCyan hover:text-black",
  },

  // Navigation
  navigation: {
    desktop: "hidden md:flex gap-4 items-center",
    mobile: "md:hidden",
    menuItem: "text-white hover:text-arcade-neonCyan transition-colors duration-200",
  },

  // Grid Layouts
  grid: {
    main: "grid gap-4 h-[calc(100vh-12rem)] grid-cols-1 lg:grid-cols-6",
    mobile: "grid gap-4 min-h-screen",
    cards: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
    charts: "grid grid-cols-1 lg:grid-cols-2 gap-6",
  },

  // Spacing
  spacing: {
    section: "space-y-8",
    card: "space-y-4",
    content: "space-y-6",
    small: "space-y-2",
  },

  // Animations
  animations: {
    fadeIn: "animate-in fade-in duration-300",
    slideIn: "animate-in slide-in-from-bottom-4 duration-300",
    glow: "animate-glow",
    gradient: "animated-gradient",
    shine: {
      gold: "animate-gold-shine",
      silver: "animate-silver-shine", 
      bronze: "animate-bronze-shine",
    },
  },

  // Status Colors
  status: {
    success: "text-green-400",
    warning: "text-yellow-400", 
    error: "text-red-400",
    info: "text-arcade-neonCyan",
    primary: "text-arcade-neonPink",
  },

  // Loading States
  loading: {
    spinner: "animate-spin rounded-full h-8 w-8 border-b-2 border-arcade-neonCyan",
    skeleton: "bg-gray-800 rounded-lg animate-pulse",
    text: "text-white text-xl",
  },
} as const;

// Utility functions for consistent styling
export const getPageLayout = () => ({
  className: DESIGN_SYSTEM.layout.container,
  style: { background: DESIGN_SYSTEM.layout.background },
});

export const getCardStyle = (variant: 'primary' | 'secondary' = 'primary', interactive = false) => {
  const base = DESIGN_SYSTEM.cards[variant];
  const hover = interactive ? DESIGN_SYSTEM.cards.interactive : DESIGN_SYSTEM.cards.hover;
  return `${base} ${hover}`;
};

export const getButtonStyle = (variant: 'primary' | 'secondary' | 'ghost' | 'outline' | 'arcade' = 'secondary') => {
  return DESIGN_SYSTEM.buttons[variant];
};

export const getTypographyStyle = (variant: keyof typeof DESIGN_SYSTEM.typography) => {
  return DESIGN_SYSTEM.typography[variant];
};

// Common page structure components
export const PageHeader = ({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) => (
  <div className="flex justify-between items-center mb-8">
    <div>
      <h1 className={getTypographyStyle('h1')}>{title}</h1>
      {subtitle && <p className={getTypographyStyle('bodySecondary')}>{subtitle}</p>}
    </div>
    {children}
  </div>
);

export const PageContainer = ({ children, className = "" }: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`${DESIGN_SYSTEM.layout.content} ${className}`}>
    {children}
  </div>
);

export const LoadingSpinner = ({ text = "Loading..." }: { text?: string }) => (
  <div className="min-h-screen flex items-center justify-center relative z-10"
       style={{ background: DESIGN_SYSTEM.layout.background }}>
    <div className="text-center">
      <div className={DESIGN_SYSTEM.loading.spinner}></div>
      <div className={DESIGN_SYSTEM.loading.text}>{text}</div>
    </div>
  </div>
);
