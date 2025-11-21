import React, { memo, useCallback, useState } from 'react';

/**
 * Library Item component - Displays a library with commands that can be executed one by one
 */
export const LibraryItem = memo(function LibraryItem({
  library,
  activeSessionId,
  sessions,
  sshConnections,
  terminalFontFamily,
  onEdit,
  onDelete,
  onToggleExpanded
}) {
  const [executingCommandIndex, setExecutingCommandIndex] = useState(null);

  const handleToggleExpanded = useCallback(() => {
    onToggleExpanded(library.id);
  }, [library.id, onToggleExpanded]);

  const handleEdit = useCallback((e) => {
    e.stopPropagation();
    onEdit(library);
  }, [library, onEdit]);

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    if (window.confirm(`Delete library "${library.name}"?`)) {
      onDelete(library.id);
    }
  }, [library.id, library.name, onDelete]);

  const executeCommand = useCallback((command, index) => {
    if (!activeSessionId) {
      alert('Please select an active session first');
      return;
    }

    const session = sessions.find(s => s.id === activeSessionId);
    if (!session || !session.isConnected) {
      alert('Session is not connected');
      return;
    }

    const connection = sshConnections.current[activeSessionId];
    if (!connection || !connection.isConnected) {
      alert('Connection is not available');
      return;
    }

    setExecutingCommandIndex(index);
    
    // Execute the command
    try {
      connection.write(command + '\r\n');
      
      // Reset executing state after a short delay
      setTimeout(() => {
        setExecutingCommandIndex(null);
      }, 500);
    } catch (error) {
      console.error('Failed to execute command:', error);
      alert('Failed to execute command: ' + error.message);
      setExecutingCommandIndex(null);
    }
  }, [activeSessionId, sessions, sshConnections]);

  const hasActiveSession = activeSessionId && sessions.some(s => s.id === activeSessionId && s.isConnected);

  return (
    <div className="library-item">
      <div 
        className="library-header"
        onClick={handleToggleExpanded}
        style={{ cursor: 'pointer' }}
      >
        <button
          className="library-toggle"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleExpanded();
          }}
          title={library.isExpanded ? 'Collapse' : 'Expand'}
        >
          {library.isExpanded ? '▼' : '▶'}
        </button>
        <span className="library-name" title={library.description}>
          {library.name}
        </span>
        {library.description && (
          <span className="library-description" style={{ 
            fontSize: '11px', 
            opacity: 0.6, 
            marginLeft: '8px',
            fontStyle: 'italic'
          }}>
            {library.description}
          </span>
        )}
        <span className="library-count" style={{ marginLeft: 'auto', marginRight: '8px' }}>
          ({library.commands?.length || 0})
        </span>
        <button
          className="library-edit-btn"
          onClick={handleEdit}
          title="Edit Library"
        >
          ⚙
        </button>
        <button
          className="library-delete-btn"
          onClick={handleDelete}
          title="Delete Library"
        >
          🗑
        </button>
      </div>
      
      {library.isExpanded && (
        <div className="library-commands">
          {!hasActiveSession && (
            <div style={{
              padding: '8px',
              fontSize: '12px',
              color: '#ffaa00',
              backgroundColor: 'rgba(255, 170, 0, 0.1)',
              borderRadius: '4px',
              marginBottom: '8px'
            }}>
              ⚠ Select and connect to a session to execute commands
            </div>
          )}
          
          {library.commands && library.commands.length > 0 ? (
            library.commands.map((cmd, index) => {
              const isExecuting = executingCommandIndex === index;
              return (
                <div
                  key={cmd.id || index}
                  className="library-command-item"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '8px',
                    marginBottom: '4px',
                    backgroundColor: '#1a1a1a',
                    borderRadius: '4px',
                    border: '1px solid #1a1a1a',
                    opacity: hasActiveSession ? 1 : 0.6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      color: '#00ff41', 
                      fontSize: '12px',
                      opacity: 0.5,
                      userSelect: 'none',
                      minWidth: '20px'
                    }}>
                      {index + 1}.
                    </span>
                    <span style={{ 
                      flex: 1, 
                      fontFamily: terminalFontFamily || "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace", 
                      fontSize: '13px',
                      color: '#00ff41',
                      wordBreak: 'break-all'
                    }}>
                      {cmd.command}
                    </span>
                    <button
                      type="button"
                      onClick={() => executeCommand(cmd.command, index)}
                      disabled={!hasActiveSession || isExecuting}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        backgroundColor: hasActiveSession && !isExecuting ? '#00ff41' : '#1a1a1a',
                        border: hasActiveSession && !isExecuting ? '1px solid #00ff41' : '1px solid #1a1a1a',
                        color: hasActiveSession && !isExecuting ? '#000000' : '#666',
                        cursor: hasActiveSession && !isExecuting ? 'pointer' : 'not-allowed',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        opacity: hasActiveSession && !isExecuting ? 1 : 0.5
                      }}
                      title={hasActiveSession ? 'Execute command' : 'Connect to a session first'}
                    >
                      {isExecuting ? '...' : '▶'}
                    </button>
                  </div>
                  {cmd.description && (
                    <div style={{
                      fontSize: '11px',
                      color: '#00ff41',
                      opacity: 0.6,
                      paddingLeft: '28px',
                      fontStyle: 'italic'
                    }}>
                      {cmd.description}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{
              padding: '12px',
              textAlign: 'center',
              color: '#00ff41',
              opacity: 0.5,
              fontSize: '12px'
            }}>
              No commands in this library
            </div>
          )}
        </div>
      )}
    </div>
  );
});

