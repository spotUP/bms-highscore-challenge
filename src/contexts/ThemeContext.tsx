import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeId = 'current' | 'modern-dark' | 'tron';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  themes: { id: ThemeId; label: string }[];
  accent: 'cyan' | 'magenta';
  setAccent: (a: 'cyan' | 'magenta') => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'bms/theme';
const STORAGE_ACCENT = 'bms/theme_accent';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>('current');
  const [accent, setAccentState] = useState<'cyan' | 'magenta'>('cyan');

  // Load saved theme
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      const saved = savedRaw as any;
      const normalized: ThemeId = (saved === 'modern-light') ? 'current' : (saved === 'modern-dark' || saved === 'tron' ? saved : 'current');
      setThemeState(normalized);
      const savedAccent = (localStorage.getItem(STORAGE_ACCENT) as any) || 'cyan';
      setAccentState(savedAccent === 'magenta' ? 'magenta' : 'cyan');
    } catch {}
  }, []);

  const applyTheme = (t: ThemeId) => {
    const body = document.body;
    body.classList.remove('theme-current', 'theme-modern-light', 'theme-modern-dark', 'theme-tron');
    const cls =
      t === 'current' ? 'theme-current' :
      t === 'modern-dark' ? 'theme-modern-dark' :
      'theme-tron';
    body.classList.add(cls);
    // Apply accent class for Tron
    body.classList.remove('tron-magenta');
    if (t === 'tron' && accent === 'magenta') {
      body.classList.add('tron-magenta');
    }
  };

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme, accent]);

  const setTheme = (t: ThemeId) => setThemeState(t);
  const setAccent = (a: 'cyan' | 'magenta') => {
    setAccentState(a);
    try { localStorage.setItem(STORAGE_ACCENT, a); } catch {}
  };

  const themes = useMemo<{
    id: ThemeId;
    label: string;
  }[]>(() => ([
    { id: 'current', label: 'Arcade (Current)' },
    { id: 'modern-dark', label: 'Modern Dark' },
    { id: 'tron', label: 'Tron (Futuristic)' },
  ]), []);

  const value = useMemo(() => ({ theme, setTheme, themes, accent, setAccent }), [theme, themes, accent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
