import React, { useState, useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import './App.css';

import { FitAddon } from '@xterm/addon-fit';

// Class for actual SSH connection management
class SSHConnection {
  constructor() {
    this.connectionId = null;
    this.isConnected = false;
    this.terminal = null;
  }

  async connect(host, port, user, password) {
    try {
      console.log(`SSH connecting to ${user}@${host}:${port}`);
      const result = await window.electronAPI.sshConnect({
        host,
        port: parseInt(port),
        username: user,
        password
      });
      
      console.log('SSH connect result:', result);
      
      if (result.success) {
        this.connectionId = result.connectionId;
        this.isConnected = true;
        console.log(`SSH connection successful: ${this.connectionId}`);
        return result;
      } else {
        throw new Error('SSH connection failed');
      }
    } catch (error) {
      console.error('SSH connection error:', error);
      throw new Error(`SSH connection failed: ${error.message}`);
    }
  }

  async startShell() {
    if (!this.isConnected) {
      throw new Error('Not connected to SSH server');
    }

    try {
      const result = await window.electronAPI.sshStartShell(this.connectionId);
      return result;
    } catch (error) {
      throw new Error(`Failed to start shell: ${error.message}`);
    }
  }

  write(data) {
    if (!this.isConnected) {
      return;
    }
    
    window.electronAPI.sshWrite(this.connectionId, data);
  }

  disconnect() {
    if (this.isConnected && this.connectionId) {
      window.electronAPI.sshDisconnect(this.connectionId);
      this.isConnected = false;
      this.connectionId = null;
    }
  }
}

// Class for Serial connection management
class SerialConnection {
  constructor() {
    this.connectionId = null;
    this.isConnected = false;
    this.sessionId = null;
  }

  async connect(options) {
    try {
      this.sessionId = Date.now().toString();
      const result = await window.electronAPI.serialConnect(this.sessionId, options);
      
      if (result.success) {
        this.connectionId = this.sessionId;
        this.isConnected = true;
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      throw new Error(`Serial connection failed: ${error.message}`);
    }
  }

  async startShell() {
    // Serial connections don't need shell initialization
    return Promise.resolve();
  }

  write(data) {
    if (!this.isConnected) {
      return;
    }
    
    window.electronAPI.serialWrite(this.connectionId, data);
  }

  disconnect() {
    if (this.isConnected && this.connectionId) {
      window.electronAPI.serialDisconnect(this.connectionId);
      this.isConnected = false;
      this.connectionId = null;
    }
  }
}

function App() {
  // Session management state
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
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
  
  // Theme-related state
  const [theme, setTheme] = useState(
    localStorage.getItem('ash-theme') || 'terminus'
  );
  const [showSettings, setShowSettings] = useState(false);
  
  // Unified theme definitions
  const themes = {
    terminus: {
      name: 'Terminus',
      // UI colors
      background: '#000000',
      surface: '#000000',
      text: '#00ff41',
      border: '#1a1a1a',
      accent: '#00ff41',
      // Terminal colors - pure black background with bright green text
      terminal: {
        background: '#000000',
        foreground: '#00ff41',
        cursor: '#00ff41',
        cursorAccent: '#000000',
        selection: '#1a3a1a',
        black: '#000000',
        red: '#ff0000',
        green: '#00ff41',
        yellow: '#ffff00',
        blue: '#0000ff',
        magenta: '#ff00ff',
        cyan: '#00ffff',
        white: '#00ff41',
        brightBlack: '#555555',
        brightRed: '#ff5555',
        brightGreen: '#00ff41',
        brightYellow: '#ffff55',
        brightBlue: '#5555ff',
        brightMagenta: '#ff55ff',
        brightCyan: '#55ffff',
        brightWhite: '#00ff41'
      }
    },
    dark: {
      name: 'Dark',
      // UI colors
      background: '#1e1e1e',
      surface: '#2c3e50',
      text: '#ffffff',
      border: '#34495e',
      accent: '#4a90e2',
      // Terminal colors
      terminal: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selection: '#264f78'
      }
    },
    light: {
      name: 'Light',
      // UI colors
      background: '#f8f9fa',
      surface: '#ffffff',
      text: '#333333',
      border: '#e0e0e0',
      accent: '#4a90e2',
      // Terminal colors
      terminal: {
        background: '#ffffff',
        foreground: '#000000',
        cursor: '#000000',
        selection: '#add6ff'
      }
    },
    solarized_dark: {
      name: 'Solarized Dark',
      // UI colors
      background: '#002b36',
      surface: '#073642',
      text: '#839496',
      border: '#586e75',
      accent: '#268bd2',
      // Terminal colors
      terminal: {
        background: '#002b36',
        foreground: '#839496',
        cursor: '#839496',
        selection: '#073642'
      }
    },
    solarized_light: {
      name: 'Solarized Light',
      // UI colors
      background: '#fdf6e3',
      surface: '#eee8d5',
      text: '#657b83',
      border: '#93a1a1',
      accent: '#268bd2',
      // Terminal colors
      terminal: {
        background: '#fdf6e3',
        foreground: '#657b83',
        cursor: '#657b83',
        selection: '#eee8d5'
      }
    },
    monokai: {
      name: 'Monokai',
      // UI colors
      background: '#272822',
      surface: '#3e3d32',
      text: '#f8f8f2',
      border: '#49483e',
      accent: '#a6e22e',
      // Terminal colors
      terminal: {
        background: '#272822',
        foreground: '#f8f8f2',
        cursor: '#f8f8f2',
        selection: '#49483e'
      }
    }
  };

  // Theme change function
  const changeTheme = (themeKey) => {
    setTheme(themeKey);
    localStorage.setItem('ash-theme', themeKey);
    
    // Update theme for all existing terminals
    Object.keys(terminalInstances.current).forEach(sessionId => {
      const terminal = terminalInstances.current[sessionId];
      if (terminal) {
        terminal.options.theme = themes[themeKey].terminal;
        // Force a refresh by writing a zero-width space and clearing it
        terminal.refresh(0, terminal.rows - 1);
      }
    });
  };
  
  // Terminal-related refs
  const terminalRefs = useRef({});
  const terminalInstances = useRef({});
  const fitAddons = useRef({});
  const sshConnections = useRef({});
  const sessionLogs = useRef({}); // Store logs for each session
  const [logStates, setLogStates] = useState({}); // Track logging state for UI updates
  
  // Resize handle refs
  const resizeHandleRef = useRef(null);
  const isResizing = useRef(false);

  // Connection history and favorites
  const [connectionHistory, setConnectionHistory] = useState(
    JSON.parse(localStorage.getItem('ssh-connections') || '[]')
  );
  const [favorites, setFavorites] = useState(
    JSON.parse(localStorage.getItem('ssh-favorites') || '[]')
  );

  // Save connection history
  const saveConnectionHistory = (connection) => {
    // Remove password if save password option is not checked
    const connectionToSave = {
      ...connection,
      password: connection.savePassword ? connection.password : ''
    };
    
    const newHistory = [connectionToSave, ...connectionHistory.filter(c => 
      !(c.host === connection.host && c.user === connection.user)
    )].slice(0, 20); // Store maximum 20 items
    
    setConnectionHistory(newHistory);
    localStorage.setItem('ssh-connections', JSON.stringify(newHistory));
  };

  // Toggle favorite
  const toggleFavorite = (connection) => {
    const isFavorite = favorites.some(f => 
      f.host === connection.host && f.user === connection.user
    );
    
    if (isFavorite) {
      const newFavorites = favorites.filter(f => 
        !(f.host === connection.host && f.user === connection.user)
      );
      setFavorites(newFavorites);
      localStorage.setItem('ssh-favorites', JSON.stringify(newFavorites));
    } else {
      const newFavorites = [...favorites, { ...connection, name: connection.sessionName || `${connection.user}@${connection.host}` }];
      setFavorites(newFavorites);
      localStorage.setItem('ssh-favorites', JSON.stringify(newFavorites));
    }
  };

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

  // Log management functions
  const appendToLog = async (sessionId, data) => {
    if (!sessionLogs.current[sessionId]) return;
    
    const logSession = sessionLogs.current[sessionId];
    logSession.content += data;
    logSession.bufferSize += data.length;
    logSession.lineCount += (data.match(/\n/g) || []).length;
    
    // Check if we need to flush to file
    const shouldFlush = logSession.lineCount >= 100 || logSession.bufferSize >= 10240; // 10KB
    
    if (shouldFlush && logSession.isLogging) {
      await flushLogToFile(sessionId);
    }
  };

  const flushLogToFile = async (sessionId) => {
    const logSession = sessionLogs.current[sessionId];
    if (!logSession || !logSession.content) return;
    
    try {
      const session = sessions.find(s => s.id === sessionId);
      const sessionName = session ? session.name.replace(/[^a-zA-Z0-9]/g, '_') : `session_${sessionId}`;
      
      const result = await window.electronAPI.saveLogToFile(sessionId, logSession.content, sessionName);
      
      if (result.success) {
        logSession.filePath = result.filePath;
        console.log(`Log flushed to file: ${result.filePath}`);
        
        // Reset buffer
        logSession.content = '';
        logSession.bufferSize = 0;
        logSession.lineCount = 0;
      }
    } catch (error) {
      console.error('Failed to flush log to file:', error);
    }
  };

  const startLogging = (sessionId) => {
    if (!sessionLogs.current[sessionId]) {
      sessionLogs.current[sessionId] = {
        content: '',
        startTime: new Date().toISOString(),
        isLogging: true,
        bufferSize: 0,
        lineCount: 0,
        filePath: null
      };
    } else {
      sessionLogs.current[sessionId].isLogging = true;
    }
    
    // Update UI state
    setLogStates(prev => ({
      ...prev,
      [sessionId]: { isLogging: true }
    }));
    
    // Add log entry when starting
    const logEntry = `\r\n[${new Date().toLocaleTimeString()}] Logging started\r\n`;
    appendToLog(sessionId, logEntry);
  };

  const stopLogging = async (sessionId) => {
    if (sessionLogs.current[sessionId]) {
      sessionLogs.current[sessionId].isLogging = false;
    }
    
    // Update UI state
    setLogStates(prev => ({
      ...prev,
      [sessionId]: { isLogging: false }
    }));
    
    // Add log entry when stopping
    const logEntry = `\r\n[${new Date().toLocaleTimeString()}] Logging stopped\r\n`;
    await appendToLog(sessionId, logEntry);
    
    // Flush any remaining data to file
    await flushLogToFile(sessionId);
    
    if (terminalInstances.current[sessionId]) {
      terminalInstances.current[sessionId].write(logEntry);
    }
  };

  const saveLog = async (sessionId) => {
    if (sessionLogs.current[sessionId]) {
      // Flush current buffer to file first
      await flushLogToFile(sessionId);
      
      const logSession = sessionLogs.current[sessionId];
      if (logSession.filePath) {
        // Show success message with file path
        console.log(`Log saved to: ${logSession.filePath}`);
        alert(`Log saved to: ${logSession.filePath}`);
      } else {
        alert('No log data to save');
      }
    }
  };

  const clearLog = (sessionId) => {
    if (sessionLogs.current[sessionId]) {
      sessionLogs.current[sessionId].content = '';
      sessionLogs.current[sessionId].bufferSize = 0;
      sessionLogs.current[sessionId].lineCount = 0;
      sessionLogs.current[sessionId].filePath = null;
      console.log(`Log cleared for session ${sessionId}`);
    }
  };

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

  // Create new session
  const createNewSession = async () => {
    if (connectionForm.connectionType === 'ssh') {
      if (!connectionForm.host || !connectionForm.user) {
        alert('Host and Username are required.');
        return;
      }
    } else if (connectionForm.connectionType === 'serial') {
      if (!connectionForm.serialPort) {
        alert('Serial port is required.');
        return;
      }
    }

    setIsConnecting(true);
    
    try {
      const sessionId = Date.now().toString();
      const sessionName = connectionForm.connectionType === 'ssh' 
        ? (connectionForm.sessionName || `${connectionForm.user}@${connectionForm.host}`)
        : (connectionForm.sessionName || `Serial: ${connectionForm.serialPort}`);
      
      // Create connection based on type
      let connection;
      let session;
      
      if (connectionForm.connectionType === 'ssh') {
        connection = new SSHConnection();
        await connection.connect(
          connectionForm.host,
          connectionForm.port,
          connectionForm.user,
          connectionForm.password
        );
        
        session = {
          id: sessionId,
          name: sessionName,
          host: connectionForm.host,
          port: connectionForm.port,
          user: connectionForm.user,
          connectionType: 'ssh',
          isConnected: true,
          createdAt: new Date().toISOString()
        };
        
        // Save connection history
        saveConnectionHistory({
          host: connectionForm.host,
          port: connectionForm.port,
          user: connectionForm.user,
          password: connectionForm.password,
          sessionName: sessionName,
          savePassword: connectionForm.savePassword
        });
      } else if (connectionForm.connectionType === 'serial') {
        connection = new SerialConnection();
        await connection.connect({
          path: connectionForm.serialPort,
          baudRate: parseInt(connectionForm.baudRate),
          dataBits: parseInt(connectionForm.dataBits),
          stopBits: parseInt(connectionForm.stopBits),
          parity: connectionForm.parity,
          flowControl: connectionForm.flowControl
        });
        
        session = {
          id: sessionId,
          name: sessionName,
          serialPort: connectionForm.serialPort,
          baudRate: connectionForm.baudRate,
          connectionType: 'serial',
          isConnected: true,
          createdAt: new Date().toISOString()
        };
      }
      
      // Common session setup
      setSessions(prev => [...prev, session]);
      setActiveSessionId(sessionId);
      sshConnections.current[sessionId] = connection; // Store both SSH and Serial connections
      
      // Reset form
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
      setIsConnecting(false);
      
    } catch (error) {
      console.error('Connection failed:', error);
      setIsConnecting(false);
      alert('Connection failed: ' + error.message);
    }
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
    const charHeight = fontSize * 1.4; // Use line-height from CSS
    
    const cols = Math.floor(terminalElement.clientWidth / charWidth);
    const rows = Math.floor(terminalElement.clientHeight / charHeight);
    
    console.log(`Terminal init: ${cols}x${rows} (container: ${terminalElement.clientWidth}x${terminalElement.clientHeight}, font: ${fontSize}px, char: ${charWidth}x${charHeight}px)`);

    // Get the current theme configuration
    const currentTheme = themes[theme].terminal;
    
    const terminal = new Terminal({
      cols: Math.max(cols - 2, 80), // Account for rounding errors
      rows: Math.max(rows - 2, 24), // Account for rounding errors
      cursorBlink: true,
      scrollback: 1000,
      theme: currentTheme,
      fontSize: 13,
      fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace",
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      letterSpacing: 0,
      lineHeight: 1.4
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

    // Handle terminal input
    terminal.onData(async (data) => {
      // Log the input data if logging is enabled for this session
      if (sessionLogs.current[sessionId] && sessionLogs.current[sessionId].isLogging) {
        await appendToLog(sessionId, data);
      }
      
      if (sshConnections.current[sessionId]) {
        sshConnections.current[sessionId].write(data);
      }
    });
  };

  // Switch active session
  const switchToSession = (sessionId) => {
    setActiveSessionId(sessionId);
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
    if (sessionLogs.current[sessionId]) {
      // Flush any remaining data before cleanup
      if (sessionLogs.current[sessionId].isLogging) {
        await flushLogToFile(sessionId);
      }
      delete sessionLogs.current[sessionId];
    }
    
    // Clean up log states
    setLogStates(prev => {
      const newStates = { ...prev };
      delete newStates[sessionId];
      return newStates;
    });
    
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    
    if (activeSessionId === sessionId) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      setActiveSessionId(remainingSessions.length > 0 ? remainingSessions[0].id : null);
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





  // Global event listeners - register once
  useEffect(() => {

    const handleSerialData = async (event, receivedSessionId, data) => {
      if (terminalInstances.current[receivedSessionId]) {
        terminalInstances.current[receivedSessionId].write(data);
        
        // Log the data if logging is enabled for this session
        if (sessionLogs.current[receivedSessionId] && sessionLogs.current[receivedSessionId].isLogging) {
          await appendToLog(receivedSessionId, data);
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

  // Cleanup resize event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Apply theme with CSS variables
  const currentTheme = themes[theme];
  
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
                onClick={() => setShowConnectionForm(true)}
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
              {favorites.map((fav, index) => (
                <div 
                  key={index}
                  className="session-item favorite"
                  onClick={() => connectFromHistory(fav)}
                  title={`${fav.user}@${fav.host}`}
                >
                  <span className="session-name">⭐ {fav.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Active sessions */}
          {sessions.length > 0 && (
            <div className="section">
              <div className="section-header">Active Sessions</div>
              {sessions.map(session => (
                <div 
                  key={session.id}
                  className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
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
                      onClick={() => {
                        if (logStates[activeSessionId]?.isLogging) {
                          stopLogging(activeSessionId);
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
              <div className="terminal-content-container" style={{ flex: 1, position: 'relative' }}>
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
                onClick={() => setShowConnectionForm(true)}
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
                onClick={() => setShowConnectionForm(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); createNewSession(); }}>
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