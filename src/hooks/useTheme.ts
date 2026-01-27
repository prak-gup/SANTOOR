import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

export function useTheme() {
  // Initialize from localStorage or default to dark
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('santoor-theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  // Apply theme to HTML element
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('santoor-theme', theme);
  }, [theme]);

  // Toggle function
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return { theme, toggleTheme };
}
