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
          if (activeSession && !(reconnectingSessions?.get(activeSessionId))) {
            // Allow F5 to reconnect even if connected (refresh)
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
    };

    // Use capture phase to catch events before they reach terminal
    // Also add to document for better coverage
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeSessionId, showSearchBar, setShowSearchBar, showAICommandInput, setShowAICommandInput, llmSettings, onReconnectSession, sessions, reconnectingSessions]);
}

