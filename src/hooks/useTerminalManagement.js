import { useRef, useCallback, useEffect, startTransition } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';

/**
 * Custom hook for managing terminal instances, initialization, and resize
 */
export function useTerminalManagement({
  theme,
  themes,
  scrollbackLines,
  terminalFontSize,
  terminalFontFamily,
  activeSessionId,
  sessions,
  sshConnections,
  sessionLogs,
  appendToLog,
  setContextMenu,
  setShowSearchBar
}) {
  const terminalRefs = useRef({});
  const terminalInstances = useRef({});
  const fitAddons = useRef({});
  const searchAddons = useRef({});
  const terminalInputHandlers = useRef({});
  const terminalContextMenuHandlers = useRef({});
  const pendingResizeRef = useRef(null);

  // Terminal resize utility function
  const resizeTerminal = useCallback(() => {
    // Cancel any pending resize to avoid duplicate work
    if (pendingResizeRef.current !== null) {
      cancelAnimationFrame(pendingResizeRef.current);
    }
    
    // Schedule resize for next animation frame (only once per frame)
    pendingResizeRef.current = requestAnimationFrame(() => {
      pendingResizeRef.current = null;
      
      // Resize all active terminals, not just the active one
      Object.keys(fitAddons.current).forEach(sessionId => {
        const fitAddon = fitAddons.current[sessionId];
        const terminal = terminalInstances.current[sessionId];
        const terminalRef = terminalRefs.current[sessionId];
        
        if (fitAddon && terminal && terminalRef) {
          try {
            // Force a layout recalculation before fitting
            terminalRef.offsetHeight;
            fitAddon.fit();
            
            // Notify SSH server of terminal size change
            const session = sessions.find(s => s.id === sessionId);
            if (session && session.connectionType === 'ssh' && sshConnections.current[sessionId]) {
              const cols = terminal.cols;
              const rows = terminal.rows;
              sshConnections.current[sessionId].resize(cols, rows);
            }
          } catch (error) {
            console.error(`Error resizing terminal for session ${sessionId}:`, error);
          }
        }
      });
    });
  }, [sessions, sshConnections]);

  // Initialize terminal
  const initializeTerminal = useCallback(async (sessionId, sessionInfo = null) => {
    const terminalRef = terminalRefs.current[sessionId];
    if (!terminalRef) return;

    // Clean up existing terminal if it exists
    if (terminalInstances.current[sessionId]) {
      // Remove context menu handler
      if (terminalContextMenuHandlers.current[sessionId]) {
        const { handler, element } = terminalContextMenuHandlers.current[sessionId];
        if (element) {
          element.removeEventListener('contextmenu', handler);
        }
        delete terminalContextMenuHandlers.current[sessionId];
      }
      
      // Dispose terminal - this automatically removes all event listeners
      terminalInstances.current[sessionId].dispose();
      delete terminalInstances.current[sessionId];
      delete terminalInputHandlers.current[sessionId];
    }

    // Get the current theme configuration
    const currentTheme = themes[theme].terminal;
    
    // Get scrollback limit from settings (stored in localStorage)
    const scrollbackLimit = scrollbackLines;
    
    // Create terminal with default size - FitAddon will adjust it accurately
    const terminal = new Terminal({
      cols: 80, // Default, will be adjusted by FitAddon
      rows: 24, // Default, will be adjusted by FitAddon
      cursorBlink: true,
      scrollback: scrollbackLimit, // Ring buffer: automatically discards old lines beyond this limit
      theme: currentTheme,
      fontSize: terminalFontSize || 13,
      fontFamily: terminalFontFamily || "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace",
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      letterSpacing: 0,
      lineHeight: 1.0,
      // Performance optimizations
      fastScrollModifier: 'shift', // Enable fast scroll with Shift key
      macOptionIsMeta: false,
      macOptionClickForcesSelection: false,
      disableStdin: false, // Keep input enabled
      cursorStyle: 'block',
      // Reduce rendering overhead
      allowProposedApi: false,
      allowTransparency: false
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    const searchAddon = new SearchAddon();
    terminal.loadAddon(searchAddon);

    terminal.open(terminalRef);
    
    // Ensure theme is applied (in case it wasn't applied during construction)
    if (terminal.options.theme !== currentTheme) {
      terminal.options.theme = currentTheme;
    }
    
    terminalInstances.current[sessionId] = terminal;
    fitAddons.current[sessionId] = fitAddon;
    searchAddons.current[sessionId] = searchAddon;
    
    // Enable copy/paste functionality
    terminal.attachCustomKeyEventHandler((event) => {
      // Ctrl+Shift+C - copy selected text
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'c' || event.key === 'C')) {
        const selection = terminal.getSelection();
        if (selection) {
          // Use clipboard API to copy
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(selection).catch(err => {
              console.error('Failed to copy:', err);
            });
          } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = selection;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
              document.execCommand('copy');
            } catch (err) {
              console.error('Failed to copy:', err);
            }
            document.body.removeChild(textArea);
          }
          event.preventDefault();
          return false;
        }
      }
      // Ctrl+V or Ctrl+Shift+V - paste (xterm.js default handles Ctrl+Shift+V, we add Ctrl+V)
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'v' || event.key === 'V')) {
        if (navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText().then(text => {
            if (terminal && !terminal.isDisposed) {
              terminal.paste(text);
            }
          }).catch(err => {
            console.error('Failed to paste:', err);
          });
          event.preventDefault();
          return false;
        }
      }
      // Ctrl+F or Cmd+F - open search bar
      if ((event.ctrlKey || event.metaKey) && (event.key === 'f' || event.key === 'F')) {
        if (activeSessionId === sessionId) {
          setShowSearchBar(true);
          event.preventDefault();
          return false;
        }
      }
      return true;
    });
    
    // Also handle selection changes
    let lastSelection = '';
    terminal.onSelectionChange(() => {
      const selection = terminal.getSelection();
      if (selection && selection !== lastSelection) {
        lastSelection = selection;
      }
    });
    
    // Add context menu (right-click) handler
    const handleContextMenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      // Check if click is inside terminal element or its children
      const clickedElement = event.target;
      if (terminalRef && (terminalRef.contains(clickedElement) || terminalRef === clickedElement)) {
        setContextMenu({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          sessionId: sessionId,
        });
      }
    };
    
    // Add contextmenu event listener to terminal element
    setTimeout(() => {
      if (terminalRef) {
        terminalRef.addEventListener('contextmenu', handleContextMenu);
        
        // Cleanup: Store handler reference for removal
        if (!terminalContextMenuHandlers.current[sessionId]) {
          terminalContextMenuHandlers.current[sessionId] = { handler: handleContextMenu, element: terminalRef };
        }
      }
    }, 100);
    
    // Get session info to determine connection type
    const session = sessionInfo || sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Fit terminal after DOM is ready and then start SSH shell with accurate size
    // Use double requestAnimationFrame to ensure layout is complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const terminalElement = terminalRef;
          terminalElement.offsetHeight; // Force layout recalculation
          fitAddon.fit();
          
          // Start SSH shell after terminal is properly fitted
          if (session.connectionType === 'ssh') {
            // Use a small delay to ensure fit() has taken effect
            setTimeout(async () => {
              try {
                const cols = terminal.cols;
                const rows = terminal.rows;
                if (sshConnections.current[sessionId]) {
                  await sshConnections.current[sessionId].startShell(cols, rows);
                  // Don't write message here - let SSH server's initial prompt come first
                  // The server will send its own prompt after shell starts
                }
              } catch (error) {
                console.error(`Failed to start SSH shell for session ${sessionId}:`, error);
                terminal.write(`Failed to start shell: ${error.message}\r\n`);
              }
            }, 50);
          } else if (session.connectionType === 'serial') {
            // Serial port connection
            terminal.write(`Serial port ${session.serialPort} connected at ${session.baudRate} baud\r\n`);
            terminal.write('Serial terminal ready\r\n');
          }
        } catch (error) {
          console.error(`Error fitting terminal during initialization:`, error);
        }
      });
    });

    // Handle terminal input - optimize for maximum responsiveness
    // Cache handler to avoid recreation on every terminal init
    if (!terminalInputHandlers.current[sessionId]) {
      terminalInputHandlers.current[sessionId] = (data) => {
        // CRITICAL: Send data immediately - highest priority, no blocking
        const connection = sshConnections.current[sessionId];
        if (connection) {
          // Direct write - works for both SSH and Serial connections
          connection.write(data);
        }
        
        // Log synchronously but non-blocking - optimized append
        // Use startTransition to mark logging as low priority
        if (sessionLogs.current[sessionId]?.isLogging) {
          startTransition(() => {
            appendToLog(sessionId, data);
          });
        }
      };
    }
    terminal.onData(terminalInputHandlers.current[sessionId]);
  }, [theme, themes, scrollbackLines, activeSessionId, sessions, sshConnections, sessionLogs, appendToLog, setContextMenu, setShowSearchBar]);

  // Adjust terminal size on window resize and container size changes
  useEffect(() => {
    let resizeObserver;
    
    // Debounce function for window resize (throttle to reduce frequency)
    function throttle(func, wait) {
      let timeout;
      let lastCall = 0;
      return function executedFunction(...args) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;
        
        if (timeSinceLastCall >= wait) {
          lastCall = now;
          func(...args);
        } else {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            lastCall = Date.now();
            func(...args);
          }, wait - timeSinceLastCall);
        }
      };
    }

    // Window resize handler with throttle (100ms)
    const throttledResize = throttle(() => {
      resizeTerminal();
    }, 100);

    // Use ResizeObserver to detect terminal container size changes
    const terminalContainer = document.querySelector('.terminal-content-container');
    if (terminalContainer) {
      resizeObserver = new ResizeObserver((entries) => {
        resizeTerminal();
      });
      
      resizeObserver.observe(terminalContainer);
      
      // Also observe the terminal area for layout changes
      const terminalArea = document.querySelector('.terminal-area');
      if (terminalArea) {
        resizeObserver.observe(terminalArea);
      }
    }

    // Listen to window resize events (throttled)
    window.addEventListener('resize', throttledResize);
    
    return () => {
      window.removeEventListener('resize', throttledResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      // Cancel pending resize animation frame
      if (pendingResizeRef.current !== null) {
        cancelAnimationFrame(pendingResizeRef.current);
        pendingResizeRef.current = null;
      }
    };
  }, [activeSessionId, resizeTerminal]);

  // Use ref to store latest appendToLog function
  const appendToLogRef = useRef(appendToLog);
  useEffect(() => {
    appendToLogRef.current = appendToLog;
  }, [appendToLog]);

  // Handle SSH data events - register only once
  useEffect(() => {
    const handleSshData = (event, { connectionId, data }) => {
      // Build connectionId map on each call to get latest connections
      const connectionIdMap = new Map();
      Object.entries(sshConnections.current).forEach(([sessionId, conn]) => {
        if (conn.connectionId) {
          connectionIdMap.set(conn.connectionId, sessionId);
        }
      });
      
      // Fast O(1) lookup instead of O(n) find
      const sessionId = connectionIdMap.get(connectionId);
      
      if (sessionId && terminalInstances.current[sessionId]) {
        const terminal = terminalInstances.current[sessionId];
        
        // Write to terminal immediately to preserve output order
        // Always write synchronously to maintain correct sequence with server output
        terminal.write(data);
        
        // Log asynchronously without blocking display - use ref to get latest function
        if (sessionLogs.current[sessionId] && sessionLogs.current[sessionId].isLogging) {
          startTransition(() => {
            appendToLogRef.current(sessionId, data);
          });
        }
      }
    };

    const handleSshClose = (event, { connectionId }) => {
      // Build connectionId map on each call to get latest connections
      const connectionIdMap = new Map();
      Object.entries(sshConnections.current).forEach(([sessionId, conn]) => {
        if (conn.connectionId) {
          connectionIdMap.set(conn.connectionId, sessionId);
        }
      });
      
      // Fast O(1) lookup
      const sessionId = connectionIdMap.get(connectionId);
      
      if (sessionId && terminalInstances.current[sessionId]) {
        terminalInstances.current[sessionId].write('\r\nSSH connection closed.\r\n');
      }
    };

    window.electronAPI.onSSHData(handleSshData);
    window.electronAPI.onSSHClose(handleSshClose);

    return () => {
      window.electronAPI.offSSHData(handleSshData);
      window.electronAPI.offSSHClose(handleSshClose);
    };
  }, []); // Empty dependency array - listeners registered only once

  // Handle Serial data events - register only once
  useEffect(() => {
    const handleSerialData = (event, receivedSessionId, data) => {
      if (terminalInstances.current[receivedSessionId]) {
        const terminal = terminalInstances.current[receivedSessionId];
        
        // Write to terminal immediately for better responsiveness
        if (data.length < 1024) {
          terminal.write(data);
        } else {
          requestAnimationFrame(() => {
            terminal.write(data);
          });
        }
        
        // Log asynchronously without blocking display - use ref to get latest function
        if (sessionLogs.current[receivedSessionId]?.isLogging) {
          startTransition(() => {
            appendToLogRef.current(receivedSessionId, data);
          });
        }
      }
    };

    const handleSerialClose = (event, receivedSessionId) => {
      if (terminalInstances.current[receivedSessionId]) {
        terminalInstances.current[receivedSessionId].write('\r\nSerial connection closed.\r\n');
      }
    };

    window.electronAPI.onSerialData(handleSerialData);
    window.electronAPI.onSerialClose(handleSerialClose);

    return () => {
      window.electronAPI.offSerialData(handleSerialData);
      window.electronAPI.offSerialClose(handleSerialClose);
    };
  }, []); // Empty dependency array - listeners registered only once

  return {
    terminalRefs,
    terminalInstances,
    fitAddons,
    searchAddons,
    initializeTerminal,
    resizeTerminal
  };
}

