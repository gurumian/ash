import { useEffect } from 'react';

/**
 * Custom hook for handling global keyboard shortcuts
 */
export function useKeyboardShortcuts({
  activeSessionId,
  showSearchBar,
  setShowSearchBar
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+F or Cmd+F - open search bar
      if ((event.ctrlKey || event.metaKey) && (event.key === 'f' || event.key === 'F')) {
        // Only open search if there's an active session and we're not in an input field
        if (activeSessionId && !event.target.matches('input, textarea')) {
          setShowSearchBar(true);
          event.preventDefault();
        }
      }
      // Escape - close search bar
      if (event.key === 'Escape' && showSearchBar) {
        setShowSearchBar(false);
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeSessionId, showSearchBar, setShowSearchBar]);
}

