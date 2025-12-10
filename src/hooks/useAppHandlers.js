import { useCallback } from 'react';
import { getSessionDisplayName } from '../utils/sessionName';

/**
 * Custom hook for App component handlers
 */
export function useAppHandlers({
  // State setters
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
  
  // Other dependencies
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
}) {
  // Input change handler
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const inputValue = type === 'checkbox' ? checked : value;
    
    setConnectionForm(prev => {
      const updated = {
        ...prev,
        [name]: inputValue
      };
      
      // If useTelnet is checked/unchecked, update port accordingly
      if (name === 'useTelnet') {
        if (checked) {
          // Telnet checked: set port to 23 if it's currently 22 (SSH default)
          if (!prev.port || prev.port === '22') {
            updated.port = '23';
          }
        } else {
          // Telnet unchecked: set port to 22 if it's currently 23 (Telnet default)
          if (prev.port === '23') {
            updated.port = '22';
          }
        }
      }
      
      return updated;
    });
  }, [setConnectionForm]);

  // Resize handlers - these need to be wrapped in App.jsx for event listeners
  const handleMouseDown = useCallback((e) => {
    if (!showSessionManager) return;
    isResizing.current = true;
    e.preventDefault();
  }, [showSessionManager, isResizing]);

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
  }, [isResizing]);

  // Modal handlers
  const handleShowSettings = useCallback(() => setShowSettings(true), [setShowSettings]);
  
  const handleShowConnectionForm = useCallback(() => {
    setFormError('');
    setShowConnectionForm(true);
  }, [setFormError, setShowConnectionForm]);
  
  const handleCloseConnectionForm = useCallback(() => {
    setShowConnectionForm(false);
    setFormError('');
  }, [setShowConnectionForm, setFormError]);
  
  const handleCloseSettings = useCallback(() => setShowSettings(false), [setShowSettings]);

  // Connection form handlers
  const handleConnectionFormSubmit = useCallback((e) => {
    e.preventDefault();
    setFormError('');
    createNewSessionWithData(connectionForm);
  }, [connectionForm, createNewSessionWithData, setFormError]);
  
  const handleConnectionTypeChange = useCallback((type) => {
    setConnectionForm(prev => ({ ...prev, connectionType: type }));
  }, [setConnectionForm]);
  
  const handleSavePasswordChange = useCallback((e) => {
    setConnectionForm(prev => ({ ...prev, savePassword: e.target.checked }));
  }, [setConnectionForm]);

  // Connect from history
  const connectFromHistory = useCallback((connection) => {
    const isTelnet = connection.connectionType === 'telnet';
    setConnectionForm({
      connectionType: isTelnet ? 'ssh' : (connection.connectionType || 'ssh'), // Telnet uses ssh form with checkbox
      useTelnet: isTelnet, // Set checkbox for telnet connections
      host: connection.host,
      port: connection.port || (isTelnet ? '23' : '22'),
      user: connection.user,
      password: connection.password || '',
      sessionName: connection.sessionName || connection.name || '',
      savePassword: !!connection.password,
      serialPort: connection.serialPort || '',
      baudRate: connection.baudRate || '9600',
      dataBits: connection.dataBits || '8',
      stopBits: connection.stopBits || '1',
      parity: connection.parity || 'none',
      flowControl: connection.flowControl || 'none',
      postProcessing: connection.postProcessing || [],
      postProcessingEnabled: connection.postProcessingEnabled !== false
    });
    setShowConnectionForm(true);
  }, [setConnectionForm, setShowConnectionForm]);

  // Group dialog handlers
  const handleCreateGroupFromDialog = useCallback(() => {
    if (pendingSessionForGroup) {
      const groupName = newGroupName.trim() || `Group ${groups.length + 1}`;
      const newGroupId = createGroup(groupName);
      
      if (pendingSessionForGroup.type === 'existing') {
        addSessionToGroup(pendingSessionForGroup.sessionId, newGroupId);
      } else if (pendingSessionForGroup.type === 'new') {
        addSessionToGroup(pendingSessionForGroup.sessionId, newGroupId);
      }
      
      setShowGroupNameDialog(false);
      setNewGroupName('');
      setPendingSessionForGroup(null);
    }
  }, [pendingSessionForGroup, newGroupName, groups.length, createGroup, addSessionToGroup, setShowGroupNameDialog, setNewGroupName, setPendingSessionForGroup]);
  
  const handleCloseGroupDialog = useCallback(() => {
    setShowGroupNameDialog(false);
    setNewGroupName('');
    setPendingSessionForGroup(null);
  }, [setShowGroupNameDialog, setNewGroupName, setPendingSessionForGroup]);
  
  const handleGroupNameChange = useCallback((e) => {
    setNewGroupName(e.target.value);
  }, [setNewGroupName]);
  
  const handleGroupDialogKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleCreateGroupFromDialog();
    }
  }, [handleCreateGroupFromDialog]);

  // Settings handlers
  const handleScrollbackChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 100 && value <= 50000) {
      setScrollbackLines(value);
      localStorage.setItem('ash-scrollback', value.toString());
    }
  }, [setScrollbackLines]);
  
  const handleTerminalFontSizeChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 8 && value <= 32) {
      setTerminalFontSize(value);
      localStorage.setItem('ash-terminal-font-size', value.toString());
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
  }, [setTerminalFontSize, terminalInstances, resizeTerminal]);
  
  const handleTerminalFontFamilyChange = useCallback((e) => {
    const value = e.target.value;
    setTerminalFontFamily(value);
    localStorage.setItem('ash-terminal-font-family', value);
    setTimeout(() => {
      Object.keys(terminalInstances.current).forEach(sessionId => {
        const terminal = terminalInstances.current[sessionId];
        if (terminal) {
          terminal.options.fontFamily = value;
          resizeTerminal();
        }
      });
    }, 0);
  }, [setTerminalFontFamily, terminalInstances, resizeTerminal]);
  
  const handleUiFontFamilyChange = useCallback((e) => {
    const value = e.target.value;
    setUiFontFamily(value);
    localStorage.setItem('ash-ui-font-family', value);
    document.documentElement.style.setProperty('--ui-font-family', value);
  }, [setUiFontFamily]);

  return {
    handleInputChange,
    handleMouseDown,
    handleMouseUp,
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
  };
}

