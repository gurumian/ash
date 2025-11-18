import { useState, useEffect, useRef } from 'react';
import { themes } from '../themes/themes';

/**
 * Custom hook for theme management
 */
export function useTheme(terminalInstances) {
  const [theme, setTheme] = useState(
    localStorage.getItem('ash-theme') || 'terminus'
  );

  const changeTheme = (themeKey) => {
    setTheme(themeKey);
    localStorage.setItem('ash-theme', themeKey);
    
    // Update theme for all existing terminals
    Object.keys(terminalInstances.current).forEach(sessionId => {
      const terminal = terminalInstances.current[sessionId];
      if (terminal) {
        terminal.options.theme = themes[themeKey].terminal;
        // Force a refresh by writing a zero-width space and clearing it
        terminal.refresh(0, terminal.rows - 1);
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

