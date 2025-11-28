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
    
    // Update theme for all existing terminals
    const themeData = themes[themeKey];
    if (!themeData || !themeData.terminal) {
      console.warn(`Theme ${themeKey} does not have terminal configuration`);
      return;
    }
    
    Object.keys(terminalInstances.current || {}).forEach(sessionId => {
      const terminal = terminalInstances.current[sessionId];
      if (terminal && terminal.options) {
        terminal.options.theme = themeData.terminal;
        // Force a refresh by writing a zero-width space and clearing it
        if (typeof terminal.refresh === 'function') {
          terminal.refresh(0, terminal.rows - 1);
        }
      }
    });
  };

  const currentTheme = themes[theme];

  return {
    theme,
    setTheme: changeTheme,
    currentTheme,
    themes
  };
}

