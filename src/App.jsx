import React, { useState, useRef, useEffect, useCallback, useMemo, startTransition } from 'react';
import '@xterm/xterm/css/xterm.css';
import './App.css';

import { SSHConnection } from './connections/SSHConnection';
import { SerialConnection } from './connections/SerialConnection';
import { useTheme } from './hooks/useTheme';
import { useConnectionHistory } from './hooks/useConnectionHistory';
import { parseIperfLine } from './utils/iperfParser';
import { useLogging } from './hooks/useLogging';
import { useStopwatch } from './hooks/useStopwatch';
import { useGroups } from './hooks/useGroups';
import { useLibraries } from './hooks/useLibraries';
import { useSerialPorts } from './hooks/useSerialPorts';
import { useLLMSettings } from './hooks/useLLMSettings';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWindowControls } from './hooks/useWindowControls';
import { useMenuHandlers } from './hooks/useMenuHandlers';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useTerminalManagement } from './hooks/useTerminalManagement';
import { useConnectionManagement } from './hooks/useConnectionManagement';
import { useAppHandlers } from './hooks/useAppHandlers';
// import { useAICommand } from './hooks/useAICommand';
import { useBackendStatus } from './hooks/useBackendStatus';
import { CustomTitleBar } from './components/CustomTitleBar';
import { SessionManager } from './components/SessionManager';
import { TerminalView } from './components/TerminalView';
import { ConnectionForm } from './components/ConnectionForm';
import { Settings } from './components/Settings';
import { GroupNameDialog } from './components/GroupNameDialog';
import { StatusBar } from './components/StatusBar';
import { AboutDialog } from './components/AboutDialog';
import { LicensesDialog } from './components/LicensesDialog';
import { ErrorDialog } from './components/ErrorDialog';
import { MessageDialog } from './components/MessageDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { TerminalContextMenu } from './components/TerminalContextMenu';
import { TerminalSearchBar } from './components/TerminalSearchBar';
// TerminalAICommandInput is now replaced by AIChatSidebar
// Sidebars are now in SessionContent
import { SessionDialog } from './components/SessionDialog';
import { LibraryDialog } from './components/LibraryDialog';
import { LibraryImportDialog } from './components/LibraryImportDialog';
import { TftpServerDialog } from './components/TftpServerDialog';
import { WebServerDialog } from './components/WebServerDialog';
import { IperfServerDialog } from './components/IperfServerDialog';
import { FileUploadDialog } from './components/FileUploadDialog';

function App() {
  // Session management state
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [reconnectingSessions, setReconnectingSessions] = useState(new Map());

  // Connection refs
  const sshConnections = useRef({});

  // Use custom hooks
  const {
    groups,
    setGroups,
    saveGroups,
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
    removeSessionFromGroup,
    matchSavedSessionWithActiveSession
  } = useGroups();

  // Wrapper for addSessionToGroup to find session
  const addSessionToGroup = (sessionId, groupId, skipSavedSessions = false) => {
    const session = sessions.find(s => s.id === sessionId);
    addSessionToGroupHook(sessionId, groupId, session, skipSavedSessions);
  };

  // Disconnect all sessions in a group (but keep the group and savedSessions)
  const handleDisconnectGroup = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    // Find all active sessions that belong to this group
    const savedSessions = group.savedSessions || [];
    const groupSessions = sessions.filter(session => {
      return savedSessions.some(savedSession =>
        matchSavedSessionWithActiveSession(savedSession, session)
      );
    });

    // Disconnect all sessions in the group
    groupSessions.forEach(session => {
      if (session.isConnected) {
        disconnectSession(session.id);
      }
    });
  };

  // Delete group completely (remove group and savedSessions from localStorage)
  const handleDeleteGroup = (groupId) => {
    deleteGroup(groupId);
  };

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
  const [connectionForm, setConnectionForm] = useState({
    connectionType: 'ssh', // 'ssh' or 'serial'
    host: '',
    port: '22',
    user: '',
    password: '',
    sessionName: '',
    savePassword: false,
    useTelnet: false, // Use Telnet instead of SSH
    // Serial port specific fields
    serialPort: '',
    baudRate: '9600',
    dataBits: '8',
    stopBits: '1',
    parity: 'none',
    flowControl: 'none',
    // Post-processing
    postProcessing: [],
    postProcessingEnabled: true,
    // Auto-reconnect
    autoReconnect: false
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [showSessionManager, setShowSessionManager] = useState(true);
  const [sessionManagerWidth, setSessionManagerWidth] = useState(250);
  const [isResizingState, setIsResizingState] = useState(false);

  const isWindows = window.electronAPI?.platform !== 'darwin';

  // Use custom hooks
  const { connectionHistory, favorites, saveConnectionHistory, toggleFavorite, removeConnection } = useConnectionHistory();
  const { sessionLogs, logStates, appendToLog, startLogging, stopLogging, saveLog, clearLog, cleanupLog } = useLogging(sessions, groups);
  const { getStopwatchState, startStopwatch, stopStopwatch, resetStopwatch, cleanupStopwatch } = useStopwatch();
  const { availableSerialPorts, loadSerialPorts } = useSerialPorts();

  // Libraries hook
  const {
    libraries,
    createLibrary,
    updateLibrary,
    deleteLibrary,
    toggleLibraryExpanded,
    importLibrary
  } = useLibraries();

  // LLM Settings hook
  const {
    llmSettings,
    updateLlmSettings
  } = useLLMSettings();

  const [showSettings, setShowSettings] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showLicensesDialog, setShowLicensesDialog] = useState(false);
  const [messageDialog, setMessageDialog] = useState({ isOpen: false, type: 'info', title: '', message: '', detail: '' });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [showTftpServerDialog, setShowTftpServerDialog] = useState(false);
  const [tftpStatus, setTftpStatus] = useState({ running: false, port: null });

  const [showWebServerDialog, setShowWebServerDialog] = useState(false);
  const [webStatus, setWebStatus] = useState({ running: false, port: null });
  const [iperfStatus, setIperfStatus] = useState({ running: false, port: null });
  const [iperfClientStatus, setIperfClientStatus] = useState({ running: false });
  const [iperfClientOutput, setIperfClientOutput] = useState(''); // Persistent output data
  const [iperfLongTermData, setIperfLongTermData] = useState([]);

  // Aggregation state refs
  const aggregationBuffer = useRef([]); // Stores bandwidth values for current interval
  const lineBufferForAggregation = useRef(''); // Buffer for partial lines
  const lastAggregationTime = useRef(Date.now());

  const [showIperfServerDialog, setShowIperfServerDialog] = useState(false);
  // Iperf Client Sidebar is now session state, but we need compatibility for menu handlers
  // Iperf Client Sidebar is now session state, but we need compatibility for menu handlers
  const setShowIperfClientSidebar = useCallback((val) => {
    console.log('[App] setShowIperfClientSidebar called:', val, 'activeSessionId:', activeSessionId);
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const visible = typeof val === 'function' ? val(s.iperfSidebarVisible) : val;
        console.log(`[App] Updating session ${s.id} iperfSidebarVisible to:`, visible);
        // Also sync activeSecondaryTab if showing
        const updates = { iperfSidebarVisible: visible };
        if (visible) updates.activeSecondaryTab = 'iperf-client';
        return { ...s, ...updates };
      }
      return s;
    }));
  }, [activeSessionId]);
  const setShowNetcatSidebar = useCallback((val) => {
    console.log('[App] setShowNetcatSidebar called:', val, 'activeSessionId:', activeSessionId);
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const visible = typeof val === 'function' ? val(s.netcatSidebarVisible) : val;
        const updates = { netcatSidebarVisible: visible };
        if (visible) updates.activeSecondaryTab = 'netcat';
        return { ...s, ...updates };
      }
      return s;
    }));
  }, [activeSessionId]);
  // const [iperfClientSidebarWidth, setIperfClientSidebarWidth] = useState(500);
  const [iperfAvailable, setIperfAvailable] = useState(true); // Default to true, will be checked on mount
  const [appInfo, setAppInfo] = useState({ version: '', author: { name: 'Bryce Ghim', email: 'admin@toktoktalk.com' } });

  // Load app info on mount
  useEffect(() => {
    const loadAppInfo = async () => {
      try {
        const info = await window.electronAPI.getAppInfo();
        if (info.success) {
          setAppInfo({
            version: info.version,
            author: info.author,
          });
        }
      } catch (error) {
        console.error('Failed to load app info:', error);
      }
    };
    loadAppInfo();
  }, []);

  // Load TFTP server status on mount and periodically check
  useEffect(() => {
    const loadTftpStatus = async () => {
      try {
        const status = await window.electronAPI?.tftpStatus?.();
        if (status) {
          setTftpStatus(status);
        }
      } catch (error) {
        console.error('Failed to load TFTP status:', error);
      }
    };

    // Load immediately
    loadTftpStatus();

    // Check periodically (every 10 seconds to reduce overhead)
    const interval = setInterval(loadTftpStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  // Load Web server status on mount and periodically check
  useEffect(() => {
    const loadWebStatus = async () => {
      try {
        const status = await window.electronAPI?.webStatus?.();
        if (status) {
          setWebStatus(status);
        }
      } catch (error) {
        console.error('Failed to load Web Server status:', error);
      }
    };

    // Load immediately
    loadWebStatus();

    // Check periodically (every 10 seconds to reduce overhead)
    const interval = setInterval(loadWebStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  // Check iperf3 availability on mount
  useEffect(() => {
    const checkIperf3Available = async () => {
      try {
        const result = await window.electronAPI?.iperfCheckAvailable?.();
        if (result !== undefined) {
          setIperfAvailable(result.available);
        }
      } catch (error) {
        console.error('Failed to check iperf3 availability:', error);
        setIperfAvailable(false);
      }
    };

    checkIperf3Available();
  }, []);

  // Load iperf3 server status on mount and periodically check
  useEffect(() => {
    const loadIperfStatus = async () => {
      try {
        const status = await window.electronAPI?.iperfStatus?.();
        if (status) {
          setIperfStatus(status);
        }
      } catch (error) {
        console.error('Failed to load iperf3 status:', error);
      }
    };

    // Load immediately
    loadIperfStatus();

    // Check periodically (every 10 seconds to reduce overhead)
    const interval = setInterval(loadIperfStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  // Load iperf3 client status for active session on mount and periodically check
  useEffect(() => {
    const loadIperfClientStatus = async () => {
      if (!activeSessionId) return;
      try {
        const status = await window.electronAPI?.iperfClientStatus?.({ sessionId: activeSessionId });
        if (status) {
          setIperfClientStatus(status);
        }
      } catch (error) {
        console.error('Failed to load iperf3 client status:', error);
      }
    };

    // Load immediately
    loadIperfClientStatus();

    // Check periodically (every 10 seconds to reduce overhead)
    const interval = setInterval(loadIperfClientStatus, 10000);

    // Listen for client start/stop events to update status immediately
    // Events now include sessionId, so we update only the relevant session
    const handleClientStarted = (data) => {
      const eventSessionId = data?.sessionId;
      if (eventSessionId) {
        // Update session's iperf client running state
        setSessions(prev => prev.map(s => {
          if (s.id === eventSessionId) {
            return { ...s, iperfClientRunning: true };
          }
          return s;
        }));
      }
      // Also reload global status if it's for the active session
      if (eventSessionId === activeSessionId) {
        loadIperfClientStatus();
      }
    };

    const handleClientStopped = (data) => {
      const eventSessionId = data?.sessionId;
      if (eventSessionId) {
        // Update session's iperf client running state and append final output
        setSessions(prev => prev.map(s => {
          if (s.id === eventSessionId) {
            const updates = { iperfClientRunning: false };
            if (data.output) {
              updates.iperfClientOutput = (s.iperfClientOutput || '') + data.output;
            }
            return { ...s, ...updates };
          }
          return s;
        }));
      }
      // Also reload global status if it's for the active session
      if (eventSessionId === activeSessionId) {
        loadIperfClientStatus();
        if (data?.output) {
          setIperfClientOutput(prev => prev + data.output);
        }
      }
    };

    // Listen for client output events - update only the session that owns the output
    const handleClientOutput = (data) => {
      const eventSessionId = data?.sessionId;
      if (!eventSessionId || !data?.output) return;

      const MAX_OUTPUT_LENGTH = 100000; // Limit buffer to ~100KB

      // Helper to truncate output from the start (keeping newest)
      const truncate = (current, newText) => {
        const combined = (current || '') + newText;
        if (combined.length > MAX_OUTPUT_LENGTH) {
          return combined.slice(combined.length - MAX_OUTPUT_LENGTH);
        }
        return combined;
      };

      // Update the specific session's output
      setSessions(prev => prev.map(s => {
        if (s.id === eventSessionId) {
          return { ...s, iperfClientOutput: truncate(s.iperfClientOutput, data.output) };
        }
        return s;
      }));

      // If this is for the active session, also update global state for display
      if (eventSessionId === activeSessionId) {
        setIperfClientOutput(prev => truncate(prev, data.output));

        // --- Aggregation Logic (global, for History graph) ---
        lineBufferForAggregation.current += data.output;
        if (lineBufferForAggregation.current.includes('\n')) {
          const lines = lineBufferForAggregation.current.split('\n');
          lineBufferForAggregation.current = lines.pop();
          lines.forEach(line => {
            const parsed = parseIperfLine(line);
            if (parsed) aggregationBuffer.current.push(parsed.bandwidth);
          });
        }
        const AGGREGATION_INTERVAL = 1800000; // 30 minutes for aggregation
        const now = Date.now();
        if (now - lastAggregationTime.current >= AGGREGATION_INTERVAL) {
          if (aggregationBuffer.current.length > 0) {
            const sum = aggregationBuffer.current.reduce((a, b) => a + b, 0);
            const avg = sum / aggregationBuffer.current.length;
            const min = Math.min(...aggregationBuffer.current);
            const max = Math.max(...aggregationBuffer.current);
            setIperfLongTermData(prev => {
              const newData = [...prev, { time: now, bandwidth: avg, min, max }];
              return newData.slice(-500);
            });
            aggregationBuffer.current = [];
          }
          lastAggregationTime.current = now;
        }
        // -------------------------
      }
    };

    const startedHandler = window.electronAPI?.onIperfClientStarted?.(handleClientStarted);
    const stoppedHandler = window.electronAPI?.onIperfClientStopped?.(handleClientStopped);
    const outputHandler = window.electronAPI?.onIperfClientOutput?.(handleClientOutput);

    return () => {
      clearInterval(interval);
      if (startedHandler) {
        window.electronAPI?.offIperfClientStarted?.(handleClientStarted);
      }
      if (stoppedHandler) {
        window.electronAPI?.offIperfClientStopped?.(handleClientStopped);
      }
      if (outputHandler) {
        window.electronAPI?.offIperfClientOutput?.(handleClientOutput);
      }
    };
  }, [activeSessionId]);

  // Listen for Web Server error events
  useEffect(() => {
    const handleWebServerError = (errorData) => {
      setErrorDialog({
        isOpen: true,
        title: errorData.title || 'Web Server Error',
        message: errorData.message || 'An error occurred',
        detail: errorData.detail || '',
        error: errorData.error || null
      });
    };

    window.electronAPI?.onWebServerError?.(handleWebServerError);

    return () => {
      window.electronAPI?.offWebServerError?.(handleWebServerError);
    };
  }, []);

  // Listen for TFTP Server error events
  useEffect(() => {
    const handleTftpServerError = (errorData) => {
      setErrorDialog({
        isOpen: true,
        title: errorData.title || 'TFTP Server Error',
        message: errorData.message || 'An error occurred',
        detail: errorData.detail || '',
        error: errorData.error || null
      });
    };

    window.electronAPI?.onTftpServerError?.(handleTftpServerError);

    return () => {
      window.electronAPI?.offTftpServerError?.(handleTftpServerError);
    };
  }, []);

  // Terminal context menu state
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    sessionId: null,
  });

  // Terminal search state
  const [showSearchBar, setShowSearchBar] = useState(false);
  // AI Command input state
  // AI Command input state - Derived from active session
  const showAICommandInput = activeSessionId ? (sessions.find(s => s.id === activeSessionId)?.aiSidebarVisible || false) : false;

  const setShowAICommandInput = (val) => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const visible = typeof val === 'function' ? val(s.aiSidebarVisible) : val;
        // Also sync activeSecondaryTab if showing
        const updates = { aiSidebarVisible: visible };
        if (visible) updates.activeSecondaryTab = 'ai-chat';
        return { ...s, ...updates };
      }
      return s;
    }));
  };

  // Aliases for compatibility if needed
  const showAIChatSidebar = showAICommandInput;
  const setShowAIChatSidebar = setShowAICommandInput;

  // const [activeSecondaryTab, setActiveSecondaryTab] = useState('ai-chat'); // 'ai-chat' | 'iperf-client'
  // const [isAIProcessing, setIsAIProcessing] = useState(false);
  // const [aiMessages, setAiMessages] = useState([]);
  // If the user explicitly closes the AI sidebar, don't auto-reopen until settings change
  // const aiSidebarAutoRef = useRef({ dismissed: false, sig: '' });
  // Pending user request state (for AI Ask User tool)
  const [pendingUserRequest, setPendingUserRequest] = useState(null);

  // Listen for Ask User requests from Agent
  useEffect(() => {
    const handleAskUser = (data) => {
      console.log('Received Ask User request:', data);
      setPendingUserRequest({
        requestId: data.requestId,
        question: data.question,
        isPassword: data.isPassword
      });
      // Auto-open sidebar for active session when request comes in
      if (activeSessionId) {
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId ? { ...s, aiSidebarVisible: true, activeSecondaryTab: 'ai-chat' } : s
        ));
      }
    };

    window.electronAPI?.onAskUser?.(handleAskUser);

    return () => {
      window.electronAPI?.offAskUser?.(handleAskUser);
    };
  }, [activeSessionId]); // Add activeSessionId dependency

  const handleAskUserResponse = async (response) => {
    try {
      if (pendingUserRequest?.requestId) {
        await window.electronAPI.sendAskUserResponse(pendingUserRequest.requestId, response);
        setPendingUserRequest(null); // Clear request after responding
      }
    } catch (err) {
      console.error('Failed to send ask user response:', err);
    }
  };

  const [errorDialog, setErrorDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    detail: '',
    error: null
  });
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDialogContext, setSessionDialogContext] = useState(null); // { groupId, savedSessionId } when opened from group
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);
  const [showFileUploadDialog, setShowFileUploadDialog] = useState(false);
  const [fileUploadInitialPath, setFileUploadInitialPath] = useState(null);
  const [showLibraryImportDialog, setShowLibraryImportDialog] = useState(false);
  const [selectedLibrary, setSelectedLibrary] = useState(null);
  const [scrollbackLines, setScrollbackLines] = useState(() => {
    const saved = localStorage.getItem('ash-scrollback');
    return saved ? parseInt(saved, 10) : 5000;
  });



  const [terminalBufferLimit, setTerminalBufferLimit] = useState(() => {
    const saved = localStorage.getItem('ash-terminal-buffer-limit');
    return saved ? parseInt(saved, 10) : 500;
  });
  const [maxOutputSize, setMaxOutputSize] = useState(() => {
    const saved = localStorage.getItem('ash-max-output-size');
    return saved ? parseInt(saved, 10) : 1024 * 1024; // Default 1MB
  });

  // Sync maxOutputSize to main process
  useEffect(() => {
    window.electronAPI?.updateSSHSettings?.({ maxOutputSize });
  }, [maxOutputSize]);
  const [terminalFontSize, setTerminalFontSize] = useState(() => {
    const saved = localStorage.getItem('ash-terminal-font-size');
    return saved ? parseInt(saved, 10) : 13;
  });
  const [terminalFontFamily, setTerminalFontFamily] = useState(() => {
    const saved = localStorage.getItem('ash-terminal-font-family');
    return saved || "'Source Code Pro', 'Courier New', monospace";
  });
  const [uiFontFamily, setUiFontFamily] = useState(() => {
    const saved = localStorage.getItem('ash-ui-font-family');
    return saved || "'Verdana', sans-serif";
  });
  const [autoReconnect, setAutoReconnect] = useState(() => {
    const saved = localStorage.getItem('ash-auto-reconnect');
    return saved !== null ? saved === 'true' : true; // Default: enabled
  });
  const [reconnectRetry, setReconnectRetry] = useState(() => {
    const saved = localStorage.getItem('ash-reconnect-retry');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { enabled: true, interval: 1000, maxAttempts: 60 };
      }
    }
    return { enabled: true, interval: 1000, maxAttempts: 60 }; // Default: enabled, 1s interval, 60 attempts
  });


  // Create a ref for terminalInstances that useTheme can use
  const terminalInstancesRef = useRef({});

  // Theme hook - call first, but pass ref that will be updated
  const { theme, setTheme: changeTheme, currentTheme, themes } = useTheme(terminalInstancesRef);

  // Create ref for onSshClose callback to avoid circular dependency
  const onSshCloseRef = useRef(null);

  // Terminal management hook - now can use theme and themes
  const {
    terminalRefs,
    terminalInstances,
    fitAddons,
    searchAddons,
    initializeTerminal,
    resizeTerminal,
    cleanupTerminal,
    updateConnectionIdMap
  } = useTerminalManagement({
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
    showAICommandInput,
    onSshClose: onSshCloseRef.current,
    terminalBufferLimit
  });

  // Update ref for useTheme after terminalInstances is available
  useEffect(() => {
    terminalInstancesRef.current = terminalInstances;
  }, [terminalInstances]);

  // Window controls hook
  const { isMaximized, handleMinimize, handleMaximize, handleClose } = useWindowControls(isWindows);

  // Connection management hook
  const {
    createNewSessionWithData,
    disconnectSession,
    connectGroup,
    handleDetachTab,
    reconnectSession
  } = useConnectionManagement({
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
    initializeTerminal,
    cleanupLog,
    cleanupStopwatch,
    setErrorDialog,
    reconnectRetry,
    updateConnectionIdMap
  });




  // Active Session Memo - Moved up to be available for useKeyboardShortcuts
  const activeSession = useMemo(() =>
    sessions.find(s => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  // Reconnect handler - used by both F5 key press and auto-reconnect
  // This ensures that auto-reconnect behaves exactly like pressing F5
  const onReconnectSession = useCallback(async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Mark as reconnecting
    setReconnectingSessions(prev => {
      const next = new Map(prev);
      next.set(sessionId, true);
      return next;
    });

    try {
      await reconnectSession(session);

      // Update connectionId map after reconnection
      if (updateConnectionIdMap) {
        updateConnectionIdMap();
      }

      // Success message is already shown in reconnectSSHSession
    } catch (error) {
      // Error is already handled by reconnectSession (shows error dialog)
      console.error('Reconnection failed:', error);
    } finally {
      // Remove from reconnecting map
      setReconnectingSessions(prev => {
        const next = new Map(prev);
        next.delete(sessionId);
        return next;
      });
    }
  }, [sessions, reconnectSession, setReconnectingSessions, updateConnectionIdMap]);

  // Keyboard shortcuts hook (must be after useConnectionManagement to access reconnectSession)
  useKeyboardShortcuts({
    activeSessionId,
    showSearchBar,
    setShowSearchBar,
    // showSearchBar is defined in useKeyboardShortcuts parameters
    showAICommandInput: activeSession ? !!activeSession.aiSidebarVisible : false,
    setShowAICommandInput: (val) => {
      // Compatibility for shortcuts calling this
      if (!activeSessionId) return;
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          const visible = typeof val === 'function' ? val(s.aiSidebarVisible) : val;
          return { ...s, aiSidebarVisible: visible, activeSecondaryTab: 'ai-chat' };
        }
        return s;
      }));
    },
    // showAIChatSidebar aliases to showAICommandInput in logic now, keeping consistent
    showAIChatSidebar: activeSession ? !!activeSession.aiSidebarVisible : false,
    setShowAIChatSidebar: (val) => {
      if (!activeSessionId) return;
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          const visible = typeof val === 'function' ? val(s.aiSidebarVisible) : val;
          return { ...s, aiSidebarVisible: visible, activeSecondaryTab: 'ai-chat' };
        }
        return s;
      }));
    },
    llmSettings,
    terminalInstances,
    terminalFontSize,
    setTerminalFontSize,
    resizeTerminal,
    onReconnectSession,
    sessions,
    reconnectingSessions
  });

  // Handle SSH close for auto-reconnect (must be after useConnectionManagement to access reconnectSession)
  // This function is called when "SSH connection closed." message appears
  // It should trigger the same behavior as pressing F5 if autoReconnect is enabled
  const handleSshCloseForReconnect = useCallback((sessionId, connectionId) => {
    console.log('[Auto-reconnect] handleSshCloseForReconnect called, sessionId:', sessionId, 'connectionId:', connectionId);

    // Find session by sessionId
    const foundSession = sessions.find(s => s.id === sessionId);

    if (!foundSession) {
      console.log('[Auto-reconnect] Session not found for sessionId:', sessionId);
      return;
    }

    console.log('[Auto-reconnect] Found session:', foundSession.id, foundSession.name, 'session autoReconnect:', foundSession.autoReconnect);

    // Update session state to disconnected
    setSessions(prev => prev.map(s =>
      s.id === foundSession.id ? { ...s, isConnected: false } : s
    ));

    // Auto-reconnect: Check session-specific setting first, fallback to global setting for backward compatibility
    const shouldAutoReconnect = foundSession.autoReconnect !== undefined
      ? foundSession.autoReconnect
      : autoReconnect;

    if (!shouldAutoReconnect) {
      console.log('[Auto-reconnect] Auto-reconnect is disabled for this session, skipping');
      return;
    }

    // Use the same path as F5 key press - call onReconnectSession which is the same handler
    // This ensures consistency: auto-reconnect behaves exactly like pressing F5
    console.log('[Auto-reconnect] SSH connection closed, will attempt reconnect (same as F5) for session:', foundSession.id);

    // Small delay before attempting reconnect (same as manual F5 behavior)
    setTimeout(() => {
      // Check if already reconnecting
      if (reconnectingSessions?.has(foundSession.id)) {
        console.log('[Auto-reconnect] Already reconnecting, skipping');
        return;
      }

      // Call the same handler that F5 uses - this ensures identical behavior
      // onReconnectSession is the exact same function called when F5 is pressed
      if (onReconnectSession) {
        onReconnectSession(foundSession.id);
      }
    }, 500); // 500ms delay before auto-reconnect
  }, [autoReconnect, sessions, setSessions, reconnectingSessions, onReconnectSession]);

  // Update onSshClose ref when handleSshCloseForReconnect changes
  useEffect(() => {
    onSshCloseRef.current = handleSshCloseForReconnect;
  }, [handleSshCloseForReconnect]);

  // Drag and drop hook
  const {
    draggedSessionId,
    dragOverGroupId,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDropOnNewGroup
  } = useDragAndDrop({
    sessions,
    addSessionToGroup,
    addSavedSessionToGroup,
    createNewSessionWithData,
    connectionForm,
    setConnectionForm,
    createGroup,
    setShowGroupNameDialog,
    setNewGroupName,
    setPendingSessionForGroup
  });

  // Backend status monitoring (only when AI Chat Sidebar is visible)
  const { status: backendStatus, setStarting: setBackendStarting } = useBackendStatus(showAIChatSidebar);



  // Resize handle refs
  const resizeHandleRef = useRef(null);
  const isResizing = useRef(false);
  const isInitialGroupsLoad = useRef(true);
  const resizeTerminalTimeoutRef = useRef(null);

  // Connection history and favorites
  // Connection history and favorites are managed by useConnectionHistory hook

  // App handlers hook
  const {
    handleInputChange,
    handleMouseDown: handleMouseDownBase,
    handleMouseUp: handleMouseUpBase,
    handleShowSettings,
    handleShowConnectionForm,
    handleCloseConnectionForm,
    handleCloseSettings,
    handleConnectionFormSubmit,
    handleConnectionTypeChange,
    handleSavePasswordChange,
    connectFromHistory,
    handleCreateGroupFromDialog,
    handleCloseGroupDialog,
    handleGroupNameChange,
    handleGroupDialogKeyDown,
    handleScrollbackChange,
    handleTerminalFontSizeChange,
    handleTerminalFontFamilyChange,
    handleUiFontFamilyChange
  } = useAppHandlers({
    setConnectionForm,
    setShowConnectionForm,
    setFormError,
    setShowSettings,
    setShowGroupNameDialog,
    setNewGroupName,
    setPendingSessionForGroup,
    setScrollbackLines,
    setTerminalFontSize,
    setTerminalFontFamily,
    setUiFontFamily,
    showSessionManager,
    isResizing,
    groups,
    createGroup,
    addSessionToGroup,
    createNewSessionWithData,
    connectionForm,
    terminalInstances,
    resizeTerminal,
    pendingSessionForGroup,
    newGroupName
  });

  // Resize handlers - following FilterSidebar pattern
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    if (!showSessionManager) return;

    handleMouseDownBase(e);
    setIsResizingState(true);
    const startX = e.clientX;
    const startWidth = sessionManagerWidth;

    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      // Calculate width change based on mouse movement (left sidebar, so diff is positive when moving right)
      const diff = e.clientX - startX;
      // Only enforce minimum width, no maximum limit (but prevent negative width)
      const newWidth = Math.max(150, startWidth + diff);
      setSessionManagerWidth(newWidth);

      // Throttle resize calls - clear previous timeout and set new one
      if (resizeTerminalTimeoutRef.current) {
        clearTimeout(resizeTerminalTimeoutRef.current);
      }
      resizeTerminalTimeoutRef.current = setTimeout(() => {
        resizeTerminal();
        resizeTerminalTimeoutRef.current = null;
      }, 16); // ~60fps (16ms)
    };

    const handleMouseUp = () => {
      handleMouseUpBase();
      setIsResizingState(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [showSessionManager, sessionManagerWidth, handleMouseDownBase, handleMouseUpBase, resizeTerminal]);

  // Switch active session - memoized to prevent unnecessary re-renders
  const switchToSession = useCallback((sessionId) => {
    setActiveSessionId(sessionId);
  }, []);

  // Reorder tabs by dragging
  const handleReorderTabs = useCallback((draggedSessionId, targetIndex) => {
    setSessions(prev => {
      const newSessions = [...prev];
      const draggedIndex = newSessions.findIndex(s => s.id === draggedSessionId);

      if (draggedIndex === -1 || draggedIndex === targetIndex) {
        return prev; // No change needed
      }

      // Remove dragged item
      const [draggedSession] = newSessions.splice(draggedIndex, 1);

      // Insert at target position
      newSessions.splice(targetIndex, 0, draggedSession);

      return newSessions;
    });
  }, []);

  // Expose sessions to window for main process access (update on sessions change)
  useEffect(() => {
    window.__sessions__ = sessions;
  }, [sessions]);

  // SSH/Serial data handling and detached session events are now in useTerminalManagement and useConnectionManagement hooks





  // Serial data handling is now in useTerminalManagement hook
  // Handle serial close to update session state and auto-reconnect
  // This function is called when Serial connection closes
  // It should trigger the same behavior as pressing F5 if autoReconnect is enabled
  // Refs for event handlers to prevent memory leaks/excessive re-subscriptions
  const sessionsRef = useRef(sessions);
  const autoReconnectRef = useRef(autoReconnect);
  const reconnectingSessionsRef = useRef(reconnectingSessions);
  const onReconnectSessionRef = useRef(onReconnectSession);

  useEffect(() => {
    sessionsRef.current = sessions;
    autoReconnectRef.current = autoReconnect;
    reconnectingSessionsRef.current = reconnectingSessions;
    onReconnectSessionRef.current = onReconnectSession;
  }, [sessions, autoReconnect, reconnectingSessions, onReconnectSession]);

  // Handle Serial and Local connection close events
  useEffect(() => {
    // Serial Close Handler
    const handleSerialClose = (event, receivedSessionId) => {
      const currentSessions = sessionsRef.current;
      const foundSession = currentSessions.find(s => s.id === receivedSessionId);

      if (!foundSession) {
        console.log('[Auto-reconnect] Serial session not found for sessionId:', receivedSessionId);
        return;
      }

      console.log('[Auto-reconnect] Serial connection closed:', foundSession.id);

      setSessions(prev => prev.map(s =>
        s.id === receivedSessionId ? { ...s, isConnected: false } : s
      ));

      const shouldAutoReconnect = foundSession.autoReconnect !== undefined
        ? foundSession.autoReconnect
        : autoReconnectRef.current;

      if (!shouldAutoReconnect) return;

      setTimeout(() => {
        if (reconnectingSessionsRef.current?.has(foundSession.id)) return;
        if (onReconnectSessionRef.current) onReconnectSessionRef.current(foundSession.id);
      }, 500);
    };

    // Local Close Handler
    const handleLocalClose = (event, { connectionId, exitCode }) => {
      const currentSessions = sessionsRef.current;
      // Local connectionId IS the sessionId
      const foundSession = currentSessions.find(s => s.id === connectionId);

      if (!foundSession) return;

      console.log('[Auto-reconnect] Local connection closed:', connectionId, 'code:', exitCode);

      setSessions(prev => prev.map(s =>
        s.id === connectionId ? { ...s, isConnected: false } : s
      ));

      // Always auto-reconnect local terminal unless explicitly disabled (it shouldn't really exit unless typed 'exit')
      // If user typed 'exit', maybe we shouldn't reconnect? 
      // Current behavior: if autoReconnect is true (default for local), it will restart shell.
      const shouldAutoReconnect = foundSession.autoReconnect !== undefined
        ? foundSession.autoReconnect
        : true; // Default true for local

      if (!shouldAutoReconnect) return;

      setTimeout(() => {
        if (reconnectingSessionsRef.current?.has(foundSession.id)) return;
        if (onReconnectSessionRef.current) onReconnectSessionRef.current(foundSession.id);
      }, 500);
    };

    window.electronAPI.onSerialClose(handleSerialClose);
    window.electronAPI.onLocalClose(handleLocalClose);

    return () => {
      window.electronAPI.offSerialClose(handleSerialClose);
      window.electronAPI.offLocalClose(handleLocalClose);
    };
  }, [setSessions]); // Only setSessions dependency (stable), ensuring this runs ONCE only



  // Memoize active session connection status to avoid repeated find() calls
  const activeSessionConnectionStatus = useMemo(() => {
    if (!activeSessionId) return null;
    const session = sessions.find(s => s.id === activeSessionId);
    return session?.isConnected || false;
  }, [activeSessionId, sessions]);

  // Terminal initialization effect - only for existing sessions when switching
  useEffect(() => {
    if (activeSessionId && activeSessionConnectionStatus) {
      // Only initialize if terminal doesn't exist yet (for session switching)
      if (!terminalInstances.current[activeSessionId]) {
        const timer = setTimeout(() => {
          initializeTerminal(activeSessionId);
        }, 200);

        return () => clearTimeout(timer);
      }
    }
  }, [activeSessionId, activeSessionConnectionStatus, initializeTerminal]);

  // Terminal resize and keyboard shortcuts are now in useTerminalManagement and useKeyboardShortcuts hooks

  // Memoize activeSession to avoid recalculation on every render


  // Memoize ungrouped sessions to avoid recalculation
  // A session is ungrouped if it doesn't match any savedSession in any group
  const ungroupedSessions = useMemo(() => {
    return sessions.filter(session => {
      // Check if this session matches any savedSession in any group
      return !groups.some(group => {
        return (group.savedSessions || []).some(savedSession =>
          matchSavedSessionWithActiveSession(savedSession, session)
        );
      });
    });
  }, [sessions, groups, matchSavedSessionWithActiveSession]);

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
          let title;
          if (activeSession.connectionType === 'serial') {
            title = `Serial: ${activeSession.serialPort} - ash`;
          } else {
            title = `${activeSession.user}@${activeSession.host}:${activeSession.port} - ash`;
          }
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
  }, [showConnectionForm, connectionForm.connectionType, loadSerialPorts]);

  // Menu handlers hook
  useMenuHandlers({
    activeSessionId,
    setShowConnectionForm,
    setShowSettings,
    setShowSessionManager,
    setSessionManagerWidth,
    setShowAboutDialog,
    setShowLicensesDialog,
    setShowTftpServerDialog,
    setShowWebServerDialog,
    setShowIperfServerDialog,
    setShowIperfClientSidebar,
    setShowNetcatSidebar,
    setShowAICommandInput,
    setAppInfo,
    disconnectSession,
    resizeTerminal
  });

  // Settings import/export handlers
  const handleExportSettings = useCallback(async () => {
    try {
      // Collect all settings from localStorage
      const localStorageSettings = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('ash-') || key.startsWith('ssh-'))) {
          try {
            localStorageSettings[key] = JSON.parse(localStorage.getItem(key));
          } catch (e) {
            // If not JSON, store as string
            localStorageSettings[key] = localStorage.getItem(key);
          }
        }
      }

      // Get settings.json from main process
      const settingsFileResult = await window.electronAPI.getSettings();
      const settingsFileData = settingsFileResult.success ? settingsFileResult.settings : {};

      // Combine all settings
      const allSettings = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        localStorage: localStorageSettings,
        settingsFile: settingsFileData
      };

      // Export to file
      const result = await window.electronAPI.exportSettings(allSettings);
      if (result.success) {
        setMessageDialog({
          isOpen: true,
          type: 'success',
          title: '',
          message: 'Settings exported successfully!',
          detail: result.path ? `Saved to: ${result.path}` : ''
        });
      } else if (!result.canceled) {
        setMessageDialog({
          isOpen: true,
          type: 'error',
          title: '',
          message: 'Failed to export settings',
          detail: result.error || 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Export settings error:', error);
      setMessageDialog({
        isOpen: true,
        type: 'error',
        title: '',
        message: 'Failed to export settings',
        detail: error.message
      });
    }
  }, []);

  const handleImportSettings = useCallback(async () => {
    // Confirm with user
    setConfirmDialog({
      isOpen: true,
      title: 'Import Settings',
      message: 'Importing settings will overwrite your current settings. Continue?',
      onConfirm: async () => {
        try {
          // Import from file
          const result = await window.electronAPI.importSettings();
          if (!result.success) {
            if (result.canceled) return;
            setMessageDialog({
              isOpen: true,
              type: 'error',
              title: '',
              message: 'Failed to import settings',
              detail: result.error || 'Unknown error'
            });
            return;
          }

          const importedSettings = result.settings;

          // Restore localStorage settings
          if (importedSettings.localStorage) {
            Object.entries(importedSettings.localStorage).forEach(([key, value]) => {
              if (key && (key.startsWith('ash-') || key.startsWith('ssh-'))) {
                if (typeof value === 'string') {
                  localStorage.setItem(key, value);
                } else {
                  localStorage.setItem(key, JSON.stringify(value));
                }
              }
            });
          }

          // Restore settings.json
          if (importedSettings.settingsFile) {
            await window.electronAPI.saveSettings(importedSettings.settingsFile);
          }

          // Show success message
          setMessageDialog({
            isOpen: true,
            type: 'success',
            title: '',
            message: 'Settings imported successfully!',
            detail: 'Reload the page to apply all settings.'
          });
        } catch (error) {
          console.error('Import settings error:', error);
          setMessageDialog({
            isOpen: true,
            type: 'error',
            title: '',
            message: 'Failed to import settings',
            detail: error.message
          });
        }
      }
    });
  }, []);

  useEffect(() => {
    window.addEventListener('export-settings', handleExportSettings);
    window.addEventListener('import-settings', handleImportSettings);

    return () => {
      window.removeEventListener('export-settings', handleExportSettings);
      window.removeEventListener('import-settings', handleImportSettings);
    };
  }, [handleExportSettings, handleImportSettings]);



  // Apply UI font family CSS variable on mount (useEffect handles state changes)
  useEffect(() => {
    document.documentElement.style.setProperty('--ui-font-family', uiFontFamily);
  }, [uiFontFamily]);

  // Apply terminal font family CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--terminal-font-family', terminalFontFamily);
  }, [terminalFontFamily]);

  // Cleanup resize timeout on unmount
  useEffect(() => {
    return () => {
      if (resizeTerminalTimeoutRef.current) {
        clearTimeout(resizeTerminalTimeoutRef.current);
        resizeTerminalTimeoutRef.current = null;
      }
      // Reset resizing state on unmount
      if (isResizing.current) {
        isResizing.current = false;
      }
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
      {/* Windows/Linux custom title bar with window controls and menu */}
      {isWindows && (
        <CustomTitleBar
          isMaximized={isMaximized}
          onMinimize={handleMinimize}
          onMaximize={handleMaximize}
          onClose={handleClose}
          onNewSession={handleShowConnectionForm}
          onCloseSession={() => {
            if (activeSessionId) {
              disconnectSession(activeSessionId);
            }
          }}
          onSettings={handleShowSettings}
          onToggleDevTools={() => {
            if (window.electronAPI) {
              window.electronAPI.toggleDevTools();
            }
          }}
          onAICommand={() => setShowAICommandInput(true)}
          onCheckForUpdates={async () => {
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
          }}
          onAbout={async () => {
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
          }}
          onTftpServer={() => setShowTftpServerDialog(true)}
          onWebServer={() => setShowWebServerDialog(true)}
          onIperfServer={() => setShowIperfServerDialog(true)}
          onIperfClient={() => setShowIperfClientSidebar(true)}
          onNetcat={() => setShowNetcatSidebar(true)}
          onThirdPartyLicenses={() => setShowLicensesDialog(true)}
          onImportSettings={handleImportSettings}
          onExportSettings={handleExportSettings}
          iperfAvailable={iperfAvailable}
          showSessionManager={showSessionManager}
          onToggleSessionManager={(checked) => {
            setShowSessionManager(checked);
            if (checked && sessionManagerWidth === 0) {
              setSessionManagerWidth(250);
            }
            setTimeout(() => {
              resizeTerminal();
            }, 350);
          }}
          themes={themes}
          currentTheme={theme}
          onChangeTheme={changeTheme}
        />
      )}
      <div className="main-content">
        {/* Left session manager */}
        <SessionManager
          showSessionManager={showSessionManager}
          sessionManagerWidth={sessionManagerWidth}
          isResizing={isResizingState}
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
          onShowConnectionForm={handleShowConnectionForm}
          onCreateNewSessionWithData={createNewSessionWithData}
          onConnectFromHistory={connectFromHistory}
          onToggleFavorite={toggleFavorite}
          onRemoveConnection={removeConnection}
          onSwitchToSession={switchToSession}
          onDisconnectSession={disconnectSession}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onConnectGroup={connectGroup}
          onDisconnectGroup={handleDisconnectGroup}
          onToggleGroupExpanded={toggleGroupExpanded}
          onStartEditingGroupName={startEditingGroupName}
          onSaveGroupName={saveGroupName}
          onCancelEditingGroupName={cancelEditingGroupName}
          onRemoveSessionFromGroup={removeSessionFromGroup}
          onDeleteGroup={handleDeleteGroup}
          onCreateGroup={createGroup}
          setGroups={setGroups}
          onOpenSessionSettings={(session, context) => {
            setSelectedSession(session);
            setSessionDialogContext(context || null);
            setShowSessionDialog(true);
          }}
          libraries={libraries}
          sshConnections={sshConnections}
          terminalFontFamily={terminalFontFamily}
          onEditLibrary={(library) => {
            setSelectedLibrary(library);
            setShowLibraryDialog(true);
          }}
          onDeleteLibrary={deleteLibrary}
          onToggleLibraryExpanded={toggleLibraryExpanded}
          onCreateLibrary={() => {
            const newLibrary = createLibrary(`Library ${libraries.length + 1}`);
            setSelectedLibrary(newLibrary);
            setShowLibraryDialog(true);
          }}
          onExportLibrary={async (library) => {
            try {
              const sanitizedFileName = library.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
              const defaultFileName = `${sanitizedFileName}.json`;
              const result = await window.electronAPI.exportLibrary(library, defaultFileName);
              if (result.success) {
                // Optional: Show success message
                console.log('Library exported successfully:', result.path);
              } else if (!result.canceled) {
                alert('Failed to export library: ' + (result.error || 'Unknown error'));
              }
            } catch (error) {
              console.error('Export library error:', error);
              alert('Failed to export library: ' + error.message);
            }
          }}
          onImportLibrary={() => {
            setShowLibraryImportDialog(true);
          }}
          setErrorDialog={setErrorDialog}
        />

        {/* Resize handle */}
        {showSessionManager && (
          <div
            ref={resizeHandleRef}
            className="resize-handle"
            onMouseDown={handleResizeStart}
          />
        )}

        {/* Right terminal area */}
        <TerminalView
          onFileDrop={(filePath) => {
            setFileUploadInitialPath(filePath);
            setShowFileUploadDialog(true);
          }}
          activeSession={activeSession}
          sessions={sessions}
          activeSessionId={activeSessionId}
          terminalRefs={terminalRefs}
          logStates={logStates}
          sessionLogs={sessionLogs}
          onSwitchToSession={switchToSession}
          onDisconnectSession={disconnectSession}
          onDetachTab={handleDetachTab}
          onReorderTabs={handleReorderTabs}
          onStartLogging={startLogging}
          onStopLogging={stopLogging}
          onSaveLog={saveLog}
          onClearLog={clearLog}
          onShowConnectionForm={handleShowConnectionForm}
          terminalInstances={terminalInstances}
          searchAddons={searchAddons}
          showSearchBar={showSearchBar}
          onCloseSearchBar={() => setShowSearchBar(false)}
          onUpdateSession={(sessionId, updates) => {
            setSessions(prev => prev.map(s =>
              s.id === sessionId ? { ...s, ...updates } : s
            ));
          }}
          onReconnectSession={async (sessionId) => {
            const session = sessions.find(s => s.id === sessionId);
            if (!session) return;

            // Mark as reconnecting
            setReconnectingSessions(prev => {
              const next = new Map(prev);
              next.set(sessionId, true);
              return next;
            });

            try {
              await reconnectSession(session);

              // Update connectionId map after reconnection
              if (updateConnectionIdMap) {
                updateConnectionIdMap();
              }

              // Success message is already shown in reconnectSSHSession
            } catch (error) {
              // Error is already handled by reconnectSession (shows error dialog)
              console.error('Reconnection failed:', error);
            } finally {
              // Remove from reconnecting map
              setReconnectingSessions(prev => {
                const next = new Map(prev);
                next.delete(sessionId);
                return next;
              });
            }
          }}

          backendStatus={backendStatus}
          pendingUserRequest={pendingUserRequest}
          onRespondToRequest={handleAskUserResponse}
          llmSettings={llmSettings}
          sshConnections={sshConnections}
          showAICommandInput={activeSessionId ? sessions.find(s => s.id === activeSessionId)?.aiSidebarVisible : false}
          onToggleAICommandInput={() => {
            if (activeSessionId) {
              setSessions(prev => prev.map(s => {
                if (s.id === activeSessionId) {
                  return { ...s, aiSidebarVisible: !s.aiSidebarVisible, activeSecondaryTab: 'ai-chat' };
                }
                return s;
              }));
            }
          }}
          reconnectingSessions={reconnectingSessions}
          stopwatchState={activeSessionId ? getStopwatchState(activeSessionId) : null}
          onStartStopwatch={startStopwatch}
          onStopStopwatch={stopStopwatch}
          onResetStopwatch={resetStopwatch}
          iperfLongTermData={iperfLongTermData}
        />

        {/* Global Sidebar Container for Portals */}
        <div
          id="secondary-sidebars-root"
          className="secondary-sidebars-root"
          style={{
            height: '100%',
            flexShrink: 0,
            background: 'var(--theme-bg)',
            borderLeft: '1px solid var(--theme-border)',
            // Display is controlled by content presence, but we need strict layout
            display: 'flex',
            flexDirection: 'column',
            '--theme-accent': currentTheme.accent,
            '--theme-bg': currentTheme.background,
            '--theme-text': currentTheme.text,
            '--theme-border': currentTheme.border,
            '--theme-surface': currentTheme.surface
          }}
        >
          {sessions.map(session => {
            // Only show the slot for the active session, and only if a sidebar is actually visible
            // The SessionContent will portal into it regardless, but we control visibility via style
            const isVisible = activeSessionId === session.id && (session.aiSidebarVisible || session.iperfSidebarVisible || session.netcatSidebarVisible);
            return (
              <div
                key={session.id}
                id={`sidebar-slot-${session.id}`}
                style={{
                  display: isVisible ? 'block' : 'none',
                  height: '100%',
                  width: '100%'
                }}
              />
            );
          })}
        </div>

        {/* Terminal Context Menu */}
        <TerminalContextMenu
          visible={contextMenu.visible}
          x={contextMenu.x}
          y={contextMenu.y}
          onCopy={async () => {
            if (contextMenu.sessionId && terminalInstances.current[contextMenu.sessionId]) {
              const terminal = terminalInstances.current[contextMenu.sessionId];
              const selection = terminal.getSelection();
              if (selection) {
                try {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(selection);
                  } else {
                    // Fallback
                    const textArea = document.createElement('textarea');
                    textArea.value = selection;
                    textArea.style.position = 'fixed';
                    textArea.style.opacity = '0';
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                  }
                } catch (error) {
                  console.error('Failed to copy:', error);
                }
              }
            }
          }}
          onPaste={async () => {
            if (contextMenu.sessionId && terminalInstances.current[contextMenu.sessionId]) {
              const terminal = terminalInstances.current[contextMenu.sessionId];
              try {
                if (navigator.clipboard && navigator.clipboard.readText) {
                  const text = await navigator.clipboard.readText();
                  terminal.paste(text);
                }
              } catch (error) {
                console.error('Failed to paste:', error);
              }
            }
          }}
          onSelectAll={() => {
            if (contextMenu.sessionId && terminalInstances.current[contextMenu.sessionId]) {
              const terminal = terminalInstances.current[contextMenu.sessionId];
              terminal.selectAll();
            }
          }}
          onUpload={() => {
            setShowFileUploadDialog(true);
          }}
          isSSHSession={(() => {
            if (!contextMenu.sessionId) return false;
            const session = sessions.find(s => s.id === contextMenu.sessionId);
            return session?.connectionType === 'ssh' && session?.isConnected;
          })()}
          canUpload={(() => {
            if (!contextMenu.sessionId) return false;
            const session = sessions.find(s => s.id === contextMenu.sessionId);
            // Support upload for both SSH and Telnet connections
            return (session?.connectionType === 'ssh' || session?.connectionType === 'telnet') && session?.isConnected;
          })()}
          onClose={() => setContextMenu({ visible: false, x: 0, y: 0, sessionId: null })}
        />
      </div>

      {/* Bottom status bar */}
      <StatusBar
        activeSession={activeSession}
        sessionsCount={sessions.length}
        tftpStatus={tftpStatus}
        webStatus={webStatus}
        iperfStatus={iperfStatus}
        onTftpClick={() => setShowTftpServerDialog(true)}
        onWebClick={() => setShowWebServerDialog(true)}
        onIperfClick={() => setShowIperfServerDialog(true)}
        onIperfClientClick={() => {
          setShowIperfClientSidebar(true);
        }}
        iperfClientStatus={iperfClientStatus}
        iperfAvailable={iperfAvailable}
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
        onPostProcessingChange={(postProcessing, enabled) => {
          setConnectionForm(prev => ({
            ...prev,
            postProcessing,
            postProcessingEnabled: enabled
          }));
        }}
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
        terminalFontSize={terminalFontSize}
        terminalFontFamily={terminalFontFamily}
        uiFontFamily={uiFontFamily}
        llmSettings={llmSettings}
        reconnectRetry={reconnectRetry}
        terminalBufferLimit={terminalBufferLimit}
        onChangeTheme={changeTheme}
        onChangeScrollbackLines={handleScrollbackChange}
        onChangeTerminalBufferLimit={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!isNaN(val) && val >= 10 && val <= 10000) {
            setTerminalBufferLimit(val);
            localStorage.setItem('ash-terminal-buffer-limit', val);
          }
        }}
        maxOutputSize={maxOutputSize}
        onChangeMaxOutputSize={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!isNaN(val) && val >= 1024) { // Minimum 1KB
            setMaxOutputSize(val);
            localStorage.setItem('ash-max-output-size', val);
          }
        }}
        onChangeTerminalFontSize={handleTerminalFontSizeChange}
        onChangeTerminalFontFamily={handleTerminalFontFamilyChange}
        onChangeUiFontFamily={handleUiFontFamilyChange}
        onChangeLlmSettings={updateLlmSettings}
        onChangeReconnectRetry={(updates) => {
          const newRetry = { ...reconnectRetry, ...updates };
          setReconnectRetry(newRetry);
          localStorage.setItem('ash-reconnect-retry', JSON.stringify(newRetry));
        }}
        onClose={handleCloseSettings}
        onShowAbout={async () => {
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
        }}
      />

      {/* About dialog */}
      <AboutDialog
        isOpen={showAboutDialog}
        onClose={() => setShowAboutDialog(false)}
        appVersion={appInfo.version}
        author={appInfo.author}
        themes={themes}
        currentTheme={theme}
        onShowLicenses={() => {
          setShowAboutDialog(false);
          setShowLicensesDialog(true);
        }}
      />

      {/* Licenses dialog */}
      <LicensesDialog
        isOpen={showLicensesDialog}
        onClose={() => setShowLicensesDialog(false)}
        themes={themes}
        currentTheme={theme}
      />

      {/* Session Dialog */}
      <SessionDialog
        showDialog={showSessionDialog}
        session={selectedSession}
        onClose={() => {
          setShowSessionDialog(false);
          setSelectedSession(null);
          setSessionDialogContext(null);
        }}
        onSave={(sessionId, postProcessing, enabled) => {
          // Update session
          setSessions(prev => prev.map(s =>
            s.id === sessionId
              ? { ...s, postProcessing, postProcessingEnabled: enabled }
              : s
          ));

          // If opened from a group, persist to group's savedSessions so it survives refresh/reconnect
          if (sessionDialogContext?.groupId && sessionDialogContext?.savedSessionId) {
            setGroups(prev => prev.map(g =>
              g.id === sessionDialogContext.groupId
                ? {
                    ...g,
                    savedSessions: (g.savedSessions || []).map(s =>
                      s.id === sessionDialogContext.savedSessionId
                        ? { ...s, postProcessing, postProcessingEnabled: enabled }
                        : s
                    )
                  }
                : g
            ));
          }

          // Update connection history (for ungrouped sessions from ssh-connections)
          const session = sessions.find(s => s.id === sessionId);
          if (session) {
            const historyEntry = connectionHistory.find(c => {
              if (session.connectionType === 'serial') {
                return c.connectionType === 'serial' &&
                  c.serialPort === session.serialPort &&
                  (c.sessionName || c.name || '') === (session.name || '');
              } else {
                return c.connectionType === 'ssh' &&
                  c.host === session.host &&
                  c.user === session.user &&
                  (c.port || '22') === (session.port || '22') &&
                  (c.sessionName || c.name || '') === (session.name || '');
              }
            });

            if (historyEntry) {
              // Update localStorage
              const updatedHistory = connectionHistory.map(c => {
                if (c === historyEntry) {
                  return { ...c, postProcessing, postProcessingEnabled: enabled };
                }
                return c;
              });
              localStorage.setItem('ssh-connections', JSON.stringify(updatedHistory));
            }
          }
        }}
      />

      {/* Library Dialog */}
      <LibraryDialog
        showDialog={showLibraryDialog}
        library={selectedLibrary}
        terminalFontFamily={terminalFontFamily}
        onClose={() => {
          setShowLibraryDialog(false);
          setSelectedLibrary(null);
        }}
        onSave={(libraryId, updates) => {
          updateLibrary(libraryId, updates);
        }}
      />

      {/* Library Import Dialog */}
      <LibraryImportDialog
        showDialog={showLibraryImportDialog}
        terminalFontFamily={terminalFontFamily}
        onClose={() => {
          setShowLibraryImportDialog(false);
        }}
        onImport={(libraryData) => {
          importLibrary(libraryData);
          setShowLibraryImportDialog(false);
        }}
      />

      {/* TFTP Server Dialog */}
      <TftpServerDialog
        isOpen={showTftpServerDialog}
        onClose={() => setShowTftpServerDialog(false)}
      />

      {/* Web Server Dialog */}
      <WebServerDialog
        isOpen={showWebServerDialog}
        onClose={() => setShowWebServerDialog(false)}
      />

      {/* iperf3 Server Dialog */}
      <IperfServerDialog
        isOpen={showIperfServerDialog}
        onClose={() => setShowIperfServerDialog(false)}
      />


      <FileUploadDialog
        isOpen={showFileUploadDialog}
        onClose={() => {
          setShowFileUploadDialog(false);
          setFileUploadInitialPath(null);
        }}
        sessionId={contextMenu.sessionId || activeSessionId}
        connectionId={(() => {
          const sessionId = contextMenu.sessionId || activeSessionId;
          if (!sessionId) return null;
          const connection = sshConnections.current[sessionId];
          return connection?.connectionId || null;
        })()}
        connectionType={(() => {
          const sessionId = contextMenu.sessionId || activeSessionId;
          if (!sessionId) return 'ssh';
          const session = sessions.find(s => s.id === sessionId);
          return session?.connectionType || 'ssh';
        })()}
        libraries={libraries}
        initialFilePath={fileUploadInitialPath}
        onUploadComplete={(result) => {
          console.log('Upload complete:', result);
          // Optionally show success message or execute additional commands
        }}
      />

      {/* Error Dialog */}
      <ErrorDialog
        isOpen={errorDialog.isOpen}
        onClose={() => setErrorDialog({ isOpen: false, title: '', message: '', detail: '', error: null })}
        title={errorDialog.title}
        message={errorDialog.message}
        detail={errorDialog.detail}
        error={errorDialog.error}
      />

      {/* Message Dialog for Settings Import/Export */}
      <MessageDialog
        isOpen={messageDialog.isOpen}
        onClose={() => {
          setMessageDialog({ isOpen: false, type: 'info', title: '', message: '', detail: '' });
          // If it's a success message after import, ask to reload
          if (messageDialog.type === 'success' && messageDialog.detail?.includes('Reload')) {
            setConfirmDialog({
              isOpen: true,
              title: 'Reload Page',
              message: 'Do you want to reload the page now to apply all settings?',
              onConfirm: () => {
                window.location.reload();
              }
            });
          }
        }}
        type={messageDialog.type}
        title={messageDialog.title}
        message={messageDialog.message}
        detail={messageDialog.detail}
      />

      {/* Confirm Dialog for Settings Import/Export */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })}
        onConfirm={confirmDialog.onConfirm || (() => { })}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
}

export default App;