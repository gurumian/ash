import { useEffect } from 'react';

/**
 * Custom hook for handling global keyboard shortcuts
 */
export function useKeyboardShortcuts({
  activeSessionId,
  showSearchBar,
  setShowSearchBar,
  showAICommandInput,
  setShowAICommandInput,
  showAIChatSidebar,
  setShowAIChatSidebar,
  llmSettings,
  terminalInstances,
  terminalFontSize,
  setTerminalFontSize,
  resizeTerminal,
  onReconnectSession,
  sessions,
  reconnectingSessions
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // F5 - manual reconnect for disconnected sessions (check FIRST, before anything else)
      // This must be handled globally before terminal can intercept it
      if (event.key === 'F5') {
        if (activeSessionId && onReconnectSession && sessions) {
          const activeSession = sessions.find(s => s.id === activeSessionId);
          if (activeSession && !activeSession.isConnected && !(reconnectingSessions?.get(activeSessionId))) {
            onReconnectSession(activeSessionId);
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            return;
          }
        }
        // If conditions not met, still prevent default to avoid browser refresh
        event.preventDefault();
        return;
      }

      // Allow standard text editing shortcuts in input/textarea fields
      // This includes Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+A (select all), etc.
      if (event.target.matches('input, textarea')) {
        const isStandardEditShortcut = (event.ctrlKey || event.metaKey) && 
          (event.key === 'z' || event.key === 'Z' || event.key === 'y' || event.key === 'Y' || 
           event.key === 'a' || event.key === 'A' || event.key === 'x' || event.key === 'X' || 
           event.key === 'c' || event.key === 'C' || event.key === 'v' || event.key === 'V');
        if (isStandardEditShortcut) {
          // Let browser handle these shortcuts natively - don't interfere
          return;
        }
      }

      // Check for Ctrl+Shift+A or Cmd+Shift+A (before other checks)
      // This should work even when terminal has focus
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'a' || event.key === 'A')) {
        console.log('=== Ctrl+Shift+A detected (window handler) ===');
        console.log('activeSessionId:', activeSessionId);
        console.log('event.target:', event.target);
        console.log('event.target.tagName:', event.target.tagName);
        console.log('event.target.className:', event.target.className);
        // Only open if there's an active session
        if (activeSessionId) {
          console.log('Opening AI Command Input from window handler');
          setShowAICommandInput(true);
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return;
        } else {
          console.log('No active session, cannot open AI Command Input');
        }
      }

      // Don't handle other shortcuts when typing in input fields (but allow Ctrl+Shift+A above)
      // Exception: don't block Ctrl+Shift+A even in input fields
      if (event.target.matches('input, textarea') && 
          !((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'a' || event.key === 'A'))) {
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
      // Ctrl+Shift+I or Cmd+Shift+I - toggle AI Chat Sidebar
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'i' || event.key === 'I')) {
        if (activeSessionId) {
          setShowAIChatSidebar(prev => !prev);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      // Escape - close search bar, AI input, or AI Chat Sidebar
      if (event.key === 'Escape') {
        if (showSearchBar) {
          setShowSearchBar(false);
          event.preventDefault();
        } else if (showAICommandInput) {
          setShowAICommandInput(false);
          event.preventDefault();
        } else if (showAIChatSidebar) {
          setShowAIChatSidebar(false);
          event.preventDefault();
        }
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

    // Use capture phase to catch events before they reach terminal
    // Also add to document for better coverage
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeSessionId, showSearchBar, setShowSearchBar, showAICommandInput, setShowAICommandInput, llmSettings, terminalInstances, terminalFontSize, setTerminalFontSize, resizeTerminal, onReconnectSession, sessions, reconnectingSessions]);
}

