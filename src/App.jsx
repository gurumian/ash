import React, { useState, useRef, useEffect, useCallback, useMemo, startTransition } from 'react';
import '@xterm/xterm/css/xterm.css';
import './App.css';

import { SSHConnection } from './connections/SSHConnection';
import { SerialConnection } from './connections/SerialConnection';
import { useTheme } from './hooks/useTheme';
import { useConnectionHistory } from './hooks/useConnectionHistory';
import { useLogging } from './hooks/useLogging';
import { useGroups } from './hooks/useGroups';
import { useSerialPorts } from './hooks/useSerialPorts';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWindowControls } from './hooks/useWindowControls';
import { useMenuHandlers } from './hooks/useMenuHandlers';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useTerminalManagement } from './hooks/useTerminalManagement';
import { useConnectionManagement } from './hooks/useConnectionManagement';
import { CustomTitleBar } from './components/CustomTitleBar';
import { SessionManager } from './components/SessionManager';
import { TerminalView } from './components/TerminalView';
import { ConnectionForm } from './components/ConnectionForm';
import { Settings } from './components/Settings';
import { GroupNameDialog } from './components/GroupNameDialog';
import { StatusBar } from './components/StatusBar';
import { AboutDialog } from './components/AboutDialog';
import { TerminalContextMenu } from './components/TerminalContextMenu';
import { TerminalSearchBar } from './components/TerminalSearchBar';

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
    flowControl: 'none'
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
  
  const [showSettings, setShowSettings] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
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
  
  // Terminal context menu state
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    sessionId: null,
  });
  
  // Terminal search state
  const [showSearchBar, setShowSearchBar] = useState(false);
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
    setShowSearchBar
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
    setShowSearchBar
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

  // Memoize input change handler
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setConnectionForm(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);


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

  // Create new session (returns sessionId if successful) - uses connectionForm state
  const createNewSession = async (skipFormReset = false) => {
    return createNewSessionWithData(connectionForm, skipFormReset);
  };

  // Switch active session - memoized to prevent unnecessary re-renders
  const switchToSession = useCallback((sessionId) => {
    setActiveSessionId(sessionId);
  }, []);

  // Expose sessions to window for main process access (update on sessions change)
  useEffect(() => {
    window.__sessions__ = sessions;
  }, [sessions]);

  // Group management functions are provided by useGroups hook


  const handleCreateGroupFromDialog = () => {
    if (pendingSessionForGroup) {
      const groupName = newGroupName.trim() || `Group ${groups.length + 1}`;
      const newGroupId = createGroup(groupName);
      
      if (pendingSessionForGroup.type === 'existing') {
        addSessionToGroup(pendingSessionForGroup.sessionId, newGroupId);
      } else if (pendingSessionForGroup.type === 'new') {
        // Session was already created, just add to group
        addSessionToGroup(pendingSessionForGroup.sessionId, newGroupId);
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
  }, [showConnectionForm, connectionForm.connectionType, loadSerialPorts]);

  // Menu handlers hook
  useMenuHandlers({
    activeSessionId,
    setShowConnectionForm,
    setShowSettings,
    setShowSessionManager,
    setSessionManagerWidth,
    setShowAboutDialog,
    setAppInfo,
    disconnectSession,
    resizeTerminal
  });


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
    // Use connectionForm directly to ensure we have the latest state
    createNewSessionWithData(connectionForm);
  }, [connectionForm]); // Include connectionForm in dependencies
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
  const handleTerminalFontSizeChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 8 && value <= 32) {
      setTerminalFontSize(value);
      localStorage.setItem('ash-terminal-font-size', value.toString());
      // Update existing terminals
      setTimeout(() => {
        Object.keys(terminalInstances.current).forEach(sessionId => {
          const terminal = terminalInstances.current[sessionId];
          if (terminal) {
            terminal.options.fontSize = value;
            resizeTerminal();
          }
        });
      }, 0);
    }
  }, [terminalInstances, resizeTerminal]);
  const handleTerminalFontFamilyChange = useCallback((e) => {
    const value = e.target.value;
    setTerminalFontFamily(value);
    localStorage.setItem('ash-terminal-font-family', value);
    // Update existing terminals
    setTimeout(() => {
      Object.keys(terminalInstances.current).forEach(sessionId => {
        const terminal = terminalInstances.current[sessionId];
        if (terminal) {
          terminal.options.fontFamily = value;
          resizeTerminal();
        }
      });
    }, 0);
  }, [terminalInstances, resizeTerminal]);

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
          searchAddons={searchAddons}
          showSearchBar={showSearchBar}
          onCloseSearchBar={() => setShowSearchBar(false)}
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
        terminalFontSize={terminalFontSize}
        terminalFontFamily={terminalFontFamily}
        onChangeTheme={changeTheme}
        onChangeScrollbackLines={handleScrollbackChange}
        onChangeTerminalFontSize={handleTerminalFontSizeChange}
        onChangeTerminalFontFamily={handleTerminalFontFamilyChange}
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
    </div>
  );
}

export default App;