import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
import { CustomTitleBar } from './components/CustomTitleBar';
import { SessionManager } from './components/SessionManager';
import { TerminalView } from './components/TerminalView';
import { ConnectionForm } from './components/ConnectionForm';
import { Settings } from './components/Settings';
import { GroupNameDialog } from './components/GroupNameDialog';
import { StatusBar } from './components/StatusBar';

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

  // Memoize input change handler
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setConnectionForm(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

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

  // Switch active session - memoized to prevent unnecessary re-renders
  const switchToSession = useCallback((sessionId) => {
    setActiveSessionId(sessionId);
  }, []);

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

  // Drag and drop handlers - memoized
  const handleDragStart = useCallback((e, sessionId) => {
    setDraggedSessionId(sessionId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, groupId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(groupId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverGroupId(null);
  }, []);

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

  // Memoize activeSession to avoid recalculation on every render
  const activeSession = useMemo(() => 
    sessions.find(s => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  // Memoize ungrouped sessions to avoid recalculation
  const ungroupedSessions = useMemo(() => {
    const groupedSessionIds = new Set(
      groups.flatMap(g => g.sessionIds)
    );
    return sessions.filter(s => !groupedSessionIds.has(s.id));
  }, [sessions, groups]);

  // Memoize favorites lookup map for O(1) access
  const favoritesMap = useMemo(() => {
    const map = new Map();
    favorites.forEach(fav => {
      if (fav.connectionType === 'serial') {
        map.set(`serial:${fav.serialPort}`, fav);
      } else {
        map.set(`ssh:${fav.host}:${fav.user}:${fav.port || '22'}`, fav);
      }
    });
    return map;
  }, [favorites]);

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

  // Window control handlers - memoized
  const handleMinimize = useCallback(async () => {
    await window.electronAPI.windowMinimize();
  }, []);

  const handleMaximize = useCallback(async () => {
    await window.electronAPI.windowMaximize();
  }, []);

  const handleClose = useCallback(async () => {
    await window.electronAPI.windowClose();
  }, []);

  // Memoized handlers for modals
  const handleShowSettings = useCallback(() => setShowSettings(true), []);
  const handleShowConnectionForm = useCallback(() => {
    setFormError('');
    setShowConnectionForm(true);
  }, []);
  const handleCloseConnectionForm = useCallback(() => {
    setShowConnectionForm(false);
    setFormError('');
  }, []);
  const handleCloseSettings = useCallback(() => setShowSettings(false), []);
  const handleConnectionFormSubmit = useCallback((e) => {
    e.preventDefault();
    setFormError('');
    createNewSession();
  }, []); // createNewSession is stable (uses connectionForm from closure)
  const handleConnectionTypeChange = useCallback((type) => {
    setConnectionForm(prev => ({ ...prev, connectionType: type }));
  }, []);
  const handleSavePasswordChange = useCallback((e) => {
    setConnectionForm(prev => ({ ...prev, savePassword: e.target.checked }));
  }, []);
  const handleCloseGroupDialog = useCallback(() => {
    setShowGroupNameDialog(false);
    setNewGroupName('');
    setPendingSessionForGroup(null);
  }, []);
  const handleGroupNameChange = useCallback((e) => {
    setNewGroupName(e.target.value);
  }, []);
  const handleGroupDialogKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleCreateGroupFromDialog();
    } else if (e.key === 'Escape') {
      setShowGroupNameDialog(false);
      setNewGroupName('');
      setPendingSessionForGroup(null);
    }
  }, []); // handleCreateGroupFromDialog is stable
  const handleScrollbackChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 100 && value <= 50000) {
      setScrollbackLines(value);
      localStorage.setItem('ash-scrollback', value.toString());
    }
  }, []);

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
        <CustomTitleBar
          isMaximized={isMaximized}
          onMinimize={handleMinimize}
          onMaximize={handleMaximize}
          onClose={handleClose}
        />
      )}
      <div className="main-content">
        {/* Left session manager */}
        <SessionManager
          showSessionManager={showSessionManager}
          sessionManagerWidth={sessionManagerWidth}
          sessions={sessions}
          activeSessionId={activeSessionId}
          groups={groups}
          favorites={favorites}
          connectionHistory={connectionHistory}
          ungroupedSessions={ungroupedSessions}
          draggedSessionId={draggedSessionId}
          dragOverGroupId={dragOverGroupId}
          editingGroupId={editingGroupId}
          editingGroupName={editingGroupName}
          setEditingGroupName={setEditingGroupName}
          onShowSettings={handleShowSettings}
          onShowConnectionForm={handleShowConnectionForm}
          onCreateNewSessionWithData={createNewSessionWithData}
          onConnectFromHistory={connectFromHistory}
          onToggleFavorite={toggleFavorite}
          onSwitchToSession={switchToSession}
          onDisconnectSession={disconnectSession}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onConnectGroup={connectGroup}
          onToggleGroupExpanded={toggleGroupExpanded}
          onStartEditingGroupName={startEditingGroupName}
          onSaveGroupName={saveGroupName}
          onCancelEditingGroupName={cancelEditingGroupName}
          onRemoveSessionFromGroup={removeSessionFromGroup}
          onDeleteGroup={deleteGroup}
          onCreateGroup={createGroup}
          setGroups={setGroups}
        />
        
        {/* Resize handle */}
        {showSessionManager && (
          <div 
            ref={resizeHandleRef}
            className="resize-handle"
            onMouseDown={handleMouseDown}
          />
        )}

        {/* Right terminal area */}
        <TerminalView
          activeSession={activeSession}
          sessions={sessions}
          activeSessionId={activeSessionId}
          terminalRefs={terminalRefs}
          logStates={logStates}
          sessionLogs={sessionLogs}
          onSwitchToSession={switchToSession}
          onDisconnectSession={disconnectSession}
          onDetachTab={handleDetachTab}
          onStartLogging={startLogging}
          onStopLogging={stopLogging}
          onSaveLog={saveLog}
          onClearLog={clearLog}
          onShowConnectionForm={handleShowConnectionForm}
          terminalInstances={terminalInstances}
        />
      </div>

      {/* Bottom status bar */}
      <StatusBar 
        activeSession={activeSession}
        sessionsCount={sessions.length}
      />

      {/* Connection form modal */}
      <ConnectionForm
        showConnectionForm={showConnectionForm}
        connectionForm={connectionForm}
        formError={formError}
        isConnecting={isConnecting}
        availableSerialPorts={availableSerialPorts}
        onClose={handleCloseConnectionForm}
        onSubmit={handleConnectionFormSubmit}
        onInputChange={handleInputChange}
        onConnectionTypeChange={handleConnectionTypeChange}
        onSavePasswordChange={handleSavePasswordChange}
        onLoadSerialPorts={loadSerialPorts}
      />

      {/* Group Name Dialog */}
      <GroupNameDialog
        showGroupNameDialog={showGroupNameDialog}
        newGroupName={newGroupName}
        groups={groups}
        onClose={handleCloseGroupDialog}
        onCreate={handleCreateGroupFromDialog}
        onNameChange={handleGroupNameChange}
        onKeyDown={handleGroupDialogKeyDown}
      />

      {/* Settings window modal */}
      <Settings
        showSettings={showSettings}
        theme={theme}
        themes={themes}
        scrollbackLines={scrollbackLines}
        onChangeTheme={changeTheme}
        onChangeScrollbackLines={handleScrollbackChange}
        onClose={handleCloseSettings}
      />
    </div>
  );
}

export default App;