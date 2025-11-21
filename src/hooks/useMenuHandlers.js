import { useEffect, useRef } from 'react';

/**
 * Custom hook for handling menu events
 * Uses refs to always access latest values without re-registering listeners
 */
export function useMenuHandlers({
  activeSessionId,
  setShowConnectionForm,
  setShowSettings,
  setShowSessionManager,
  setSessionManagerWidth,
  setShowAboutDialog,
  setShowTftpServerDialog,
  setAppInfo,
  disconnectSession,
  resizeTerminal
}) {
  // Use refs to store latest values - this prevents re-registration of listeners
  const activeSessionIdRef = useRef(activeSessionId);
  const disconnectSessionRef = useRef(disconnectSession);
  const resizeTerminalRef = useRef(resizeTerminal);

  // Update refs when values change
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    disconnectSessionRef.current = disconnectSession;
  }, [disconnectSession]);

  useEffect(() => {
    resizeTerminalRef.current = resizeTerminal;
  }, [resizeTerminal]);

  // Register event listeners only once
  useEffect(() => {
    // New session menu event
    const handleNewSession = () => {
      setShowConnectionForm(true);
    };
    window.electronAPI.onMenuNewSession(handleNewSession);

    // Close session menu event - use ref to get latest activeSessionId
    const handleCloseSession = () => {
      if (activeSessionIdRef.current) {
        disconnectSessionRef.current(activeSessionIdRef.current);
      }
    };
    window.electronAPI.onMenuCloseSession(handleCloseSession);

    // Settings menu event
    const handleSettings = () => {
      setShowSettings(true);
    };
    window.electronAPI.onMenuSettings(handleSettings);

    // Toggle session manager menu event
    const handleToggleSessionManager = (event, checked) => {
      setShowSessionManager(checked);
      // Reset to default width when showing - use functional update to get current value
      setSessionManagerWidth(prev => {
        if (checked && prev === 0) {
          return 250;
        }
        return prev;
      });
      
      // Resize terminal after toggle - use ref to get latest function
      setTimeout(() => {
        resizeTerminalRef.current();
      }, 350); // Wait for CSS transition to complete
    };
    window.electronAPI.onMenuToggleSessionManager(handleToggleSessionManager);

    // Update status log listener (for debugging)
    window.electronAPI.onUpdateStatusLog?.((status) => {
      console.log('[UPDATE STATUS]', status);
    });

    // Update available event
    window.electronAPI.onUpdateAvailable?.((data) => {
      console.log('[UPDATE] Update available:', data);
      console.log('[UPDATE] Version:', data.version);
      console.log('[UPDATE] Release date:', data.releaseDate);
      console.log('[UPDATE] Download will start automatically...');
      // TODO: Show notification to user
    });

    // Update download progress event
    window.electronAPI.onUpdateDownloadProgress?.((data) => {
      console.log('[UPDATE] Download progress:', Math.round(data.percent), '%');
      console.log('[UPDATE] Transferred:', (data.transferred / 1024 / 1024).toFixed(2), 'MB');
      console.log('[UPDATE] Total:', (data.total / 1024 / 1024).toFixed(2), 'MB');
      console.log('[UPDATE] Speed:', (data.bytesPerSecond / 1024 / 1024).toFixed(2), 'MB/s');
      // TODO: Show progress bar to user
    });

    // Update downloaded event
    window.electronAPI.onUpdateDownloaded?.((data) => {
      console.log('[UPDATE] Update downloaded successfully!');
      console.log('[UPDATE] Version:', data.version);
      console.log('[UPDATE] The update will be installed when you quit the app.');
      console.log('[UPDATE] Or call window.electronAPI.quitAndInstall() to install now.');
      // TODO: Show notification with install button
    });

    // Update error event
    window.electronAPI.onUpdateError?.((data) => {
      console.error('[UPDATE] Update error:', data);
      console.error('[UPDATE] Error code:', data.code);
      console.error('[UPDATE] Error message:', data.message);
    });

    // Check for Updates menu event
    window.electronAPI.onMenuCheckUpdates(async () => {
      try {
        const result = await window.electronAPI.checkForUpdates();
        if (result.success) {
          if (result.updateInfo) {
            console.log('Update available:', result.updateInfo.version);
            // Update will be handled automatically by update-handler.js
          } else {
            console.log('No updates available');
            // Could show a notification here
          }
        } else {
          console.error('Update check failed:', result.error);
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    });

    // About menu event
    window.electronAPI.onMenuAbout(async () => {
      // Load app info if not already loaded
      try {
        const info = await window.electronAPI.getAppInfo();
        if (info.success) {
          setAppInfo({
            version: info.version,
            author: info.author,
          });
        }
      } catch (error) {
        console.error('Failed to get app info:', error);
      }
      setShowAboutDialog(true);
    });

    // TFTP Server menu event
    window.electronAPI.onMenuTftpServer(() => {
      setShowTftpServerDialog(true);
    });

    return () => {
      // Clean up event listeners
      window.electronAPI.removeAllListeners('menu-new-session');
      window.electronAPI.removeAllListeners('menu-close-session');
      window.electronAPI.removeAllListeners('menu-toggle-session-manager');
      window.electronAPI.removeAllListeners('menu-settings');
      window.electronAPI.removeAllListeners('menu-check-updates');
      window.electronAPI.removeAllListeners('menu-about');
      window.electronAPI.removeAllListeners('menu-tftp-server');
      window.electronAPI.removeAllListeners('update-status-log');
      window.electronAPI.removeAllListeners('update-available');
      window.electronAPI.removeAllListeners('update-download-progress');
      window.electronAPI.removeAllListeners('update-downloaded');
      window.electronAPI.removeAllListeners('update-error');
    };
  }, []); // Empty dependency array - listeners registered only once
}

