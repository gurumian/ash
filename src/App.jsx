import React, { useState, useRef, useEffect, useCallback, useMemo, startTransition } from 'react';
import '@xterm/xterm/css/xterm.css';
import './App.css';

import { SSHConnection } from './connections/SSHConnection';
import { SerialConnection } from './connections/SerialConnection';
import { useTheme } from './hooks/useTheme';
import { useConnectionHistory } from './hooks/useConnectionHistory';
import { useLogging } from './hooks/useLogging';
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
import { CustomTitleBar } from './components/CustomTitleBar';
import { SessionManager } from './components/SessionManager';
import { TerminalView } from './components/TerminalView';
import { ConnectionForm } from './components/ConnectionForm';
import { Settings } from './components/Settings';
import { GroupNameDialog } from './components/GroupNameDialog';
import { StatusBar } from './components/StatusBar';
import { AboutDialog } from './components/AboutDialog';
import { ErrorDialog } from './components/ErrorDialog';
import { TerminalContextMenu } from './components/TerminalContextMenu';
import { TerminalSearchBar } from './components/TerminalSearchBar';
import { TerminalAICommandInput } from './components/TerminalAICommandInput';
import LLMService from './services/llm-service';
import { SessionDialog } from './components/SessionDialog';
import { LibraryDialog } from './components/LibraryDialog';
import { TftpServerDialog } from './components/TftpServerDialog';

function App() {
  // Session management state
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  
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
    // Serial port specific fields
    serialPort: '',
    baudRate: '9600',
    dataBits: '8',
    stopBits: '1',
    parity: 'none',
    flowControl: 'none',
    // Post-processing
    postProcessing: [],
    postProcessingEnabled: true
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [showSessionManager, setShowSessionManager] = useState(true);
  const [sessionManagerWidth, setSessionManagerWidth] = useState(250);
  
  const isWindows = window.electronAPI?.platform !== 'darwin';

  // Use custom hooks
  const { connectionHistory, favorites, saveConnectionHistory, toggleFavorite, removeConnection } = useConnectionHistory();
  const { sessionLogs, logStates, appendToLog, startLogging, stopLogging, saveLog, clearLog, cleanupLog } = useLogging(sessions, groups);
  const { availableSerialPorts, loadSerialPorts } = useSerialPorts();
  
  // Libraries hook
  const {
    libraries,
    createLibrary,
    updateLibrary,
    deleteLibrary,
    toggleLibraryExpanded
  } = useLibraries();
  
  // LLM Settings hook
  const {
    llmSettings,
    updateLlmSettings
  } = useLLMSettings();
  
  const [showSettings, setShowSettings] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showTftpServerDialog, setShowTftpServerDialog] = useState(false);
  const [tftpStatus, setTftpStatus] = useState({ running: false, port: null });
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

    // Check periodically (every 2 seconds)
    const interval = setInterval(loadTftpStatus, 2000);

    return () => clearInterval(interval);
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
  const [showAICommandInput, setShowAICommandInput] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  // Error dialog state
  const [errorDialog, setErrorDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    detail: ''
  });
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);
  const [selectedLibrary, setSelectedLibrary] = useState(null);
  const [scrollbackLines, setScrollbackLines] = useState(() => {
    const saved = localStorage.getItem('ash-scrollback');
    return saved ? parseInt(saved, 10) : 5000;
  });
  const [terminalFontSize, setTerminalFontSize] = useState(() => {
    const saved = localStorage.getItem('ash-terminal-font-size');
    return saved ? parseInt(saved, 10) : 13;
  });
  const [terminalFontFamily, setTerminalFontFamily] = useState(() => {
    const saved = localStorage.getItem('ash-terminal-font-family');
    return saved || "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace";
  });
  const [uiFontFamily, setUiFontFamily] = useState(() => {
    const saved = localStorage.getItem('ash-ui-font-family');
    return saved || "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace";
  });
  
  
  // Create a ref for terminalInstances that useTheme can use
  const terminalInstancesRef = useRef({});
  
  // Theme hook - call first, but pass ref that will be updated
  const { theme, setTheme: changeTheme, currentTheme, themes } = useTheme(terminalInstancesRef);
  
  // Terminal management hook - now can use theme and themes
  const {
    terminalRefs,
    terminalInstances,
    fitAddons,
    searchAddons,
    initializeTerminal,
    resizeTerminal
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
    showAICommandInput
  });
  
  // Update ref for useTheme after terminalInstances is available
  useEffect(() => {
    terminalInstancesRef.current = terminalInstances;
  }, [terminalInstances]);
  
  // Window controls hook
  const { isMaximized, handleMinimize, handleMaximize, handleClose } = useWindowControls(isWindows);
  
  // Keyboard shortcuts hook
  useKeyboardShortcuts({
    activeSessionId,
    showSearchBar,
    setShowSearchBar,
    showAICommandInput,
    setShowAICommandInput,
    llmSettings,
    terminalInstances,
    terminalFontSize,
    setTerminalFontSize,
    resizeTerminal
  });
  
  // Connection management hook
  const {
    createNewSessionWithData,
    disconnectSession,
    connectGroup,
    handleDetachTab
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
    cleanupLog
  });

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

  // Resize handle refs
  const resizeHandleRef = useRef(null);
  const isResizing = useRef(false);
  const isInitialGroupsLoad = useRef(true);

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

  // Resize handlers with event listeners
  const handleMouseDown = (e) => {
    handleMouseDownBase(e);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isResizing.current) return;
    const newWidth = Math.max(150, Math.min(400, e.clientX));
    setSessionManagerWidth(newWidth);
    setTimeout(resizeTerminal, 10);
  };

  const handleMouseUp = () => {
    handleMouseUpBase();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

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
  // Handle serial close to update session state
  useEffect(() => {
    const handleSerialClose = (event, receivedSessionId) => {
      setSessions(prev => prev.map(s => 
        s.id === receivedSessionId ? { ...s, isConnected: false } : s
      ));
    };

    window.electronAPI.onSerialClose(handleSerialClose);

    return () => {
      window.electronAPI.offSerialClose(handleSerialClose);
    };
  }, []);


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

  // Terminal resize and keyboard shortcuts are now in useTerminalManagement and useKeyboardShortcuts hooks

  // Memoize activeSession to avoid recalculation on every render
  const activeSession = useMemo(() => 
    sessions.find(s => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

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
    setShowTftpServerDialog,
    setShowAICommandInput,
    setAppInfo,
    disconnectSession,
    resizeTerminal
  });



  // Apply UI font family CSS variable on mount (useEffect handles state changes)
  useEffect(() => {
    document.documentElement.style.setProperty('--ui-font-family', uiFontFamily);
  }, [uiFontFamily]);

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
          onOpenSessionSettings={(session) => {
            setSelectedSession(session);
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
          showAICommandInput={showAICommandInput || false}
          onCloseAICommandInput={() => {
            console.log('Closing AI Command Input');
            setShowAICommandInput(false);
          }}
          onToggleAICommandInput={() => {
            console.log('=== onToggleAICommandInput called ===');
            console.log('Current showAICommandInput:', showAICommandInput);
            setShowAICommandInput(prev => {
              const newValue = !prev;
              console.log('Setting showAICommandInput from', prev, 'to', newValue);
              return newValue;
            });
            // Force a re-render check
            setTimeout(() => {
              console.log('After toggle, showAICommandInput should be:', !showAICommandInput);
            }, 100);
          }}
          onExecuteAICommand={async (naturalLanguage) => {
            setIsAIProcessing(true);
            try {
              console.log('AI Command requested:', naturalLanguage);
              
              if (!llmSettings?.enabled) {
                throw new Error('LLM is not enabled. Please enable it in Settings.');
              }

              // Show AI request in terminal (grey color)
              if (activeSessionId && terminalInstances.current[activeSessionId]) {
                terminalInstances.current[activeSessionId].write(`\r\n\x1b[90m# AI: ${naturalLanguage}\x1b[0m\r\n`);
              }

              // Create LLM service instance
              const llmService = new LLMService(llmSettings);
              
              // Get current directory context (if available)
              const context = {
                currentDirectory: 'unknown' // TODO: Get actual current directory from terminal
              };

              // Convert natural language to command
              console.log('Calling LLM service...');
              const command = await llmService.convertToCommand(naturalLanguage, context);
              console.log('LLM returned command:', command);

              // Show generated command in terminal (grey color)
              if (activeSessionId && terminalInstances.current[activeSessionId]) {
                terminalInstances.current[activeSessionId].write(`\x1b[90m# Generated command: ${command}\x1b[0m\r\n`);
              }

              // Execute command in active session
              if (activeSessionId && sshConnections.current[activeSessionId]) {
                const connection = sshConnections.current[activeSessionId];
                if (connection.isConnected) {
                  // Write command to terminal
                  connection.write(command + '\r\n');
                  console.log('Command executed:', command);
                } else {
                  throw new Error('Session is not connected');
                }
              } else {
                throw new Error('No active session');
              }
            } catch (error) {
              console.error('AI Command error:', error);
              
              // Determine error type and show appropriate dialog
              let errorTitle = 'AI Command Error';
              let errorMessage = 'Failed to process AI command';
              let errorDetail = error.message;

              // Check for specific error types
              if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('ECONNREFUSED')) {
                errorTitle = 'Connection Error';
                errorMessage = 'Cannot connect to LLM service';
                if (llmSettings?.provider === 'ollama') {
                  errorDetail = `Cannot connect to Ollama at ${llmSettings.baseURL}\n\nPlease make sure:\n1. Ollama is running\n2. The base URL is correct (default: http://localhost:11434)\n3. The model "${llmSettings.model}" is installed`;
                } else {
                  errorDetail = `Cannot connect to ${llmSettings?.provider} API.\n\nPlease check:\n1. Your internet connection\n2. API key is correct\n3. Base URL is correct`;
                }
              } else if (error.message.includes('API key') || error.message.includes('401') || error.message.includes('403')) {
                errorTitle = 'Authentication Error';
                errorMessage = 'Invalid API key';
                errorDetail = `Please check your ${llmSettings?.provider} API key in Settings.`;
              } else if (error.message.includes('not enabled')) {
                errorTitle = 'LLM Not Enabled';
                errorMessage = 'AI command assistance is disabled';
                errorDetail = 'Please enable "Enable AI command assistance" in Settings.';
              } else if (error.message.includes('No active session')) {
                errorTitle = 'No Active Session';
                errorMessage = 'No active terminal session';
                errorDetail = 'Please connect to a session first.';
              } else if (error.message.includes('not connected')) {
                errorTitle = 'Session Not Connected';
                errorMessage = 'The current session is not connected';
                errorDetail = 'Please reconnect to the session.';
              }

              // Show error dialog
              setErrorDialog({
                isOpen: true,
                title: errorTitle,
                message: errorMessage,
                detail: errorDetail
              });
            } finally {
              setIsAIProcessing(false);
              setShowAICommandInput(false);
            }
          }}
          isAIProcessing={isAIProcessing}
        />
        
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
          onClose={() => setContextMenu({ visible: false, x: 0, y: 0, sessionId: null })}
        />
      </div>

      {/* Bottom status bar */}
      <StatusBar 
        activeSession={activeSession}
        sessionsCount={sessions.length}
        tftpStatus={tftpStatus}
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
        onChangeTheme={changeTheme}
        onChangeScrollbackLines={handleScrollbackChange}
        onChangeTerminalFontSize={handleTerminalFontSizeChange}
        onChangeTerminalFontFamily={handleTerminalFontFamilyChange}
        onChangeUiFontFamily={handleUiFontFamilyChange}
        onChangeLlmSettings={updateLlmSettings}
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
      />

      {/* Session Dialog */}
      <SessionDialog
        showDialog={showSessionDialog}
        session={selectedSession}
        onClose={() => {
          setShowSessionDialog(false);
          setSelectedSession(null);
        }}
        onSave={(sessionId, postProcessing, enabled) => {
          // Update session
          setSessions(prev => prev.map(s => 
            s.id === sessionId 
              ? { ...s, postProcessing, postProcessingEnabled: enabled }
              : s
          ));
          
          // Update connection history
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

      {/* TFTP Server Dialog */}
      <TftpServerDialog
        isOpen={showTftpServerDialog}
        onClose={() => setShowTftpServerDialog(false)}
      />

      {/* Error Dialog */}
      <ErrorDialog
        isOpen={errorDialog.isOpen}
        onClose={() => setErrorDialog({ isOpen: false, title: '', message: '', detail: '' })}
        title={errorDialog.title}
        message={errorDialog.message}
        detail={errorDialog.detail}
      />
    </div>
  );
}

export default App;