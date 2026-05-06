'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getAppliedTheme,
  getNextTheme,
  isTheme,
  resolveStoredTheme,
} from '@/lib/theme.mjs';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const theme = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('resikin-theme-change', onStoreChange);
      return () => window.removeEventListener('resikin-theme-change', onStoreChange);
    },
    () => document.documentElement.dataset.theme || resolveStoredTheme(),
    () => 'light'
  );

  const setTheme = useCallback((nextTheme) => {
    if (!isTheme(nextTheme)) return;

    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }, []);

  useEffect(() => {
    setTheme(resolveStoredTheme());
  }, [setTheme]);

  const toggleTheme = useCallback(() => {
    setTheme(getNextTheme(getAppliedTheme()));
  }, [setTheme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
