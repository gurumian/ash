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
  onToggleExpanded,
  onExport
}) {
  const [executingCommandIndex, setExecutingCommandIndex] = useState(null);
  const [copied, setCopied] = useState(false);

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

  const handleCopyToClipboard = useCallback(async (e) => {
    e.stopPropagation();
    try {
      const libraryJson = JSON.stringify(library, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(libraryJson);
        // Show visual feedback
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = libraryJson;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy library:', error);
      alert('Failed to copy library to clipboard: ' + error.message);
    }
  }, [library]);

  const handleExportToFile = useCallback((e) => {
    e.stopPropagation();
    if (onExport) {
      onExport(library);
    }
  }, [library, onExport]);

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
          className="library-copy-btn"
          onClick={handleCopyToClipboard}
          title={copied ? 'Copied!' : 'Copy Library to Clipboard'}
          style={{
            padding: '4px',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: copied ? 'rgba(0, 255, 65, 0.2)' : 'rgba(0, 255, 65, 0.1)',
            border: copied ? '1px solid #00ff41' : '1px solid rgba(0, 255, 65, 0.3)',
            color: '#00ff41',
            cursor: 'pointer',
            borderRadius: '4px',
            marginRight: '4px',
            transition: 'all 0.2s ease'
          }}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00ff41" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          )}
        </button>
        {onExport && (
          <button
            className="library-export-btn"
            onClick={handleExportToFile}
            title="Export Library to File"
            style={{
              padding: '4px',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 255, 65, 0.1)',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              color: '#00ff41',
              cursor: 'pointer',
              borderRadius: '4px',
              marginRight: '4px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
          </button>
        )}
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

