import { useCallback, useEffect, useRef } from 'react';
import { SSHConnection } from '../connections/SSHConnection';
import { TelnetConnection } from '../connections/TelnetConnection';
import { SerialConnection } from '../connections/SerialConnection';
import { matchSavedSessionWithActiveSession } from '../utils/sessionMatcher';

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
  cleanupLog,
  cleanupTerminal,
  setErrorDialog,
  reconnectRetry
}) {
  // Helper function to format connection errors
  const formatConnectionError = useCallback((error) => {
    const errorMessage = error.message || String(error);
    const errorCode = error.code || '';
    
    let title = 'Connection Failed';
    let message = 'Failed to establish connection';
    let detail = errorMessage;
    
    // Parse common SSH error codes
    if (errorCode === 'EHOSTUNREACH' || errorMessage.includes('EHOSTUNREACH')) {
      title = 'Host Unreachable';
      message = 'Cannot reach the target host';
      const match = errorMessage.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
      const host = match ? match[1] : (error.address || 'target host');
      const port = match ? match[2] : (error.port || '22');
      detail = `The host ${host}:${port} is not reachable.\n\nPossible causes:\n- Host is down or unreachable\n- Network connectivity issues\n- Firewall blocking the connection\n- Incorrect host address`;
    } else if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
      title = 'Connection Refused';
      message = 'The connection was refused';
      const match = errorMessage.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
      const host = match ? match[1] : (error.address || 'target host');
      const port = match ? match[2] : (error.port || '22');
      detail = `Connection to ${host}:${port} was refused.\n\nPossible causes:\n- SSH service is not running on the target\n- Port ${port} is not open\n- Firewall is blocking the connection`;
    } else if (errorCode === 'ETIMEDOUT' || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
      title = 'Connection Timeout';
      message = 'Connection attempt timed out';
      detail = `The connection attempt timed out.\n\nPossible causes:\n- Network is slow or unstable\n- Host is not responding\n- Firewall is blocking the connection`;
    } else if (errorCode === 'ENOTFOUND' || errorMessage.includes('ENOTFOUND')) {
      title = 'Host Not Found';
      message = 'Hostname could not be resolved';
      detail = `The hostname could not be resolved to an IP address.\n\nPossible causes:\n- Incorrect hostname or domain name\n- DNS server issues\n- Network connectivity problems`;
    } else if (errorMessage.includes('authentication') || errorMessage.includes('password') || errorMessage.includes('Permission denied')) {
      title = 'Authentication Failed';
      message = 'Invalid credentials';
      detail = `Authentication failed.\n\nPlease check:\n- Username is correct\n- Password is correct\n- User has SSH access permissions`;
    }
    
    return { title, message, detail };
  }, []);

  // Create new session with provided data (returns sessionId if successful)
  const createNewSessionWithData = useCallback(async (formData, skipFormReset = false) => {
    setFormError('');
    
    if (formData.connectionType === 'ssh') {
      // Check if using telnet
      const useTelnet = formData.useTelnet || false;
      
      if (useTelnet) {
        // Telnet connection - only host and port required
        if (!formData.host) {
          setFormError('Host is required for Telnet connections.');
          return;
        }
      } else {
        // SSH connection - host and username required
        if (!formData.host || !formData.user) {
          setFormError('Host and Username are required for SSH connections.');
          return;
        }
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
      let sessionName;
      if (formData.connectionType === 'ssh') {
        const useTelnet = formData.useTelnet || false;
        if (useTelnet) {
          sessionName = formData.sessionName || `Telnet: ${formData.host}:${formData.port || '23'}`;
        } else {
          sessionName = formData.sessionName || `${formData.user}@${formData.host}`;
        }
      } else {
        sessionName = formData.sessionName || `Serial: ${formData.serialPort}`;
      }
      
      // Create connection based on type
      let connection;
      let session;
      
      if (formData.connectionType === 'ssh') {
        const useTelnet = formData.useTelnet || false;
        
        if (useTelnet) {
          // Telnet connection
          connection = new TelnetConnection();
          await connection.connect(
            formData.host,
            formData.port || '23'
          );
          
          session = {
            id: sessionId,
            name: sessionName,
            host: formData.host,
            port: formData.port || '23',
            connectionType: 'telnet',
            isConnected: true,
            createdAt: new Date().toISOString(),
            postProcessing: formData.postProcessing || [],
            postProcessingEnabled: formData.postProcessingEnabled !== false
          };
          
          // Save connection history
          saveConnectionHistory({
            connectionType: 'telnet',
            host: formData.host,
            port: formData.port || '23',
            sessionName: sessionName,
            savePassword: false, // Telnet doesn't use passwords
            postProcessing: formData.postProcessing || [],
            postProcessingEnabled: formData.postProcessingEnabled !== false
          });
        } else {
          // SSH connection
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
            createdAt: new Date().toISOString(),
            postProcessing: formData.postProcessing || [],
            postProcessingEnabled: formData.postProcessingEnabled !== false
          };
          
          // Save connection history
          saveConnectionHistory({
            connectionType: 'ssh',
            host: formData.host,
            port: formData.port,
            user: formData.user,
            password: formData.password,
            sessionName: sessionName,
            savePassword: formData.savePassword,
            postProcessing: formData.postProcessing || [],
            postProcessingEnabled: formData.postProcessingEnabled !== false
          });
        }
        
        // Store connection in sshConnections (works for both SSH and Telnet)
        sshConnections.current[sessionId] = connection;
        
        // Complete session setup (SSH or Telnet)
        if (useTelnet) {
          await completeTelnetSessionSetup(session, connection);
        } else {
          await completeSSHSessionSetup(session, connection);
        }
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
          createdAt: new Date().toISOString(),
          postProcessing: formData.postProcessing || [],
          postProcessingEnabled: formData.postProcessingEnabled !== false
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
          savePassword: false, // Serial connections don't have passwords
          postProcessing: formData.postProcessing || [],
          postProcessingEnabled: formData.postProcessingEnabled !== false
        });
      }
      
      // Common session setup
      setSessions(prev => [...prev, session]);
      setActiveSessionId(sessionId);
      // Connection already stored above before completeTelnetSessionSetup/completeSSHSessionSetup
      
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
          useTelnet: false,
          serialPort: '',
          baudRate: '9600',
          dataBits: '8',
          stopBits: '1',
          parity: 'none',
          flowControl: 'none',
          postProcessing: [],
          postProcessingEnabled: true
        });
        setShowConnectionForm(false);
      }
      setIsConnecting(false);
      
      return sessionId; // Return sessionId for use in drag-and-drop
      
    } catch (error) {
      console.error('Connection failed:', error);
      setIsConnecting(false);
      if (!skipFormReset && setErrorDialog) {
        const formattedError = formatConnectionError(error);
        setErrorDialog({
          isOpen: true,
          title: formattedError.title,
          message: formattedError.message,
          detail: formattedError.detail,
          error: error // Pass the original error object
        });
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
    sshConnections,
    cleanupTerminal,
    setErrorDialog,
    formatConnectionError
  ]);

  // Disconnect session
  const disconnectSession = useCallback(async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    
    // Clean up terminal resources first (including refs and handlers)
    if (cleanupTerminal) {
      cleanupTerminal(sessionId);
    }
    
    // Use polymorphic disconnect
    if (session && sshConnections.current[sessionId]) {
      sshConnections.current[sessionId].disconnect();
      delete sshConnections.current[sessionId];
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
    cleanupTerminal,
    setSessions,
    setActiveSessionId
  ]);

  // Use ref to store latest sessions for connectGroup
  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Helper: Find password from connection history
  const findPasswordFromHistory = useCallback((session) => {
    if (session.connectionType === 'ssh') {
      const historyEntry = connectionHistory.find(c => 
        c.connectionType === 'ssh' &&
        c.host === session.host && 
        c.user === session.user && 
        (c.port || '22') === (session.port || '22')
      );
      return session.password || historyEntry?.password || '';
    }
    return '';
  }, [connectionHistory]);

  // Helper: Execute post-processing commands
  const executePostProcessing = useCallback((connection, sessionId) => {
    setTimeout(() => {
      const updatedSession = sessionsRef.current.find(s => s.id === sessionId);
      if (updatedSession && updatedSession.postProcessingEnabled !== false) {
        const commands = updatedSession.postProcessing || [];
        commands.forEach((cmd, index) => {
          setTimeout(() => {
            if (connection && connection.isConnected) {
              const command = typeof cmd === 'string' ? cmd : cmd.command;
              const enabled = typeof cmd === 'string' ? true : (cmd.enabled !== false);
              if (enabled && command) {
                connection.write(command + '\r\n');
              }
            }
          }, index * 200);
        });
      }
    }, 500);
  }, []);

  // Helper: Complete SSH/Telnet session setup after successful connection
  const completeSSHSessionSetup = useCallback(async (session, connection) => {
    // Initialize terminal if not already initialized
    if (!terminalInstances.current[session.id]) {
      setTimeout(() => {
        initializeTerminal(session.id, session);
      }, 100);
    } else {
      // Terminal already exists, start shell with current terminal size
      const terminal = terminalInstances.current[session.id];
      await connection.startShell(terminal.cols, terminal.rows);
      executePostProcessing(connection, session.id);
    }

    setSessions(prev => prev.map(s => 
      s.id === session.id ? { ...s, isConnected: true } : s
    ));
  }, [initializeTerminal, executePostProcessing, setSessions, terminalInstances]);

  // Helper: Complete Telnet session setup after successful connection
  const completeTelnetSessionSetup = useCallback(async (session, connection) => {
    // Initialize terminal if not already initialized
    if (!terminalInstances.current[session.id]) {
      setTimeout(() => {
        initializeTerminal(session.id, session);
      }, 100);
    } else {
      // Terminal already exists, telnet is ready immediately (no shell start needed)
      executePostProcessing(connection, session.id);
    }

    setSessions(prev => prev.map(s => 
      s.id === session.id ? { ...s, isConnected: true } : s
    ));
    
    // Note: updateConnectionIdMap will be called in initializeTerminal
    // But we also ensure it's updated here after connection is stored
    console.log(`[TELNET-DEBUG] Telnet session setup complete for ${session.id}, connectionId: ${connection.connectionId}`);
  }, [initializeTerminal, executePostProcessing, setSessions, terminalInstances]);

  // Helper: Reconnect SSH session with retry
  const reconnectSSHSession = useCallback(async (session) => {
    // Disconnect old connection if it exists
    if (sshConnections.current[session.id]) {
      try {
        sshConnections.current[session.id].disconnect();
      } catch (error) {
        // Ignore errors when disconnecting old connection
        console.log('Error disconnecting old SSH connection:', error);
      }
      delete sshConnections.current[session.id];
    }
    
    const password = findPasswordFromHistory(session);
    const retryEnabled = reconnectRetry?.enabled !== false;
    const retryInterval = reconnectRetry?.interval || 1000;
    const maxAttempts = reconnectRetry?.maxAttempts || 60;
    
    // Get terminal instance for status messages
    const terminal = terminalInstances.current[session.id];
    
    let connection = null;
    
    if (!retryEnabled) {
      // No retry - single attempt
      connection = new SSHConnection();
      await connection.connect(session.host, session.port, session.user, password);
      sshConnections.current[session.id] = connection;
    } else {
      // Retry logic
      let lastError = null;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Update terminal with attempt status
        if (terminal) {
          // Clear previous attempt line and show new one
          terminal.write(`\r\x1b[K\x1b[90mAttempting ${attempt}/${maxAttempts}...\x1b[0m`);
        }
        
        try {
          connection = new SSHConnection();
          await connection.connect(session.host, session.port, session.user, password);
          sshConnections.current[session.id] = connection;
          
          // Success - clear attempt message
          if (terminal) {
            terminal.write(`\r\x1b[K\x1b[90mConnected successfully.\x1b[0m\r\n`);
          }
          break; // Exit retry loop on success
        } catch (error) {
          lastError = error;
          console.log(`SSH reconnection attempt ${attempt}/${maxAttempts} failed:`, error.message);
          
          if (attempt < maxAttempts) {
            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, retryInterval));
          } else {
            // All attempts failed
            if (terminal) {
              terminal.write(`\r\x1b[K\x1b[90mDisconnected. Max retry attempts (${maxAttempts}) reached.\x1b[0m\r\n`);
            }
            throw lastError || new Error(`SSH reconnection failed after ${maxAttempts} attempts`);
          }
        }
      }
    }
    
    // Complete session setup after successful connection
    if (connection) {
      await completeSSHSessionSetup(session, connection);
    }
  }, [findPasswordFromHistory, reconnectRetry, terminalInstances, completeSSHSessionSetup]);

  // Helper: Reconnect Telnet session with retry
  const reconnectTelnetSession = useCallback(async (session) => {
    // Disconnect old connection if it exists
    if (sshConnections.current[session.id]) {
      try {
        sshConnections.current[session.id].disconnect();
      } catch (error) {
        // Ignore errors when disconnecting old connection
        console.log('Error disconnecting old Telnet connection:', error);
      }
      delete sshConnections.current[session.id];
    }
    
    const retryEnabled = reconnectRetry?.enabled !== false;
    const retryInterval = reconnectRetry?.interval || 1000;
    const maxAttempts = reconnectRetry?.maxAttempts || 60;
    
    // Get terminal instance for status messages
    const terminal = terminalInstances.current[session.id];
    
    let connection = null;
    
    if (!retryEnabled) {
      // No retry - single attempt
      connection = new TelnetConnection();
      await connection.connect(session.host, session.port || '23');
      sshConnections.current[session.id] = connection;
    } else {
      // Retry logic
      let lastError = null;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Update terminal with attempt status
        if (terminal) {
          // Clear previous attempt line and show new one
          terminal.write(`\r\x1b[K\x1b[90mAttempting ${attempt}/${maxAttempts}...\x1b[0m`);
        }
        
        try {
          connection = new TelnetConnection();
          await connection.connect(session.host, session.port || '23');
          sshConnections.current[session.id] = connection;
          
          // Success - clear attempt message
          if (terminal) {
            terminal.write(`\r\x1b[K\x1b[90mConnected successfully.\x1b[0m\r\n`);
          }
          break; // Exit retry loop on success
        } catch (error) {
          lastError = error;
          console.log(`Telnet reconnection attempt ${attempt}/${maxAttempts} failed:`, error.message);
          
          if (attempt < maxAttempts) {
            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, retryInterval));
          } else {
            // All attempts failed
            if (terminal) {
              terminal.write(`\r\x1b[K\x1b[90mDisconnected. Max retry attempts (${maxAttempts}) reached.\x1b[0m\r\n`);
            }
            throw lastError || new Error(`Telnet reconnection failed after ${maxAttempts} attempts`);
          }
        }
      }
    }
    
    // Complete session setup after successful connection
    if (connection) {
      await completeTelnetSessionSetup(session, connection);
    }
  }, [reconnectRetry, terminalInstances, completeTelnetSessionSetup]);

  // Helper: Reconnect Serial session
  const reconnectSerialSession = useCallback(async (session) => {
    const connection = new SerialConnection();
    await connection.connect(session.id, {
      path: session.serialPort,
      baudRate: parseInt(session.baudRate),
      dataBits: parseInt(session.dataBits || '8'),
      stopBits: parseInt(session.stopBits || '1'),
      parity: session.parity || 'none',
      flowControl: session.flowControl || 'none'
    });
    sshConnections.current[session.id] = connection;

    // Initialize terminal if not already initialized
    if (!terminalInstances.current[session.id]) {
      setTimeout(() => {
        initializeTerminal(session.id, session);
      }, 100);
    } else {
      // Terminal already exists, execute post-processing after connection
      setTimeout(() => {
        executePostProcessing(connection, session.id);
      }, 300);
    }

    setSessions(prev => prev.map(s => 
      s.id === session.id ? { ...s, isConnected: true } : s
    ));
  }, [initializeTerminal, executePostProcessing, setSessions]);

  // Helper: Reconnect session (type-agnostic)
  const reconnectSession = useCallback(async (session) => {
    try {
      if (session.connectionType === 'ssh') {
        await reconnectSSHSession(session);
      } else if (session.connectionType === 'telnet') {
        await reconnectTelnetSession(session);
      } else if (session.connectionType === 'serial') {
        await reconnectSerialSession(session);
      }
    } catch (error) {
      console.error(`Failed to reconnect session ${session.id}:`, error);
      
      // Show error dialog for max retry attempts reached
      const isMaxRetriesReached = error.message?.includes('Max retry attempts') || error.message?.includes('after');
      if (setErrorDialog && isMaxRetriesReached) {
        const formattedError = formatConnectionError(error);
        setErrorDialog({
          isOpen: true,
          title: 'Reconnection Failed',
          message: `Failed to reconnect after maximum retry attempts`,
          detail: `Unable to reconnect to ${session.name}.\n\n${formattedError.detail || error.message}`,
          error: error
        });
      } else if (setErrorDialog) {
        const formattedError = formatConnectionError(error);
        setErrorDialog({
          isOpen: true,
          title: formattedError.title,
          message: formattedError.message,
          detail: formattedError.detail,
          error: error
        });
      } else {
        alert(`Failed to reconnect ${session.name}: ${error.message}`);
      }
      throw error; // Re-throw to let caller handle it
    }
  }, [reconnectSSHSession, reconnectTelnetSession, reconnectSerialSession, formatConnectionError, setErrorDialog]);

  // Helper: Prepare connection form data from saved session
  const prepareConnectionFormData = useCallback((savedSession) => {
    const isTelnet = savedSession.connectionType === 'telnet';
    return {
      connectionType: isTelnet ? 'ssh' : (savedSession.connectionType || 'ssh'), // Telnet uses ssh form with checkbox
      useTelnet: isTelnet, // Set checkbox for telnet connections
      host: savedSession.host || '',
      port: savedSession.port || (isTelnet ? '23' : '22'),
      user: savedSession.user || '',
      password: savedSession.password || '',
      sessionName: savedSession.label || savedSession.sessionName || savedSession.name || '',
      savePassword: !!savedSession.password,
      serialPort: savedSession.serialPort || '',
      baudRate: savedSession.baudRate || '9600',
      dataBits: savedSession.dataBits || '8',
      stopBits: savedSession.stopBits || '1',
      parity: savedSession.parity || 'none',
      flowControl: savedSession.flowControl || 'none',
      postProcessing: savedSession.postProcessing || [],
      postProcessingEnabled: savedSession.postProcessingEnabled !== false
    };
  }, []);

  // Connect all sessions in a group
  const connectGroup = useCallback(async (groupId) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('connectGroup called:', groupId);
    }
    const group = groups.find(g => g.id === groupId);
    if (!group) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Group not found:', groupId);
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Group found:', { id: group.id, name: group.name, savedSessions: group.savedSessions });
    }

    // Get all saved sessions (connection info) from the group
    const savedSessions = group.savedSessions || [];
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Saved sessions to connect:', savedSessions.length);
    }
    
    // Connect each saved session instance
    // Each savedSession is an independent instance - always create a new session
    // This allows multiple sessions with the same connection info (duplicate sessions)
    // Group opening is a batch action: open each savedSession one by one
    for (const savedSession of savedSessions) {
      try {
        // Always create a new session for each savedSession instance
        // This ensures that even if multiple savedSessions have the same connection info,
        // each one will open as a separate session (allowing duplicates)
        const connectionFormData = prepareConnectionFormData(savedSession);
        const sessionId = await createNewSessionWithData(connectionFormData, true);
        
        if (process.env.NODE_ENV === 'development' && sessionId) {
          console.log('Created new session from savedSession:', { sessionId, savedSessionId: savedSession.id, label: savedSession.label });
        }
      } catch (error) {
        console.error(`Failed to connect saved session instance in group:`, error);
      }
    }
  }, [
    groups,
    prepareConnectionFormData,
    createNewSessionWithData
  ]);

  // Detach tab to new window
  const handleDetachTab = useCallback(async (sessionId) => {
    try {
      const result = await window.electronAPI.detachTab(sessionId);
      if (result.success) {
        // Session will be removed via IPC event
        if (process.env.NODE_ENV === 'development') {
          console.log(`Tab ${sessionId} detached to new window`);
        }
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
      if (process.env.NODE_ENV === 'development') {
        console.log('Removing detached session:', sessionId);
      }
      
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
        if (cleanupTerminal) {
          cleanupTerminal(sessionId);
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
        if (process.env.NODE_ENV === 'development') {
          console.log('Received detached session:', session);
        }
        
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
                
                setSessions(prev => prev.map(s => 
                  s.id === newSession.id ? { ...s, isConnected: true } : s
                ));
                
                // Initialize terminal - use ref to get latest function
                // Terminal initialization will start the SSH shell with correct size
                setTimeout(() => {
                  initializeTerminalRef.current(newSession.id, newSession);
                }, 100);
              } else if (newSession.connectionType === 'telnet') {
                // Telnet reconnection
                const connection = new TelnetConnection();
                await connection.connect(newSession.host, newSession.port || '23');
                sshConnections.current[newSession.id] = connection;
                
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
  }, [cleanupTerminal]); // Include cleanupTerminal in dependencies

  return {
    createNewSessionWithData,
    disconnectSession,
    connectGroup,
    handleDetachTab,
    reconnectSession
  };
}

