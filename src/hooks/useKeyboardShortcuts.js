import { useEffect } from 'react';

/**
 * Custom hook for handling global keyboard shortcuts
 */
export function useKeyboardShortcuts({
  activeSessionId,
  showSearchBar,
  setShowSearchBar,
  terminalInstances,
  terminalFontSize,
  setTerminalFontSize,
  resizeTerminal
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't handle shortcuts when typing in input fields
      if (event.target.matches('input, textarea')) {
        return;
      }

      // Ctrl+F or Cmd+F - open search bar
      if ((event.ctrlKey || event.metaKey) && (event.key === 'f' || event.key === 'F')) {
        // Only open search if there's an active session
        if (activeSessionId) {
          setShowSearchBar(true);
          event.preventDefault();
        }
      }
      // Escape - close search bar
      if (event.key === 'Escape' && showSearchBar) {
        setShowSearchBar(false);
        event.preventDefault();
      }
      // Ctrl + '+' or Ctrl + '=' - increase font size
      if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=')) {
        const currentSize = terminalFontSize || 13;
        const newSize = Math.min(32, currentSize + 1);
        if (newSize !== currentSize) {
          setTerminalFontSize(newSize);
          localStorage.setItem('ash-terminal-font-size', newSize.toString());
          // Update all terminal instances
          setTimeout(() => {
            Object.keys(terminalInstances.current || {}).forEach(sessionId => {
              const terminal = terminalInstances.current[sessionId];
              if (terminal && !terminal.isDisposed) {
                terminal.options.fontSize = newSize;
              }
            });
            resizeTerminal();
          }, 0);
        }
        event.preventDefault();
      }
      // Ctrl + '-' - decrease font size
      if ((event.ctrlKey || event.metaKey) && event.key === '-') {
        const currentSize = terminalFontSize || 13;
        const newSize = Math.max(8, currentSize - 1);
        if (newSize !== currentSize) {
          setTerminalFontSize(newSize);
          localStorage.setItem('ash-terminal-font-size', newSize.toString());
          // Update all terminal instances
          setTimeout(() => {
            Object.keys(terminalInstances.current || {}).forEach(sessionId => {
              const terminal = terminalInstances.current[sessionId];
              if (terminal && !terminal.isDisposed) {
                terminal.options.fontSize = newSize;
              }
            });
            resizeTerminal();
          }, 0);
        }
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeSessionId, showSearchBar, setShowSearchBar, terminalInstances, terminalFontSize, setTerminalFontSize, resizeTerminal]);
}

