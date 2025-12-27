import { useState, useEffect, useRef } from 'react';
import { themes } from '../themes/themes';

/**
 * Custom hook for theme management
 */
export function useTheme(terminalInstances) {
  // Get theme from localStorage, but validate it exists in themes
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('ash-theme');
    if (savedTheme && themes[savedTheme]) {
      return savedTheme;
    }
    // Default to terminus if no valid theme is saved
    return 'terminus';
  };

  const [theme, setTheme] = useState(getInitialTheme());

  const changeTheme = (themeKey) => {
    setTheme(themeKey);
    localStorage.setItem('ash-theme', themeKey);
    
    // Note: Terminal theme updates are now handled by useTerminalManagement's useEffect
    // This keeps the logic centralized and ensures proper reactivity
    // The terminalInstances ref is updated by App.jsx, so changes will be picked up automatically
  };

  const currentTheme = themes[theme];

  return {
    theme,
    setTheme: changeTheme,
    currentTheme,
    themes
  };
}

