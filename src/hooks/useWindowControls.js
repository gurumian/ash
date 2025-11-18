import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing window controls (Windows/Linux only)
 */
export function useWindowControls(isWindows) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isWindows) return;

    // Check initial maximized state
    window.electronAPI.windowIsMaximized().then((result) => {
      setIsMaximized(result.isMaximized);
    });

    // Listen for maximize/unmaximize events
    window.electronAPI.onWindowMaximized(() => {
      setIsMaximized(true);
    });
    window.electronAPI.onWindowUnmaximized(() => {
      setIsMaximized(false);
    });

    return () => {
      window.electronAPI.removeAllListeners('window-maximized');
      window.electronAPI.removeAllListeners('window-unmaximized');
    };
  }, [isWindows]);

  const handleMinimize = useCallback(async () => {
    await window.electronAPI.windowMinimize();
  }, []);

  const handleMaximize = useCallback(async () => {
    await window.electronAPI.windowMaximize();
  }, []);

  const handleClose = useCallback(async () => {
    await window.electronAPI.windowClose();
  }, []);

  return {
    isMaximized,
    handleMinimize,
    handleMaximize,
    handleClose
  };
}

