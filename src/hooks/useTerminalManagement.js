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
  setShowSearchBar,
  setShowAICommandInput,
  showAICommandInput
}) {
  const terminalRefs = useRef({});
  const terminalInstances = useRef({});
  const fitAddons = useRef({});
  const searchAddons = useRef({});
  const terminalInputHandlers = useRef({});
  const terminalContextMenuHandlers = useRef({});
  const pendingResizeRef = useRef(null);
  // Cache connectionId -> sessionId mapping for O(1) lookup
  const connectionIdMapRef = useRef(new Map());

  // Update connectionId map when connections change
  // This function rebuilds the entire map from current sshConnections
  const updateConnectionIdMap = useCallback(() => {
    const map = new Map();
    Object.entries(sshConnections.current).forEach(([sessionId, conn]) => {
      if (conn && conn.connectionId) {
        map.set(conn.connectionId, sessionId);
      }
    });
    connectionIdMapRef.current = map;
  }, []);

  // Sync map whenever sshConnections ref changes
  // This ensures map is always up-to-date with actual connections
  useEffect(() => {
    // Update map when component mounts or when connections might have changed
    // We can't directly watch sshConnections.current, so we update on mount
    // and rely on explicit updates in key places (connect/disconnect)
    updateConnectionIdMap();
  }, [updateConnectionIdMap]);

  // Execute post-processing commands
  const executePostProcessing = useCallback((sessionId, session, connection) => {
    if (!session || !connection) return;
    
    // Check if post-processing is enabled
    if (session.postProcessingEnabled === false) return;
    
    const commands = session.postProcessing || [];
    if (commands.length === 0) return;
    
    // Execute commands sequentially with delay between them
    commands.forEach((cmd, index) => {
      setTimeout(() => {
        if (connection && connection.isConnected) {
          // Convert old format (string) to new format if needed
          const command = typeof cmd === 'string' ? cmd : cmd.command;
          const enabled = typeof cmd === 'string' ? true : (cmd.enabled !== false);
          
          if (enabled && command) {
            connection.write(command + '\r\n');
          }
        }
      }, index * 200); // 200ms delay between commands
    });
  }, []);

  // Terminal resize utility function
  const resizeTerminal = useCallback(() => {
    // Cancel any pending resize to avoid duplicate work
    if (pendingResizeRef.current !== null) {
      cancelAnimationFrame(pendingResizeRef.current);
    }
    
    // Schedule resize for next animation frame (only once per frame)
    pendingResizeRef.current = requestAnimationFrame(() => {
      pendingResizeRef.current = null;
      
      // Resize all active terminals, prioritizing the active one
      // First, resize the active terminal
      if (activeSessionId && fitAddons.current[activeSessionId]) {
        const fitAddon = fitAddons.current[activeSessionId];
        const terminal = terminalInstances.current[activeSessionId];
        const terminalRef = terminalRefs.current[activeSessionId];
        
        if (fitAddon && terminal && terminalRef) {
          try {
            // Check if terminal is visible (not display: none)
            const computedStyle = window.getComputedStyle(terminalRef.parentElement || terminalRef);
            if (computedStyle.display !== 'none') {
              // Force a layout recalculation before fitting
              terminalRef.offsetHeight;
              fitAddon.fit();
              
              // Notify SSH server of terminal size change
              const session = sessions.find(s => s.id === activeSessionId);
              if (session && session.connectionType === 'ssh' && sshConnections.current[activeSessionId]) {
                const cols = terminal.cols;
                const rows = terminal.rows;
                sshConnections.current[activeSessionId].resize(cols, rows);
              }
            }
          } catch (error) {
            console.error(`Error resizing terminal for session ${activeSessionId}:`, error);
          }
        }
      }
      
      // Then resize other terminals (if needed)
      Object.keys(fitAddons.current).forEach(sessionId => {
        if (sessionId === activeSessionId) return; // Already handled above
        
        const fitAddon = fitAddons.current[sessionId];
        const terminal = terminalInstances.current[sessionId];
        const terminalRef = terminalRefs.current[sessionId];
        
        if (fitAddon && terminal && terminalRef) {
          try {
            // Check if terminal is visible (not display: none)
            const computedStyle = window.getComputedStyle(terminalRef.parentElement || terminalRef);
            if (computedStyle.display !== 'none') {
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
            }
          } catch (error) {
            console.error(`Error resizing terminal for session ${sessionId}:`, error);
          }
        }
      });
    });
  }, [sessions, sshConnections, activeSessionId]);

  // Cleanup terminal resources
  const cleanupTerminal = useCallback((sessionId) => {
    // Remove context menu handler
    if (terminalContextMenuHandlers.current[sessionId]) {
      const { handler, element } = terminalContextMenuHandlers.current[sessionId];
      if (element) {
        element.removeEventListener('contextmenu', handler);
      }
      delete terminalContextMenuHandlers.current[sessionId];
    }
    
    // Dispose terminal - this automatically removes all event listeners
    if (terminalInstances.current[sessionId]) {
      terminalInstances.current[sessionId].dispose();
      delete terminalInstances.current[sessionId];
    }
    
    // Clean up input handler
    if (terminalInputHandlers.current[sessionId]) {
      delete terminalInputHandlers.current[sessionId];
    }
    
    // Clean up terminal ref
    if (terminalRefs.current[sessionId]) {
      delete terminalRefs.current[sessionId];
    }
    
    // Clean up connection ID from map if exists
    // Check connectionIdMap for any entries matching this sessionId
    for (const [connectionId, mapSessionId] of connectionIdMapRef.current.entries()) {
      if (mapSessionId === sessionId) {
        connectionIdMapRef.current.delete(connectionId);
        break;
      }
    }
  }, []);

  // Initialize terminal
  const initializeTerminal = useCallback(async (sessionId, sessionInfo = null) => {
    const terminalRef = terminalRefs.current[sessionId];
    if (!terminalRef) return;

    // Clean up existing terminal if it exists
    if (terminalInstances.current[sessionId]) {
      cleanupTerminal(sessionId);
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
      // Ctrl+Shift+A or Cmd+Shift+A - open AI Chat Sidebar
      // Note: This is handled by useKeyboardShortcuts, but we keep it here for terminal-specific handling
      // The terminal handler will be overridden by window-level handler
      // Escape - close AI input if open
      if (event.key === 'Escape' && showAICommandInput && activeSessionId === sessionId) {
        console.log('Terminal: ESC detected, closing AI input');
        if (setShowAICommandInput) {
          setShowAICommandInput(false);
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
                  
                  // Execute post-processing commands after shell is ready
                  executePostProcessing(sessionId, session, sshConnections.current[sessionId]);
                }
              } catch (error) {
                console.error(`Failed to start SSH shell for session ${sessionId}:`, error);
                // Use grey color for error messages
                terminal.write(`\x1b[90mFailed to start shell: ${error.message}\x1b[0m\r\n`);
              }
            }, 50);
          } else if (session.connectionType === 'serial') {
            // Serial port connection - use grey color for status messages
            terminal.write(`\x1b[90mSerial port ${session.serialPort} connected at ${session.baudRate} baud\x1b[0m\r\n`);
            terminal.write('\x1b[90mSerial terminal ready\x1b[0m\r\n');
            
            // Execute post-processing commands after serial connection is ready
            setTimeout(() => {
              executePostProcessing(sessionId, session, sshConnections.current[sessionId]);
            }, 200);
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
    
    // Update connectionId map when terminal is initialized with SSH connection
    // This ensures map includes the connectionId after connection.connect() completes
    if (session.connectionType === 'ssh' && sshConnections.current[sessionId]?.connectionId) {
      updateConnectionIdMap();
    }
  }, [theme, themes, scrollbackLines, activeSessionId, sessions, sshConnections, sessionLogs, appendToLog, setContextMenu, setShowSearchBar, updateConnectionIdMap, cleanupTerminal, showAICommandInput, setShowAICommandInput]);

  // Resize terminal when active session changes (tab switch)
  useEffect(() => {
    if (activeSessionId) {
      // Wait for DOM to update (display: none -> block transition)
      // Use double requestAnimationFrame to ensure layout is complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resizeTerminal();
        });
      });
    }
  }, [activeSessionId, resizeTerminal]);

  // Adjust terminal size on window resize and container size changes
  useEffect(() => {
    let resizeObserver;
    let throttleTimeout = null;
    
    // Debounce function for window resize (throttle to reduce frequency)
    // Returns both the throttled function and a cleanup function
    function throttle(func, wait) {
      let timeout = null;
      let lastCall = 0;
      const throttled = function executedFunction(...args) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;
        
        if (timeSinceLastCall >= wait) {
          lastCall = now;
          func(...args);
        } else {
          if (timeout) {
            clearTimeout(timeout);
          }
          timeout = setTimeout(() => {
            lastCall = Date.now();
            timeout = null;
            func(...args);
          }, wait - timeSinceLastCall);
        }
      };
      
      // Add cleanup method to throttled function
      throttled.cleanup = () => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
      };
      
      return throttled;
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
      // Clean up throttle timeout
      if (throttledResize.cleanup) {
        throttledResize.cleanup();
      }
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
    // Update map initially and when connections change
    updateConnectionIdMap();
    
    const handleSshData = (event, { connectionId, data }) => {
      // Use cached map for O(1) lookup - much faster than building map each time
      const sessionId = connectionIdMapRef.current.get(connectionId);
      
      if (sessionId && terminalInstances.current[sessionId]) {
        const terminal = terminalInstances.current[sessionId];
        
        // Optimized: Split large data chunks to prevent blocking
        // Large synchronous writes can block the UI thread
        if (data.length > 8192) { // 8KB threshold
          // Split into smaller chunks and write asynchronously
          const chunkSize = 4096;
          let offset = 0;
          const writeChunk = () => {
            if (offset < data.length) {
              const chunk = data.slice(offset, offset + chunkSize);
              terminal.write(chunk);
              offset += chunkSize;
              // Use requestAnimationFrame for smooth rendering
              requestAnimationFrame(writeChunk);
            }
          };
          writeChunk();
        } else {
          // Write to terminal immediately for small data to preserve output order
          terminal.write(data);
        }
        
        // Log asynchronously without blocking display - use ref to get latest function
        if (sessionLogs.current[sessionId] && sessionLogs.current[sessionId].isLogging) {
          startTransition(() => {
            appendToLogRef.current(sessionId, data);
          });
        }
      }
    };

    const handleSshClose = (event, { connectionId }) => {
      // Use cached map for O(1) lookup
      const sessionId = connectionIdMapRef.current.get(connectionId);
      
      if (sessionId && terminalInstances.current[sessionId]) {
        // Use grey color for connection status messages
        terminalInstances.current[sessionId].write('\r\n\x1b[90mSSH connection closed.\x1b[0m\r\n');
      }
      
      // Remove from map when connection closes
      // Also rebuild map to ensure consistency (in case of race conditions)
      connectionIdMapRef.current.delete(connectionId);
      // Rebuild map to ensure it's in sync with actual connections
      updateConnectionIdMap();
    };

    window.electronAPI.onSSHData(handleSshData);
    window.electronAPI.onSSHClose(handleSshClose);

    return () => {
      window.electronAPI.offSSHData(handleSshData);
      window.electronAPI.offSSHClose(handleSshClose);
    };
  }, [updateConnectionIdMap]); // Update map when connections change

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
        // Use grey color for connection status messages
        terminalInstances.current[receivedSessionId].write('\r\n\x1b[90mSerial connection closed.\x1b[0m\r\n');
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
    resizeTerminal,
    cleanupTerminal
  };
}

