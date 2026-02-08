import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem('qrbin-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return null;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme() ?? getSystemTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('qrbin-theme', theme);
  }, [theme]);

  function toggleTheme() {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  return { theme, toggleTheme };
}
