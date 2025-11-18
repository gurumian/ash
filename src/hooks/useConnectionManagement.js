import { useCallback, useEffect, useRef } from 'react';
import { SSHConnection } from '../connections/SSHConnection';
import { SerialConnection } from '../connections/SerialConnection';

/**
 * Custom hook for managing SSH/Serial connections
 */
export function useConnectionManagement({
  sessions,
  setSessions,
  setActiveSessionId,
  activeSessionId,
  sshConnections,
  terminalInstances,
  fitAddons,
  searchAddons,
  connectionForm,
  setConnectionForm,
  setShowConnectionForm,
  setFormError,
  setIsConnecting,
  saveConnectionHistory,
  connectionHistory,
  groups,
  addSessionToGroup,
  setPendingGroupAdditions,
  initializeTerminal,
  cleanupLog
}) {
  // Create new session with provided data (returns sessionId if successful)
  const createNewSessionWithData = useCallback(async (formData, skipFormReset = false) => {
    setFormError('');
    
    if (formData.connectionType === 'ssh') {
      if (!formData.host || !formData.user) {
        setFormError('Host and Username are required for SSH connections.');
        return;
      }
    } else if (formData.connectionType === 'serial') {
      if (!formData.serialPort) {
        setFormError('Serial port is required for serial connections.');
        return;
      }
    }

    setIsConnecting(true);
    
    try {
      const sessionId = Date.now().toString();
      const sessionName = formData.connectionType === 'ssh' 
        ? (formData.sessionName || `${formData.user}@${formData.host}`)
        : (formData.sessionName || `Serial: ${formData.serialPort}`);
      
      // Create connection based on type
      let connection;
      let session;
      
      if (formData.connectionType === 'ssh') {
        connection = new SSHConnection();
        await connection.connect(
          formData.host,
          formData.port,
          formData.user,
          formData.password
        );
        
        session = {
          id: sessionId,
          name: sessionName,
          host: formData.host,
          port: formData.port,
          user: formData.user,
          password: formData.password, // Include password for detach functionality
          connectionType: 'ssh',
          isConnected: true,
          createdAt: new Date().toISOString()
        };
        
        // Save connection history
        saveConnectionHistory({
          connectionType: 'ssh',
          host: formData.host,
          port: formData.port,
          user: formData.user,
          password: formData.password,
          sessionName: sessionName,
          savePassword: formData.savePassword
        });
      } else if (formData.connectionType === 'serial') {
        connection = new SerialConnection();
        await connection.connect(sessionId, {
          path: formData.serialPort,
          baudRate: parseInt(formData.baudRate),
          dataBits: parseInt(formData.dataBits),
          stopBits: parseInt(formData.stopBits),
          parity: formData.parity,
          flowControl: formData.flowControl
        });
        
        session = {
          id: sessionId,
          name: sessionName,
          serialPort: formData.serialPort,
          baudRate: formData.baudRate,
          dataBits: formData.dataBits,
          stopBits: formData.stopBits,
          parity: formData.parity,
          flowControl: formData.flowControl,
          connectionType: 'serial',
          isConnected: true,
          createdAt: new Date().toISOString()
        };
        
        // Save connection history for Serial connections too
        saveConnectionHistory({
          connectionType: 'serial',
          serialPort: formData.serialPort,
          baudRate: formData.baudRate,
          dataBits: formData.dataBits,
          stopBits: formData.stopBits,
          parity: formData.parity,
          flowControl: formData.flowControl,
          sessionName: sessionName,
          savePassword: false // Serial connections don't have passwords
        });
      }
      
      // Common session setup
      setSessions(prev => [...prev, session]);
      setActiveSessionId(sessionId);
      sshConnections.current[sessionId] = connection; // Store both SSH and Serial connections
      
      // Reset form (unless skipFormReset is true)
      if (!skipFormReset) {
        setConnectionForm({
          connectionType: 'ssh',
          host: '',
          port: '22',
          user: '',
          password: '',
          sessionName: '',
          savePassword: false,
          serialPort: '',
          baudRate: '9600',
          dataBits: '8',
          stopBits: '1',
          parity: 'none',
          flowControl: 'none'
        });
        setShowConnectionForm(false);
      }
      setIsConnecting(false);
      
      return sessionId; // Return sessionId for use in drag-and-drop
      
    } catch (error) {
      console.error('Connection failed:', error);
      setIsConnecting(false);
      if (!skipFormReset) {
        alert('Connection failed: ' + error.message);
      }
      throw error; // Re-throw so caller can handle it
    }
  }, [
    setFormError,
    setIsConnecting,
    setSessions,
    setActiveSessionId,
    setConnectionForm,
    setShowConnectionForm,
    saveConnectionHistory,
    sshConnections
  ]);

  // Disconnect session
  const disconnectSession = useCallback(async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    
    // Use polymorphic disconnect
    if (session && sshConnections.current[sessionId]) {
      sshConnections.current[sessionId].disconnect();
      delete sshConnections.current[sessionId];
    }
    
    if (terminalInstances.current[sessionId]) {
      // Dispose terminal - this automatically removes all event listeners
      terminalInstances.current[sessionId].dispose();
      delete terminalInstances.current[sessionId];
      // terminalInputHandlers cleanup is handled by useTerminalManagement
    }
    
    // Clean up fit addon
    if (fitAddons.current[sessionId]) {
      delete fitAddons.current[sessionId];
    }
    
    // Clean up search addon
    if (searchAddons.current[sessionId]) {
      delete searchAddons.current[sessionId];
    }
    
    // Clean up session logs
    await cleanupLog(sessionId);
    
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    
    if (activeSessionId === sessionId) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      setActiveSessionId(remainingSessions.length > 0 ? remainingSessions[0].id : null);
    }
  }, [
    sessions,
    activeSessionId,
    sshConnections,
    terminalInstances,
    fitAddons,
    searchAddons,
    cleanupLog,
    setSessions,
    setActiveSessionId
  ]);

  // Use ref to store latest sessions for connectGroup
  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Connect all sessions in a group
  const connectGroup = useCallback(async (groupId) => {
    console.log('connectGroup called:', groupId);
    const group = groups.find(g => g.id === groupId);
    if (!group) {
      console.log('Group not found:', groupId);
      return;
    }

    console.log('Group found:', { id: group.id, name: group.name, savedSessions: group.savedSessions });

    // Get all saved sessions (connection info) from the group
    const savedSessions = group.savedSessions || [];
    
    console.log('Saved sessions to connect:', savedSessions.length);
    
    // Helper function to match saved session (with UUID) with active session
    const matchSavedSessionWithActiveSession = (savedSession, session) => {
      const connType = savedSession.connectionType || 'ssh';
      if (connType === 'serial') {
        return session.connectionType === 'serial' && session.serialPort === savedSession.serialPort;
      } else {
        return session.connectionType === 'ssh' &&
               session.host === savedSession.host && 
               session.user === savedSession.user && 
               (session.port || '22') === (savedSession.port || '22');
      }
    };
    
    // Connect each saved session instance
    // Reuse existing sessions if they match, otherwise create new ones
    // Use ref to get latest sessions state
    for (const savedSession of savedSessions) {
      try {
        // Get latest sessions from ref
        const currentSessions = sessionsRef.current;
        // Check if there's an existing session with the same connection info
        const existingSession = currentSessions.find(s => matchSavedSessionWithActiveSession(savedSession, s));
        
        if (existingSession) {
          // Reuse existing session - just reconnect if disconnected
          if (!existingSession.isConnected) {
            // Reconnect disconnected session
            try {
              if (existingSession.connectionType === 'ssh') {
                // Try to get password from connection history
                const historyEntry = connectionHistory.find(c => 
                  c.connectionType === 'ssh' &&
                  c.host === existingSession.host && 
                  c.user === existingSession.user && 
                  (c.port || '22') === (existingSession.port || '22')
                );
                const password = existingSession.password || historyEntry?.password || '';
                
                const connection = new SSHConnection();
                await connection.connect(existingSession.host, existingSession.port, existingSession.user, password);
                await connection.startShell();
                sshConnections.current[existingSession.id] = connection;
                
                // Initialize terminal if not already initialized
                if (!terminalInstances.current[existingSession.id]) {
                  setTimeout(() => {
                    initializeTerminal(existingSession.id, existingSession);
                  }, 100);
                }
                
                setSessions(prev => prev.map(s => 
                  s.id === existingSession.id ? { ...s, isConnected: true } : s
                ));
              } else if (existingSession.connectionType === 'serial') {
                const connection = new SerialConnection();
                await connection.connect(existingSession.id, {
                  path: existingSession.serialPort,
                  baudRate: parseInt(existingSession.baudRate),
                  dataBits: parseInt(existingSession.dataBits || '8'),
                  stopBits: parseInt(existingSession.stopBits || '1'),
                  parity: existingSession.parity || 'none',
                  flowControl: existingSession.flowControl || 'none'
                });
                sshConnections.current[existingSession.id] = connection;
                
                // Initialize terminal if not already initialized
                if (!terminalInstances.current[existingSession.id]) {
                  setTimeout(() => {
                    initializeTerminal(existingSession.id, existingSession);
                  }, 100);
                }
                
                setSessions(prev => prev.map(s => 
                  s.id === existingSession.id ? { ...s, isConnected: true } : s
                ));
              }
            } catch (error) {
              console.error(`Failed to reconnect session ${existingSession.id}:`, error);
              alert(`Failed to reconnect ${existingSession.name}: ${error.message}`);
            }
          }
          // If already connected, do nothing - just reuse the existing session
          console.log('Reusing existing session:', { sessionId: existingSession.id, savedSessionId: savedSession.id, label: savedSession.label });
        } else {
          // No existing session found - create a new one
          // But first check if we should create it or if it already exists in sessions
          // (This prevents duplicate sessions when connecting a group)
          const connectionFormData = {
            connectionType: savedSession.connectionType || 'ssh',
            host: savedSession.host || '',
            port: savedSession.port || '22',
            user: savedSession.user || '',
            password: savedSession.password || '',
            sessionName: savedSession.label || savedSession.sessionName || savedSession.name || '',
            savePassword: !!savedSession.password,
            serialPort: savedSession.serialPort || '',
            baudRate: savedSession.baudRate || '9600',
            dataBits: savedSession.dataBits || '8',
            stopBits: savedSession.stopBits || '1',
            parity: savedSession.parity || 'none',
            flowControl: savedSession.flowControl || 'none'
          };
          
          // Double-check: make sure we don't have a matching session already
          // (This can happen if sessions state hasn't updated yet)
          // Use ref to get latest sessions state
          const currentSessionsForCheck = sessionsRef.current;
          const matchingSession = currentSessionsForCheck.find(s => matchSavedSessionWithActiveSession(savedSession, s));
          if (matchingSession) {
            // Session exists, just reconnect if needed
            if (!matchingSession.isConnected) {
              // Reconnect logic is the same as above
              try {
                if (matchingSession.connectionType === 'ssh') {
                  const historyEntry = connectionHistory.find(c => 
                    c.connectionType === 'ssh' &&
                    c.host === matchingSession.host && 
                    c.user === matchingSession.user && 
                    (c.port || '22') === (matchingSession.port || '22')
                  );
                  const password = matchingSession.password || historyEntry?.password || '';
                  
                  const connection = new SSHConnection();
                  await connection.connect(matchingSession.host, matchingSession.port, matchingSession.user, password);
                  await connection.startShell();
                  sshConnections.current[matchingSession.id] = connection;
                  
                  if (!terminalInstances.current[matchingSession.id]) {
                    setTimeout(() => {
                      initializeTerminal(matchingSession.id, matchingSession);
                    }, 100);
                  }
                  
                  setSessions(prev => prev.map(s => 
                    s.id === matchingSession.id ? { ...s, isConnected: true } : s
                  ));
                } else if (matchingSession.connectionType === 'serial') {
                  const connection = new SerialConnection();
                  await connection.connect(matchingSession.id, {
                    path: matchingSession.serialPort,
                    baudRate: parseInt(matchingSession.baudRate),
                    dataBits: parseInt(matchingSession.dataBits || '8'),
                    stopBits: parseInt(matchingSession.stopBits || '1'),
                    parity: matchingSession.parity || 'none',
                    flowControl: matchingSession.flowControl || 'none'
                  });
                  sshConnections.current[matchingSession.id] = connection;
                  
                  if (!terminalInstances.current[matchingSession.id]) {
                    setTimeout(() => {
                      initializeTerminal(matchingSession.id, matchingSession);
                    }, 100);
                  }
                  
                  setSessions(prev => prev.map(s => 
                    s.id === matchingSession.id ? { ...s, isConnected: true } : s
                  ));
                }
              } catch (error) {
                console.error(`Failed to reconnect session ${matchingSession.id}:`, error);
                alert(`Failed to reconnect ${matchingSession.name}: ${error.message}`);
              }
            }
            console.log('Reusing existing session (found in double-check):', { sessionId: matchingSession.id, savedSessionId: savedSession.id, label: savedSession.label });
          } else {
            // Really no existing session - create a new one
            const sessionId = await createNewSessionWithData(connectionFormData, true);
            
            if (sessionId) {
              console.log('Created new session from savedSession:', { sessionId, savedSessionId: savedSession.id, label: savedSession.label });
            }
          }
        }
      } catch (error) {
        console.error(`Failed to connect saved session instance in group:`, error);
      }
    }
  }, [
    groups,
    sessions,
    connectionHistory,
    sshConnections,
    terminalInstances,
    createNewSessionWithData,
    initializeTerminal,
    setSessions
  ]);

  // Detach tab to new window
  const handleDetachTab = useCallback(async (sessionId) => {
    try {
      const result = await window.electronAPI.detachTab(sessionId);
      if (result.success) {
        // Session will be removed via IPC event
        console.log(`Tab ${sessionId} detached to new window`);
      } else {
        alert('Failed to detach tab: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to detach tab:', error);
      alert('Failed to detach tab: ' + error.message);
    }
  }, []);

  // Use refs to store latest values - prevents re-registration of listeners
  const connectionHistoryRef = useRef(connectionHistory);
  const initializeTerminalRef = useRef(initializeTerminal);

  // Update refs when values change
  useEffect(() => {
    connectionHistoryRef.current = connectionHistory;
  }, [connectionHistory]);

  useEffect(() => {
    initializeTerminalRef.current = initializeTerminal;
  }, [initializeTerminal]);

  // Handle detached session events - register only once
  useEffect(() => {
    // Listen for session to be removed (when detached)
    const handleRemoveDetachedSession = (sessionId) => {
      console.log('Removing detached session:', sessionId);
      
      // Use functional updates to avoid stale closure issues
      setSessions(prev => {
        const session = prev.find(s => s.id === sessionId);
        
        // Disconnect the connection in the original window
        // (new window will reconnect automatically)
        if (session && sshConnections.current[sessionId]) {
          sshConnections.current[sessionId].disconnect();
          delete sshConnections.current[sessionId];
        }
        
        // Clean up local references
        if (terminalInstances.current[sessionId]) {
          terminalInstances.current[sessionId].dispose();
          delete terminalInstances.current[sessionId];
        }
        if (fitAddons.current[sessionId]) {
          delete fitAddons.current[sessionId];
        }
        if (searchAddons.current[sessionId]) {
          delete searchAddons.current[sessionId];
        }
        
        // Remove from sessions list
        const remainingSessions = prev.filter(s => s.id !== sessionId);
        
        // Update active session if needed
        setActiveSessionId(currentActiveId => {
          if (currentActiveId === sessionId) {
            return remainingSessions.length > 0 ? remainingSessions[0].id : null;
          }
          return currentActiveId;
        });
        
        return remainingSessions;
      });
    };

    // Listen for detached session data (when receiving in new window)
    const handleDetachedSession = async (sessionData) => {
      try {
        const session = JSON.parse(sessionData);
        console.log('Received detached session:', session);
        
        // Mark as disconnected since connection objects can't be transferred
        const newSession = { ...session, isConnected: false };
        
        // Add session to this window
        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(newSession.id);
        
        // Try to reconnect automatically if it was connected
        if (session.isConnected) {
          // Small delay to ensure terminal is initialized
          setTimeout(async () => {
            try {
              if (newSession.connectionType === 'ssh') {
                // Get password from connection history if not in session - use ref to get latest
                let password = newSession.password;
                if (!password && connectionHistoryRef.current) {
                  const historyEntry = connectionHistoryRef.current.find(c => 
                    c.connectionType === 'ssh' &&
                    c.host === newSession.host && 
                    c.user === newSession.user && 
                    (c.port || '22') === (newSession.port || '22')
                  );
                  password = historyEntry?.password || '';
                }
                
                if (!password) {
                  console.warn('No password available for reconnection, marking as disconnected');
                  setSessions(prev => prev.map(s => 
                    s.id === newSession.id ? { ...s, isConnected: false } : s
                  ));
                  return;
                }
                
                const connection = new SSHConnection();
                await connection.connect(newSession.host, newSession.port, newSession.user, password);
                sshConnections.current[newSession.id] = connection;
                await connection.startShell();
                
                setSessions(prev => prev.map(s => 
                  s.id === newSession.id ? { ...s, isConnected: true } : s
                ));
                
                // Initialize terminal - use ref to get latest function
                setTimeout(() => {
                  initializeTerminalRef.current(newSession.id, newSession);
                }, 100);
              } else if (newSession.connectionType === 'serial') {
                // Serial reconnection would go here
                setSessions(prev => prev.map(s => 
                  s.id === newSession.id ? { ...s, isConnected: false } : s
                ));
              }
            } catch (error) {
              console.error('Failed to reconnect detached session:', error);
              setSessions(prev => prev.map(s => 
                s.id === newSession.id ? { ...s, isConnected: false } : s
              ));
            }
          }, 500);
        }
      } catch (error) {
        console.error('Failed to parse detached session:', error);
      }
    };

    window.electronAPI.onRemoveDetachedSession(handleRemoveDetachedSession);
    window.electronAPI.onDetachedSession(handleDetachedSession);

    return () => {
      window.electronAPI.offRemoveDetachedSession(handleRemoveDetachedSession);
      window.electronAPI.offDetachedSession(handleDetachedSession);
    };
  }, []); // Empty dependency array - listeners registered only once

  return {
    createNewSessionWithData,
    disconnectSession,
    connectGroup,
    handleDetachTab
  };
}

