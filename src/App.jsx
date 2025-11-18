import React, { useState, useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import './App.css';

import { FitAddon } from '@xterm/addon-fit';
import { SSHConnection } from './connections/SSHConnection';
import { SerialConnection } from './connections/SerialConnection';
import { useTheme } from './hooks/useTheme';
import { useConnectionHistory } from './hooks/useConnectionHistory';
import { useLogging } from './hooks/useLogging';
import { useGroups } from './hooks/useGroups';

function App() {
  // Session management state
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  
  // Terminal-related refs
  const terminalRefs = useRef({});
  const terminalInstances = useRef({});
  const fitAddons = useRef({});
  const sshConnections = useRef({});
  
  // Use custom hooks
  const {
    groups,
    setGroups,
    saveGroups,
    cleanupOrphanedSessions,
    editingGroupId,
    editingGroupName,
    setEditingGroupName,
    createGroup,
    createGroupWithName,
    deleteGroup,
    toggleGroupExpanded,
    startEditingGroupName,
    saveGroupName,
    cancelEditingGroupName,
    addSessionToGroup: addSessionToGroupHook,
    addSavedSessionToGroup,
    removeSessionFromGroup
  } = useGroups();
  
  // Wrapper for addSessionToGroup to find session
  const addSessionToGroup = (sessionId, groupId) => {
    const session = sessions.find(s => s.id === sessionId);
    addSessionToGroupHook(sessionId, groupId, session);
  };
  
  // Clean up orphaned sessionIds when sessions change
  useEffect(() => {
    cleanupOrphanedSessions(sessions);
  }, [sessions, cleanupOrphanedSessions]);
  const [draggedSessionId, setDraggedSessionId] = useState(null);
  const [dragOverGroupId, setDragOverGroupId] = useState(null);
  const [showGroupNameDialog, setShowGroupNameDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [pendingSessionForGroup, setPendingSessionForGroup] = useState(null);
  
  // Wrapper for createGroupWithName to handle sessionId
  const createGroupWithSession = (name, sessionId = null) => {
    const newGroupId = createGroupWithName(name);
    if (sessionId) {
      setTimeout(() => {
        addSessionToGroup(sessionId, newGroupId);
      }, 100);
    }
    return newGroupId;
  };
  const [formError, setFormError] = useState('');
  const [pendingGroupAdditions, setPendingGroupAdditions] = useState([]); // [{ sessionId, groupId }]
  const [connectionForm, setConnectionForm] = useState({
    connectionType: 'ssh', // 'ssh' or 'serial'
    host: '',
    port: '22',
    user: '',
    password: '',
    sessionName: '',
    savePassword: false,
    // Serial port specific fields
    serialPort: '',
    baudRate: '9600',
    dataBits: '8',
    stopBits: '1',
    parity: 'none',
    flowControl: 'none'
  });
  const [availableSerialPorts, setAvailableSerialPorts] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [showSessionManager, setShowSessionManager] = useState(true);
  const [sessionManagerWidth, setSessionManagerWidth] = useState(250);
  
  // Window controls state (Windows/Linux only)
  const [isMaximized, setIsMaximized] = useState(false);
  const isWindows = window.electronAPI?.platform !== 'darwin';

  // Use custom hooks
  const { theme, setTheme: changeTheme, currentTheme, themes } = useTheme(terminalInstances);
  const { connectionHistory, favorites, saveConnectionHistory, toggleFavorite } = useConnectionHistory();
  const { sessionLogs, logStates, appendToLog, startLogging, stopLogging, saveLog, clearLog, cleanupLog } = useLogging(sessions, groups);
  
  const [showSettings, setShowSettings] = useState(false);
  const [scrollbackLines, setScrollbackLines] = useState(() => {
    const saved = localStorage.getItem('ash-scrollback');
    return saved ? parseInt(saved, 10) : 5000;
  });

  // Resize handle refs
  const resizeHandleRef = useRef(null);
  const isResizing = useRef(false);
  const isInitialGroupsLoad = useRef(true);

  // Connection history and favorites
  // Connection history and favorites are managed by useConnectionHistory hook

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setConnectionForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Load available serial ports
  const loadSerialPorts = async () => {
    try {
      const ports = await window.electronAPI.serialListPorts();
      setAvailableSerialPorts(ports);
      
      // Add some test ports for development
      const testPorts = [
        '/tmp/vserial0',
        '/tmp/vserial1',
        '/dev/tty.debug-console',
        '/dev/cu.debug-console'
      ];
      
      // Add test ports if they don't already exist
      const allPorts = [...ports];
      testPorts.forEach(testPort => {
        if (!allPorts.find(p => p.path === testPort)) {
          allPorts.push({ path: testPort, manufacturer: 'Test', serialNumber: 'TEST' });
        }
      });
      
      setAvailableSerialPorts(allPorts);
    } catch (error) {
      console.error('Failed to load serial ports:', error);
      // Still add test ports even if real ports fail
      setAvailableSerialPorts([
        { path: '/tmp/vserial0', manufacturer: 'Test', serialNumber: 'TEST' },
        { path: '/tmp/vserial1', manufacturer: 'Test', serialNumber: 'TEST' },
        { path: '/dev/tty.debug-console', manufacturer: 'Test', serialNumber: 'TEST' },
        { path: '/dev/cu.debug-console', manufacturer: 'Test', serialNumber: 'TEST' }
      ]);
    }
  };

  // Terminal resize utility function
  const resizeTerminal = () => {
    if (activeSessionId && fitAddons.current[activeSessionId]) {
      fitAddons.current[activeSessionId].fit();
    }
  };

  // Log management functions are provided by useLogging hook

  // Resize handlers
  const handleMouseDown = (e) => {
    if (!showSessionManager) return;
    isResizing.current = true;
    e.preventDefault();
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isResizing.current) return;
    const newWidth = Math.max(150, Math.min(400, e.clientX));
    setSessionManagerWidth(newWidth);
    
    // Resize terminal when session manager width changes
    setTimeout(resizeTerminal, 10);
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Create new session with provided data (returns sessionId if successful)
  const createNewSessionWithData = async (formData, skipFormReset = false) => {
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
        await connection.connect({
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
  };

  // Create new session (returns sessionId if successful) - uses connectionForm state
  const createNewSession = async (skipFormReset = false) => {
    return createNewSessionWithData(connectionForm, skipFormReset);
  };

  // Initialize terminal
  const initializeTerminal = async (sessionId, sessionInfo = null) => {
    const terminalRef = terminalRefs.current[sessionId];
    if (!terminalRef) return;

    // Clean up existing terminal if it exists
    if (terminalInstances.current[sessionId]) {
      terminalInstances.current[sessionId].dispose();
      delete terminalInstances.current[sessionId];
    }

    // Dynamically calculate terminal size using computed styles
    const terminalElement = terminalRef;
    
    // Force a layout recalculation
    terminalElement.offsetHeight;
    
    const computedStyle = window.getComputedStyle(terminalElement);
    const fontSize = parseFloat(computedStyle.fontSize) || 13;
    
    // Calculate character dimensions more accurately
    const charWidth = fontSize * 0.6; // Approximate width for monospace fonts
    const charHeight = fontSize * 1.0; // Use line-height from CSS
    
    const cols = Math.floor(terminalElement.clientWidth / charWidth);
    const rows = Math.floor(terminalElement.clientHeight / charHeight);
    
    console.log(`Terminal init: ${cols}x${rows} (container: ${terminalElement.clientWidth}x${terminalElement.clientHeight}, font: ${fontSize}px, char: ${charWidth}x${charHeight}px)`);

    // Get the current theme configuration
    const currentTheme = themes[theme].terminal;
    
    // Get scrollback limit from settings (stored in localStorage)
    const scrollbackLimit = scrollbackLines;
    
    const terminal = new Terminal({
      cols: Math.max(cols - 2, 80), // Account for rounding errors
      rows: Math.max(rows - 2, 24), // Account for rounding errors
      cursorBlink: true,
      scrollback: scrollbackLimit, // Ring buffer: automatically discards old lines beyond this limit
      theme: currentTheme,
      fontSize: 13,
      fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace",
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      letterSpacing: 0,
      lineHeight: 1.0
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef);
    fitAddon.fit();
    
    // Ensure theme is applied (in case it wasn't applied during construction)
    if (terminal.options.theme !== currentTheme) {
      terminal.options.theme = currentTheme;
    }
    
    terminalInstances.current[sessionId] = terminal;
    fitAddons.current[sessionId] = fitAddon;

    // Get session info to determine connection type
    const session = sessionInfo || sessions.find(s => s.id === sessionId);
    if (!session) return;

    if (session.connectionType === 'ssh') {
      // Start SSH shell
      try {
        console.log(`Starting SSH shell for session ${sessionId}`);
        await sshConnections.current[sessionId].startShell();
        console.log(`SSH shell started successfully for session ${sessionId}`);
        terminal.write('SSH shell started successfully\r\n');
      } catch (error) {
        console.error(`Failed to start SSH shell for session ${sessionId}:`, error);
        terminal.write(`Failed to start shell: ${error.message}\r\n`);
        return;
      }

    } else if (session.connectionType === 'serial') {
      // Serial port connection
      terminal.write(`Serial port ${session.serialPort} connected at ${session.baudRate} baud\r\n`);
      terminal.write('Serial terminal ready\r\n');

    }

    // Handle terminal input - optimize for responsiveness
    terminal.onData((data) => {
      // Send data immediately for better responsiveness
      if (sshConnections.current[sessionId]) {
        sshConnections.current[sessionId].write(data);
      }
      
      // Log asynchronously without blocking input
      if (sessionLogs.current[sessionId] && sessionLogs.current[sessionId].isLogging) {
        // Fire and forget - don't await to avoid blocking input
        appendToLog(sessionId, data).catch(err => {
          console.error('Failed to append to log:', err);
        });
      }
    });
  };

  // Switch active session
  const switchToSession = (sessionId) => {
    setActiveSessionId(sessionId);
  };

  // Expose sessions to window for main process access (update on sessions change)
  useEffect(() => {
    window.__sessions__ = sessions;
  }, [sessions]);

  // Detach tab to new window
  const handleDetachTab = async (sessionId) => {
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
  };

  // Disconnect session
  const disconnectSession = async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    
    // Use polymorphic disconnect
    if (session && sshConnections.current[sessionId]) {
      sshConnections.current[sessionId].disconnect();
      delete sshConnections.current[sessionId];
    }
    
    if (terminalInstances.current[sessionId]) {
      terminalInstances.current[sessionId].dispose();
      delete terminalInstances.current[sessionId];
    }
    
    // Clean up fit addon
    if (fitAddons.current[sessionId]) {
      delete fitAddons.current[sessionId];
    }
    
    // Clean up session logs
    await cleanupLog(sessionId);
    
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    
    if (activeSessionId === sessionId) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      setActiveSessionId(remainingSessions.length > 0 ? remainingSessions[0].id : null);
    }
  };

  // Group management functions are provided by useGroups hook

  // Connect all sessions in a group
  const connectGroup = async (groupId) => {
    console.log('connectGroup called:', groupId);
    const group = groups.find(g => g.id === groupId);
    if (!group) {
      console.log('Group not found:', groupId);
      return;
    }

    console.log('Group found:', { id: group.id, name: group.name, savedSessions: group.savedSessions, sessionIds: group.sessionIds });

    // First, connect saved sessions (unconnected)
    const savedSessions = group.savedSessions || [];
    console.log('Saved sessions to connect:', savedSessions.length);
    for (const conn of savedSessions) {
      try {
        // Check if already connected
        const existingSession = sessions.find(s => {
          const connType = conn.connectionType || 'ssh';
          if (connType === 'serial') {
            return s.connectionType === 'serial' && s.serialPort === conn.serialPort;
          } else {
            return s.host === conn.host && 
                   s.user === conn.user && 
                   (s.port || '22') === (conn.port || '22') &&
                   s.connectionType === 'ssh';
          }
        });
        
        if (existingSession && existingSession.isConnected) {
          // Already connected, just add to sessionIds if not already there
          if (!group.sessionIds.includes(existingSession.id)) {
            addSessionToGroup(existingSession.id, groupId);
          }
          continue;
        }
        
        // Create connection form from saved session
        const oldForm = { ...connectionForm };
        const connectionFormData = {
          connectionType: conn.connectionType || 'ssh',
          host: conn.host || '',
          port: conn.port || '22',
          user: conn.user || '',
          password: conn.password || '',
          sessionName: conn.sessionName || conn.name || '',
          savePassword: !!conn.password,
          serialPort: conn.serialPort || '',
          baudRate: conn.baudRate || '9600',
          dataBits: conn.dataBits || '8',
          stopBits: conn.stopBits || '1',
          parity: conn.parity || 'none',
          flowControl: conn.flowControl || 'none'
        };
        
        // Set form and wait a bit for state to update
        setConnectionForm(connectionFormData);
        
        // Use the form data directly instead of relying on state
        console.log('Connecting saved session:', connectionFormData);
        const sessionId = await createNewSessionWithData(connectionFormData, true);
        console.log('Created session ID:', sessionId);
        
        if (sessionId) {
          // Add to group after connection
          setPendingGroupAdditions(prev => [...prev, { sessionId, groupId }]);
        }
        
        // Restore form
        setConnectionForm(oldForm);
      } catch (error) {
        console.error(`Failed to connect saved session in group:`, error);
      }
    }
    
    // Then, reconnect disconnected active sessions
    const groupSessions = sessions.filter(s => group.sessionIds.includes(s.id));
    const unconnectedSessions = groupSessions.filter(s => !s.isConnected);
    console.log('Unconnected active sessions:', unconnectedSessions.length);

    for (const session of unconnectedSessions) {
      try {
        // Recreate connection for each session
        if (session.connectionType === 'ssh') {
          // Try to get password from connection history
          const historyEntry = connectionHistory.find(c => 
            c.connectionType === 'ssh' &&
            c.host === session.host && 
            c.user === session.user && 
            (c.port || '22') === (session.port || '22')
          );
          const password = session.password || historyEntry?.password || '';
          
          const connection = new SSHConnection();
          await connection.connect(session.host, session.port, session.user, password);
          await connection.startShell();
          sshConnections.current[session.id] = connection;
          
          // Initialize terminal if not already initialized
          if (!terminalInstances.current[session.id]) {
            setTimeout(() => {
              initializeTerminal(session.id, session);
            }, 100);
          }
          
          setSessions(prev => prev.map(s => 
            s.id === session.id ? { ...s, isConnected: true } : s
          ));
        } else if (session.connectionType === 'serial') {
          const connection = new SerialConnection();
          await connection.connect({
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
          }
          
          setSessions(prev => prev.map(s => 
            s.id === session.id ? { ...s, isConnected: true } : s
          ));
        }
      } catch (error) {
        console.error(`Failed to connect session ${session.id}:`, error);
        alert(`Failed to connect ${session.name}: ${error.message}`);
      }
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, sessionId) => {
    setDraggedSessionId(sessionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, groupId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(groupId);
  };

  const handleDragLeave = () => {
    setDragOverGroupId(null);
  };

  const handleDrop = async (e, groupId) => {
    e.preventDefault();
    
    // Check if it's a saved session from Session List
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const dragData = JSON.parse(data);
        if (dragData.type === 'saved-session') {
          // Add saved session to group without connecting
          const conn = dragData.connection;
          
          // Check if session already exists (already connected)
          const existingSession = sessions.find(s => {
            const connType = conn.connectionType || 'ssh';
            if (connType === 'serial') {
              return s.connectionType === 'serial' && s.serialPort === conn.serialPort;
            } else {
              return s.host === conn.host && 
                     s.user === conn.user && 
                     (s.port || '22') === (conn.port || '22') &&
                     s.connectionType === 'ssh';
            }
          });
          
          if (existingSession) {
            // Session already exists and is connected, add sessionId to group
            addSessionToGroup(existingSession.id, groupId);
          } else {
            // Session not connected yet, add connection info to group's savedSessions
            addSavedSessionToGroup(conn, groupId);
          }
        } else if (draggedSessionId && groupId) {
          // It's an active session
          addSessionToGroup(draggedSessionId, groupId);
        }
      } else if (draggedSessionId && groupId) {
        // Fallback for active sessions
        addSessionToGroup(draggedSessionId, groupId);
      }
    } catch (error) {
      console.error('Error handling drop:', error);
      // Fallback
      if (draggedSessionId && groupId) {
        addSessionToGroup(draggedSessionId, groupId);
      }
    }
    
    setDraggedSessionId(null);
    setDragOverGroupId(null);
  };

  const handleDropOnNewGroup = async (e) => {
    e.preventDefault();
    
    // Check if it's a saved session from Session List
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const dragData = JSON.parse(data);
        if (dragData.type === 'saved-session') {
          // Connect the session first, then show dialog to create group
          const conn = dragData.connection;
          
          // Check if session already exists
          const existingSession = sessions.find(s => {
            const connType = conn.connectionType || 'ssh';
            if (connType === 'serial') {
              return s.connectionType === 'serial' && s.serialPort === conn.serialPort;
            } else {
              return s.host === conn.host && 
                     s.user === conn.user && 
                     (s.port || '22') === (conn.port || '22') &&
                     s.connectionType === 'ssh';
            }
          });
          
          if (existingSession) {
            // Session already exists, show dialog to create group
            setPendingSessionForGroup({ type: 'existing', sessionId: existingSession.id });
            setShowGroupNameDialog(true);
          } else {
            // Create new session first
            const oldForm = { ...connectionForm };
            setConnectionForm({
              connectionType: conn.connectionType || 'ssh',
              host: conn.host || '',
              port: conn.port || '22',
              user: conn.user || '',
              password: conn.password || '',
              sessionName: conn.sessionName || conn.name || '',
              savePassword: !!conn.password,
              serialPort: conn.serialPort || '',
              baudRate: conn.baudRate || '9600',
              dataBits: conn.dataBits || '8',
              stopBits: conn.stopBits || '1',
              parity: conn.parity || 'none',
              flowControl: conn.flowControl || 'none'
            });
            
            try {
              const sessionId = await createNewSession(true); // Don't reset form
              // Show dialog to create group
              if (sessionId) {
                setPendingSessionForGroup({ type: 'new', sessionId: sessionId, connection: conn });
                setShowGroupNameDialog(true);
              }
              // Restore form
              setConnectionForm(oldForm);
            } catch (error) {
              console.error('Failed to create session from drop:', error);
              setConnectionForm(oldForm);
            }
          }
        } else if (draggedSessionId) {
          // It's an active session, show dialog
          setPendingSessionForGroup({ type: 'existing', sessionId: draggedSessionId });
          setShowGroupNameDialog(true);
        }
      } else if (draggedSessionId) {
        // Fallback for active sessions
        setPendingSessionForGroup({ type: 'existing', sessionId: draggedSessionId });
        setShowGroupNameDialog(true);
      }
    } catch (error) {
      console.error('Error handling drop on new group:', error);
      // Fallback
      if (draggedSessionId) {
        setPendingSessionForGroup({ type: 'existing', sessionId: draggedSessionId });
        setShowGroupNameDialog(true);
      }
    }
    
    setDraggedSessionId(null);
    setDragOverGroupId(null);
  };

  const handleCreateGroupFromDialog = () => {
    if (pendingSessionForGroup) {
      const groupName = newGroupName.trim() || `Group ${groups.length + 1}`;
      const newGroupId = createGroup(groupName);
      
      if (pendingSessionForGroup.type === 'existing') {
        setPendingGroupAdditions(prev => [...prev, { sessionId: pendingSessionForGroup.sessionId, groupId: newGroupId }]);
      } else if (pendingSessionForGroup.type === 'new') {
        // Session was already created, just add to group
        setPendingGroupAdditions(prev => [...prev, { sessionId: pendingSessionForGroup.sessionId, groupId: newGroupId }]);
      }
      
      setShowGroupNameDialog(false);
      setNewGroupName('');
      setPendingSessionForGroup(null);
    }
  };

  // Connect from history
  const connectFromHistory = (connection) => {
    setConnectionForm({
      connectionType: connection.connectionType || 'ssh',
      host: connection.host,
      port: connection.port || '22',
      user: connection.user,
      password: connection.password || '',
      sessionName: connection.sessionName || connection.name || '',
      savePassword: !!connection.password, // Check checkbox if saved password exists
      serialPort: connection.serialPort || '',
      baudRate: connection.baudRate || '9600',
      dataBits: connection.dataBits || '8',
      stopBits: connection.stopBits || '1',
      parity: connection.parity || 'none',
      flowControl: connection.flowControl || 'none'
    });
    setShowConnectionForm(true);
  };

  useEffect(() => {
    const handleSshData = (event, { connectionId, data }) => {
      // Find the session that this data belongs to
      const sessionEntry = Object.entries(sshConnections.current).find(
        ([sessionId, conn]) => conn.connectionId === connectionId
      );

      if (sessionEntry) {
        const [sessionId, connection] = sessionEntry;
        if (terminalInstances.current[sessionId]) {
          terminalInstances.current[sessionId].write(data);
          
          // Log the data if logging is enabled for this session
          if (sessionLogs.current[sessionId] && sessionLogs.current[sessionId].isLogging) {
            sessionLogs.current[sessionId].content += data;
          }
        }
      }
    };

    const handleSshClose = (event, { connectionId }) => {
      // Find the session that this event belongs to
      const sessionEntry = Object.entries(sshConnections.current).find(
        ([sessionId, conn]) => conn.connectionId === connectionId
      );

      if (sessionEntry) {
        const [sessionId, connection] = sessionEntry;
        if (terminalInstances.current[sessionId]) {
          terminalInstances.current[sessionId].write('\r\nSSH connection closed.\r\n');
        }
      }
    };

    window.electronAPI.onSSHData(handleSshData);
    window.electronAPI.onSSHClose(handleSshClose);

    return () => {
      window.electronAPI.offSSHData(handleSshData);
      window.electronAPI.offSSHClose(handleSshClose);
    };
  }, []); // Register once

  // Handle detached session events
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
        if (sessionLogs.current[sessionId]) {
          delete sessionLogs.current[sessionId];
        }
        if (logStates[sessionId]) {
          setLogStates(prevStates => {
            const newStates = { ...prevStates };
            delete newStates[sessionId];
            return newStates;
          });
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
                // Get password from connection history if not in session
                let password = newSession.password;
                if (!password) {
                  const historyEntry = connectionHistory.find(c => 
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
                
                // Initialize terminal
                setTimeout(() => {
                  initializeTerminal(newSession.id, newSession);
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
  }, []);





  // Global event listeners - register once
  useEffect(() => {

    const handleSerialData = (event, receivedSessionId, data) => {
      if (terminalInstances.current[receivedSessionId]) {
        // Write to terminal immediately for better responsiveness
        terminalInstances.current[receivedSessionId].write(data);
        
        // Log asynchronously without blocking display
        if (sessionLogs.current[receivedSessionId] && sessionLogs.current[receivedSessionId].isLogging) {
          // Fire and forget - don't await to avoid blocking display
          appendToLog(receivedSessionId, data).catch(err => {
            console.error('Failed to append to log:', err);
          });
        }
      }
    };

    const handleSerialClose = (event, receivedSessionId) => {
      if (terminalInstances.current[receivedSessionId]) {
        terminalInstances.current[receivedSessionId].write('\r\nSerial connection closed.\r\n');
        setSessions(prev => prev.map(s => 
          s.id === receivedSessionId ? { ...s, isConnected: false } : s
        ));
      }
    };

    window.electronAPI.onSerialData(handleSerialData);
    window.electronAPI.onSerialClose(handleSerialClose);

    return () => {
      // Cleanup happens automatically on component unmount
    };
  }, []); // Register once

  // Process pending group additions when sessions are available
  useEffect(() => {
    if (pendingGroupAdditions.length > 0 && sessions.length > 0) {
      const toProcess = [...pendingGroupAdditions];
      const processed = [];
      const remaining = [];
      
      toProcess.forEach(({ sessionId, groupId }) => {
        // Check if session exists in state
        const sessionExists = sessions.some(s => s.id === sessionId);
        if (sessionExists) {
          console.log('Processing pending group addition:', { sessionId, groupId });
          addSessionToGroup(sessionId, groupId);
          processed.push({ sessionId, groupId });
        } else {
          remaining.push({ sessionId, groupId });
        }
      });
      
      // Only update if we processed something
      if (processed.length > 0) {
        setPendingGroupAdditions(remaining);
      }
    }
  }, [sessions, pendingGroupAdditions]);

  // Terminal initialization effect - only for existing sessions when switching
  useEffect(() => {
    if (activeSessionId && sessions.find(s => s.id === activeSessionId)?.isConnected) {
      // Only initialize if terminal doesn't exist yet (for session switching)
      if (!terminalInstances.current[activeSessionId]) {
        const timer = setTimeout(() => {
          initializeTerminal(activeSessionId);
        }, 200);
        
        return () => clearTimeout(timer);
      }
    }
  }, [activeSessionId, sessions]);

  // Adjust terminal size on window resize
  useEffect(() => {
    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    const debouncedResize = debounce(() => {
      setTimeout(resizeTerminal, 10);
    }, 250);

    window.addEventListener('resize', debouncedResize);
    return () => window.removeEventListener('resize', debouncedResize);
  }, []); // Register once

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Dynamic window title change
  useEffect(() => {
    const updateWindowTitle = async () => {
      try {
        if (activeSession) {
          const title = `${activeSession.user}@${activeSession.host}:${activeSession.port} - ash`;
          await window.electronAPI.setWindowTitle(title);
        } else {
          await window.electronAPI.setWindowTitle('ash');
        }
      } catch (error) {
        console.log('Window title update failed:', error);
        // IPC handler may not be ready yet
      }
    };

    // Execute with a slight delay
    const timer = setTimeout(updateWindowTitle, 100);
    return () => clearTimeout(timer);
  }, [activeSession]);

  // Load serial ports when connection form opens
  useEffect(() => {
    if (showConnectionForm && connectionForm.connectionType === 'serial') {
      loadSerialPorts();
    }
  }, [showConnectionForm, connectionForm.connectionType]);

  // Handle system menu events
  useEffect(() => {
    // New session menu event
    window.electronAPI.onMenuNewSession(() => {
      setShowConnectionForm(true);
    });

    // Close session menu event
    window.electronAPI.onMenuCloseSession(() => {
      if (activeSessionId) {
        disconnectSession(activeSessionId);
      }
    });

    // Settings menu event
    window.electronAPI.onMenuSettings(() => {
      setShowSettings(true);
    });

    // Toggle session manager menu event
    window.electronAPI.onMenuToggleSessionManager((event, checked) => {
      setShowSessionManager(checked);
      // Reset to default width when showing
      if (checked && sessionManagerWidth === 0) {
        setSessionManagerWidth(250);
      }
      
      // Resize terminal after toggle
      setTimeout(resizeTerminal, 350); // Wait for CSS transition to complete
    });

    // About menu event
    window.electronAPI.onMenuAbout(() => {
      alert('ash SSH Client\nVersion 1.0.0\nA modern SSH client built with Electron and React');
    });

    return () => {
      // Clean up event listeners
      window.electronAPI.removeAllListeners('menu-new-session');
      window.electronAPI.removeAllListeners('menu-close-session');
      window.electronAPI.removeAllListeners('menu-toggle-session-manager');
      window.electronAPI.removeAllListeners('menu-settings');
      window.electronAPI.removeAllListeners('menu-about');
    };
  }, [activeSessionId]);

  // Window controls (Windows/Linux only)
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

  // Window control handlers
  const handleMinimize = async () => {
    await window.electronAPI.windowMinimize();
  };

  const handleMaximize = async () => {
    await window.electronAPI.windowMaximize();
  };

  const handleClose = async () => {
    await window.electronAPI.windowClose();
  };

  // Cleanup resize event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Apply theme with CSS variables (currentTheme is from useTheme hook)
  
  return (
    <div 
      className="securecrt-app"
      style={{
        '--theme-bg': currentTheme.background,
        '--theme-surface': currentTheme.surface,
        '--theme-text': currentTheme.text,
        '--theme-border': currentTheme.border,
        '--theme-accent': currentTheme.accent
      }}
    >
      {/* Windows/Linux custom title bar with window controls */}
      {isWindows && (
        <div className="custom-titlebar">
          <div className="titlebar-title">ash</div>
          <div className="titlebar-controls">
            <button 
              className="titlebar-button minimize-button"
              onClick={handleMinimize}
              title="Minimize"
            >
              <span>−</span>
            </button>
            <button 
              className="titlebar-button maximize-button"
              onClick={handleMaximize}
              title={isMaximized ? "Restore" : "Maximize"}
            >
              <span>{isMaximized ? '❐' : '□'}</span>
            </button>
            <button 
              className="titlebar-button close-button"
              onClick={handleClose}
              title="Close"
            >
              <span>×</span>
            </button>
          </div>
        </div>
      )}
      <div className="main-content">
        {/* Left session manager */}
        <div 
          className={`session-manager ${!showSessionManager ? 'hidden' : ''}`}
          style={{ width: showSessionManager ? `${sessionManagerWidth}px` : '0' }}
        >
          <div className="session-manager-header">
            <h3>Sessions</h3>
            <div className="header-buttons">
              <button 
                className="settings-btn"
                onClick={() => setShowSettings(true)}
                title="Settings"
              >
                ⚙️
              </button>
              <button 
                className="new-session-btn"
                onClick={() => {
                  setFormError('');
                  setShowConnectionForm(true);
                }}
                title="New Session"
              >
                +
              </button>
            </div>
          </div>
          
          {/* Favorites */}
          {favorites.length > 0 && (
            <div className="section">
              <div className="section-header">Favorites</div>
              {favorites.map((fav, index) => {
                const isSerial = fav.connectionType === 'serial';
                const tooltip = isSerial 
                  ? fav.serialPort 
                  : `${fav.user}@${fav.host}`;
                return (
                  <div 
                    key={index}
                    className="session-item favorite"
                    onClick={async () => {
                      try {
                        // Directly connect without showing dialog
                        await createNewSessionWithData({
                          connectionType: fav.connectionType || 'ssh',
                          host: fav.host || '',
                          port: fav.port || '22',
                          user: fav.user || '',
                          password: fav.password || '',
                          sessionName: fav.sessionName || fav.name || '',
                          savePassword: !!fav.password,
                          serialPort: fav.serialPort || '',
                          baudRate: fav.baudRate || '9600',
                          dataBits: fav.dataBits || '8',
                          stopBits: fav.stopBits || '1',
                          parity: fav.parity || 'none',
                          flowControl: fav.flowControl || 'none'
                        }, true); // skipFormReset = true
                      } catch (error) {
                        console.error('Failed to connect from favorite:', error);
                        alert('Connection failed: ' + error.message);
                      }
                    }}
                    title={tooltip}
                  >
                    <span className="session-name">⭐ {fav.name}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Session List - All saved sessions */}
          {connectionHistory.length > 0 && (
            <div className="section">
              <div className="section-header">Session List</div>
              {connectionHistory.map((conn, index) => {
                const isSerial = conn.connectionType === 'serial';
                const isFavorite = isSerial 
                  ? favorites.some(f => f.connectionType === 'serial' && f.serialPort === conn.serialPort)
                  : favorites.some(f => f.host === conn.host && f.user === conn.user);
                const sessionId = isSerial 
                  ? `saved-serial-${conn.serialPort}-${index}`
                  : `saved-${conn.host}-${conn.user}-${conn.port || '22'}-${index}`;
                const displayName = conn.sessionName || conn.name || (isSerial 
                  ? `Serial: ${conn.serialPort}`
                  : `${conn.user}@${conn.host}`);
                const tooltip = isSerial
                  ? `${conn.serialPort} - Drag to group or click to connect`
                  : `${conn.user}@${conn.host} - Drag to group or click to connect`;
                
                return (
                  <div 
                    key={index}
                    className="session-item session-list-item"
                    draggable
                    onDragStart={(e) => {
                      // Store connection info in dataTransfer for later use
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'saved-session',
                        connection: conn,
                        sessionId: sessionId
                      }));
                      setDraggedSessionId(sessionId);
                    }}
                    onClick={() => connectFromHistory(conn)}
                    title={tooltip}
                  >
                    <span className="session-name">
                      {displayName}
                    </span>
                    <button 
                      className="favorite-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(conn);
                      }}
                      title="Toggle Favorite"
                    >
                      {isFavorite ? '★' : '☆'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Groups */}
          {groups.length > 0 && (
            <div className="section">
              <div className="section-header">Groups</div>
              {groups.map(group => {
                const groupSessions = sessions.filter(s => group.sessionIds.includes(s.id));
                const savedSessions = group.savedSessions || [];
                const totalSessions = groupSessions.length + savedSessions.length;
                const allConnected = totalSessions > 0 && 
                  groupSessions.every(s => s.isConnected) && 
                  savedSessions.length === 0; // All saved sessions are now connected
                
                return (
                  <div key={group.id} className="group-container">
                    <div 
                      className={`group-header ${dragOverGroupId === group.id ? 'drag-over' : ''} ${allConnected ? 'all-connected' : ''}`}
                      onDragOver={(e) => handleDragOver(e, group.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, group.id)}
                      onClick={() => {
                        // Click on group header to connect all sessions in group
                        if (!allConnected && totalSessions > 0) {
                          console.log('Group header clicked for group:', group.id);
                          connectGroup(group.id);
                        }
                      }}
                      style={{ cursor: (allConnected || totalSessions === 0) ? 'default' : 'pointer' }}
                    >
                      <button
                        className="group-toggle"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroupExpanded(group.id);
                        }}
                        title={group.isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {group.isExpanded ? '▼' : '▶'}
                      </button>
                      {editingGroupId === group.id ? (
                        <input
                          type="text"
                          className="group-name-input"
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          onBlur={() => saveGroupName(group.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              saveGroupName(group.id);
                            } else if (e.key === 'Escape') {
                              cancelEditingGroupName();
                            }
                          }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span 
                          className="group-name"
                          onDoubleClick={() => startEditingGroupName(group.id)}
                          title="Double-click to rename"
                        >
                          {group.name}
                        </span>
                      )}
                      <span className="group-count">({totalSessions})</span>
                      <button
                        className="group-connect-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Play button clicked for group:', group.id);
                          connectGroup(group.id);
                        }}
                        title="Connect All Sessions in Group"
                        disabled={allConnected || totalSessions === 0}
                      >
                        ▶
                      </button>
                      <button
                        className="group-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteGroup(group.id);
                        }}
                        title="Delete Group"
                      >
                        ×
                      </button>
                    </div>
                    {group.isExpanded && (
                      <div className="group-sessions">
                        {group.sessionIds.map((sessionId, index) => {
                          const session = sessions.find(s => s.id === sessionId);
                          if (!session) return null; // Session might not exist yet
                          
                          return (
                            <div
                              key={`${sessionId}-${index}`}
                              className={`session-item group-session-item ${activeSessionId === session.id ? 'active' : ''}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, session.id)}
                              onClick={() => switchToSession(session.id)}
                            >
                              <span className="session-name">{session.name}</span>
                              <span className={`connection-status ${session.isConnected ? 'connected' : 'disconnected'}`}>
                                {session.isConnected ? '●' : '○'}
                              </span>
                              <button
                                className="remove-from-group-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSessionFromGroup(session.id, group.id, index);
                                }}
                                title="Remove from Group"
                              >
                                ⊗
                              </button>
                              <button
                                className="close-session-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  disconnectSession(session.id);
                                }}
                                title="Close Session"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                        {/* Saved sessions (not connected yet) */}
                        {savedSessions.map((conn, index) => {
                          const displayName = conn.sessionName || conn.name || (conn.connectionType === 'serial'
                            ? `Serial: ${conn.serialPort}`
                            : `${conn.user}@${conn.host}`);
                          return (
                            <div
                              key={`saved-${index}`}
                              className="session-item group-session-item saved-session"
                            >
                              <span className="session-name">{displayName} (not connected)</span>
                              <span className="connection-status disconnected">○</span>
                              <button
                                className="remove-from-group-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Remove from savedSessions
                                  setGroups(prevGroups => {
                                    const updated = prevGroups.map(g => {
                                      if (g.id === group.id) {
                                        const newSavedSessions = [...(g.savedSessions || [])];
                                        newSavedSessions.splice(index, 1);
                                        return { ...g, savedSessions: newSavedSessions };
                                      }
                                      return g;
                                    });
                                    // localStorage will be updated by useEffect
                                    return updated;
                                  });
                                }}
                                title="Remove from Group"
                              >
                                ⊗
                              </button>
                            </div>
                          );
                        })}
                        {group.sessionIds.length === 0 && savedSessions.length === 0 && (
                          <div className="group-empty">Drag sessions here</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Create New Group Button */}
          <div className="section">
            <button
              className="new-group-btn"
              onClick={() => {
                const groupName = `Group ${groups.length + 1}`;
                createGroup(groupName);
              }}
              title="Create a new empty group"
            >
              + Create New Group
            </button>
          </div>

          {/* Active sessions (ungrouped) */}
          {sessions.filter(s => !groups.some(g => g.sessionIds.includes(s.id))).length > 0 && (
            <div className="section">
              <div className="section-header">Active Sessions</div>
              {sessions
                .filter(s => !groups.some(g => g.sessionIds.includes(s.id)))
                .map(session => (
                  <div 
                    key={session.id}
                    className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, session.id)}
                    onClick={() => switchToSession(session.id)}
                  >
                    <span className="session-name">{session.name}</span>
                    <span className={`connection-status ${session.isConnected ? 'connected' : 'disconnected'}`}>
                      {session.isConnected ? '●' : '○'}
                    </span>
                    <button 
                      className="close-session-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        disconnectSession(session.id);
                      }}
                      title="Close Session"
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* Connection history */}
          {connectionHistory.length > 0 && (
            <div className="section">
              <div className="section-header">Recent</div>
              {connectionHistory.slice(0, 10).map((conn, index) => (
                <div 
                  key={index}
                  className="session-item history"
                  onClick={() => connectFromHistory(conn)}
                  title={`${conn.user}@${conn.host}`}
                >
                  <span className="session-name">{conn.user}@{conn.host}</span>
                  <button 
                    className="favorite-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(conn);
                    }}
                    title="Toggle Favorite"
                  >
                    {favorites.some(f => f.host === conn.host && f.user === conn.user) ? '★' : '☆'}
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>
        
        {/* Resize handle */}
        {showSessionManager && (
          <div 
            ref={resizeHandleRef}
            className="resize-handle"
            onMouseDown={handleMouseDown}
          />
        )}

        {/* Right terminal area */}
        <div className="terminal-area">
          {activeSession ? (
            <div className="terminal-container">
              <div className="terminal-header">
                <div className="tab-bar">
                  {sessions.map(session => (
                    <div 
                      key={session.id}
                      className={`tab ${activeSessionId === session.id ? 'active' : ''}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', session.id);
                        e.dataTransfer.effectAllowed = 'move';
                        // Add visual feedback
                        e.currentTarget.style.opacity = '0.5';
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.style.opacity = '';
                        // Check if dragged outside the window
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX;
                        const y = e.clientY;
                        
                        // If dragged outside window bounds, detach
                        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
                          handleDetachTab(session.id);
                        }
                      }}
                      onClick={() => switchToSession(session.id)}
                    >
                      <span className="tab-name">{session.name}</span>
                      <span className={`tab-status ${session.isConnected ? 'connected' : 'disconnected'}`}>
                        {session.isConnected ? '●' : '○'}
                      </span>
                      <button 
                        className="tab-close"
                        onClick={(e) => {
                          e.stopPropagation();
                          disconnectSession(session.id);
                        }}
                        title="Close"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                {activeSessionId && (
                  <div className="log-controls">
                    <button 
                      className={`log-btn ${logStates[activeSessionId]?.isLogging ? 'logging' : 'not-logging'}`}
                      onClick={async () => {
                        if (logStates[activeSessionId]?.isLogging) {
                          const logEntry = await stopLogging(activeSessionId);
                          if (logEntry && terminalInstances.current[activeSessionId]) {
                            terminalInstances.current[activeSessionId].write(logEntry);
                          }
                        } else {
                          startLogging(activeSessionId);
                        }
                      }}
                      title={logStates[activeSessionId]?.isLogging ? 'Stop Logging' : 'Start Logging'}
                    >
                      {logStates[activeSessionId]?.isLogging ? '⏹' : '⏺'}
                    </button>
                    <button 
                      className="log-btn save-log"
                      onClick={() => saveLog(activeSessionId)}
                      disabled={!sessionLogs.current[activeSessionId]?.content}
                      title="Save Log"
                    >
                      💾
                    </button>
                    <button 
                      className="log-btn clear-log"
                      onClick={() => clearLog(activeSessionId)}
                      disabled={!sessionLogs.current[activeSessionId]?.content}
                      title="Clear Log"
                    >
                      🗑
                    </button>
                    <span className="log-status">
                      {logStates[activeSessionId]?.isLogging ? 'Recording' : 'Not Recording'}
                    </span>
                  </div>
                )}
              </div>
              <div className="terminal-content-container">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    style={{ display: activeSessionId === session.id ? 'block' : 'none', height: '100%', width: '100%', position: 'absolute' }}
                  >
                    <div
                      ref={el => terminalRefs.current[session.id] = el}
                      className="terminal-content"
                      style={{ height: '100%' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="welcome-screen">
              <h2>Welcome to ash SSH Client</h2>
              <p>Create a new session to get started</p>
              <button 
                className="welcome-connect-btn"
                onClick={() => {
                  setFormError('');
                  setShowConnectionForm(true);
                }}
              >
                New Session
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="status-bar">
        <div className="status-left">
          {activeSession ? (
            <span>Connected to {activeSession.user}@{activeSession.host}:{activeSession.port}</span>
          ) : (
            <span>Ready</span>
          )}
        </div>
        <div className="status-right">
          <span>Sessions: {sessions.length}</span>
        </div>
      </div>

      {/* Connection form modal */}
      {showConnectionForm && (
        <div className="modal-overlay">
          <div className="connection-modal">
            <div className="modal-header">
              <h3>New Connection</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowConnectionForm(false);
                  setFormError('');
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              setFormError('');
              createNewSession(); 
            }}>
              <div className="form-group">
                <label>Connection Type</label>
                <div className="connection-type-selector">
                  <button
                    type="button"
                    className={`type-btn ${connectionForm.connectionType === 'ssh' ? 'active' : ''}`}
                    onClick={() => setConnectionForm(prev => ({ ...prev, connectionType: 'ssh' }))}
                  >
                    SSH
                  </button>
                  <button
                    type="button"
                    className={`type-btn ${connectionForm.connectionType === 'serial' ? 'active' : ''}`}
                    onClick={() => setConnectionForm(prev => ({ ...prev, connectionType: 'serial' }))}
                  >
                    Serial
                  </button>
                </div>
              </div>

              {formError && (
                <div className="form-error" style={{ 
                  color: '#ff4444', 
                  backgroundColor: 'rgba(255, 68, 68, 0.1)', 
                  padding: '8px 12px', 
                  borderRadius: '4px', 
                  marginBottom: '16px',
                  border: '1px solid rgba(255, 68, 68, 0.3)',
                  fontSize: '12px'
                }}>
                  {formError}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="sessionName">Session Name</label>
                <input
                  type="text"
                  id="sessionName"
                  name="sessionName"
                  value={connectionForm.sessionName}
                  onChange={handleInputChange}
                  placeholder={connectionForm.connectionType === 'ssh' ? "My Server" : "My Serial Device"}
                />
              </div>

              {connectionForm.connectionType === 'ssh' && (
                <>
                  <div className="form-group">
                    <label htmlFor="host">Host</label>
                    <input
                      type="text"
                      id="host"
                      name="host"
                      value={connectionForm.host}
                      onChange={handleInputChange}
                      placeholder="192.168.1.100 or server.example.com"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="port">Port</label>
                    <input
                      type="number"
                      id="port"
                      name="port"
                      value={connectionForm.port}
                      onChange={handleInputChange}
                      placeholder="22"
                      min="1"
                      max="65535"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="user">Username</label>
                    <input
                      type="text"
                      id="user"
                      name="user"
                      value={connectionForm.user}
                      onChange={handleInputChange}
                      placeholder="root, admin, ubuntu"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={connectionForm.password}
                      onChange={handleInputChange}
                      placeholder="Password"
                    />
                  </div>
                </>
              )}

              {connectionForm.connectionType === 'serial' && (
                <>
                  <div className="form-group">
                    <label htmlFor="serialPort">Serial Port</label>
                    <div className="serial-port-selector">
                      <select
                        id="serialPort"
                        name="serialPort"
                        value={connectionForm.serialPort}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select a port</option>
                        {availableSerialPorts.map((port, index) => (
                          <option key={index} value={port.path}>
                            {port.path} {port.manufacturer ? `(${port.manufacturer})` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="refresh-ports-btn"
                        onClick={loadSerialPorts}
                        title="Refresh ports"
                      >
                        🔄
                      </button>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="baudRate">Baud Rate</label>
                      <select
                        id="baudRate"
                        name="baudRate"
                        value={connectionForm.baudRate}
                        onChange={handleInputChange}
                      >
                        <option value="300">300</option>
                        <option value="600">600</option>
                        <option value="1200">1200</option>
                        <option value="2400">2400</option>
                        <option value="4800">4800</option>
                        <option value="9600">9600</option>
                        <option value="14400">14400</option>
                        <option value="19200">19200</option>
                        <option value="28800">28800</option>
                        <option value="38400">38400</option>
                        <option value="57600">57600</option>
                        <option value="76800">76800</option>
                        <option value="115200">115200</option>
                        <option value="230400">230400</option>
                        <option value="460800">460800</option>
                        <option value="921600">921600</option>
                        <option value="1000000">1000000</option>
                        <option value="2000000">2000000</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="dataBits">Data Bits</label>
                      <select
                        id="dataBits"
                        name="dataBits"
                        value={connectionForm.dataBits}
                        onChange={handleInputChange}
                      >
                        <option value="7">7</option>
                        <option value="8">8</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="stopBits">Stop Bits</label>
                      <select
                        id="stopBits"
                        name="stopBits"
                        value={connectionForm.stopBits}
                        onChange={handleInputChange}
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="parity">Parity</label>
                      <select
                        id="parity"
                        name="parity"
                        value={connectionForm.parity}
                        onChange={handleInputChange}
                      >
                        <option value="none">None</option>
                        <option value="even">Even</option>
                        <option value="odd">Odd</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="flowControl">Flow Control</label>
                    <select
                      id="flowControl"
                      name="flowControl"
                      value={connectionForm.flowControl}
                      onChange={handleInputChange}
                    >
                      <option value="none">None</option>
                      <option value="xon">XON/XOFF</option>
                      <option value="rts">RTS/CTS</option>
                    </select>
                  </div>
                </>
              )}

              {connectionForm.connectionType === 'ssh' && (
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="savePassword"
                      checked={connectionForm.savePassword}
                      onChange={(e) => {
                        setConnectionForm(prev => ({
                          ...prev,
                          savePassword: e.target.checked
                        }));
                      }}
                    />
                    <span className="checkbox-text">Save password</span>
                  </label>
                  <div className="checkbox-help">
                    ⚠️ Passwords are stored locally and not encrypted
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button 
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowConnectionForm(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="connect-btn"
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Name Dialog */}
      {showGroupNameDialog && (
        <div className="modal-overlay" onClick={() => {
          setShowGroupNameDialog(false);
          setNewGroupName('');
          setPendingSessionForGroup(null);
        }}>
          <div className="connection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Group</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowGroupNameDialog(false);
                  setNewGroupName('');
                  setPendingSessionForGroup(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Group Name</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateGroupFromDialog();
                    } else if (e.key === 'Escape') {
                      setShowGroupNameDialog(false);
                      setNewGroupName('');
                      setPendingSessionForGroup(null);
                    }
                  }}
                  placeholder={`Group ${groups.length + 1}`}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => {
                  setShowGroupNameDialog(false);
                  setNewGroupName('');
                  setPendingSessionForGroup(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="connect-btn"
                onClick={handleCreateGroupFromDialog}
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings window modal */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="settings-modal">
            <div className="modal-header">
              <h3>Settings</h3>
              <button 
                className="modal-close"
                onClick={() => setShowSettings(false)}
              >
                ×
              </button>
            </div>
            
            <div className="settings-content">
              <div className="settings-section">
                <h4>Appearance</h4>
                
                <div className="setting-group">
                  <label>Theme</label>
                  <div className="theme-options">
                    {Object.entries(themes).map(([key, themeData]) => (
                      <button
                        key={key}
                        className={`theme-option ${theme === key ? 'active' : ''}`}
                        onClick={() => changeTheme(key)}
                      >
                        <div 
                          className="theme-preview"
                          style={{ backgroundColor: themeData.background }}
                        />
                        {themeData.name}
                      </button>
                    ))}
                  </div>
                  <p className="setting-description">
                    Changes both UI and terminal appearance
                  </p>
                </div>
              </div>

              <div className="settings-section">
                <h4>Terminal</h4>
                
                <div className="setting-group">
                  <label>Scrollback Lines</label>
                  <input
                    type="number"
                    min="100"
                    max="50000"
                    step="100"
                    value={scrollbackLines}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value >= 100 && value <= 50000) {
                        setScrollbackLines(value);
                        localStorage.setItem('ash-scrollback', value.toString());
                      }
                    }}
                    style={{ width: '150px' }}
                  />
                  <p className="setting-description">
                    Number of lines to keep in terminal buffer (ring buffer). 
                    Higher values use more memory. Recommended: 2000-10000 for multiple concurrent sessions.
                    Current: ~{Math.round(scrollbackLines * 80 * 10 / 1024 / 1024 * 10) / 10}MB per session
                  </p>
                </div>
              </div>

              <div className="settings-section">
                <h4>Connection</h4>
                
                <div className="setting-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={true}
                      readOnly
                    />
                    Save connection history
                  </label>
                  <p className="setting-description">
                    Automatically save recent connections for quick access
                  </p>
                </div>

                <div className="setting-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={true}
                      readOnly
                    />
                    Enable favorites
                  </label>
                  <p className="setting-description">
                    Allow marking connections as favorites
                  </p>
                </div>
              </div>

              <div className="settings-section">
                <h4>About</h4>
                <div className="about-info">
                  <p><strong>ash SSH Client</strong></p>
                  <p>Version 1.0.0</p>
                  <p>A modern SSH client built with Electron and React</p>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="close-btn"
                onClick={() => setShowSettings(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;