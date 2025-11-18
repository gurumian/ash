import { useState, useCallback } from 'react';

/**
 * Custom hook for handling drag and drop operations
 */
export function useDragAndDrop({
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
}) {
  const [draggedSessionId, setDraggedSessionId] = useState(null);
  const [dragOverGroupId, setDragOverGroupId] = useState(null);

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

  const handleDrop = useCallback(async (e, groupId) => {
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
  }, [sessions, draggedSessionId, addSessionToGroup, addSavedSessionToGroup]);

  const handleDropOnNewGroup = useCallback(async (e) => {
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
              const sessionId = await createNewSessionWithData({
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
              }, true); // Don't reset form
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
  }, [sessions, draggedSessionId, connectionForm, setConnectionForm, createNewSessionWithData, setShowGroupNameDialog, setPendingSessionForGroup]);

  return {
    draggedSessionId,
    dragOverGroupId,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDropOnNewGroup
  };
}

