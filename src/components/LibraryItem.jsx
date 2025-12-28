import React, { memo, useCallback, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import './LibraryItem.css';

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleToggleExpanded = useCallback(() => {
    onToggleExpanded(library.id);
  }, [library.id, onToggleExpanded]);

  const handleEdit = useCallback((e) => {
    e.stopPropagation();
    onEdit(library);
  }, [library, onEdit]);

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    onDelete(library.id);
  }, [library.id, onDelete]);

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
          <span className="library-description">
            {library.description}
          </span>
        )}
        <span className="library-count">
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
          className={`library-copy-btn ${copied ? 'copied' : ''}`}
          onClick={handleCopyToClipboard}
          title={copied ? 'Copied!' : 'Copy Library to Clipboard'}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <div className="library-commands-warning">
              ⚠ Select and connect to a session to execute commands
            </div>
          )}
          
          {library.commands && library.commands.length > 0 ? (
            library.commands.map((cmd, index) => {
              const isExecuting = executingCommandIndex === index;
              return (
                <div
                  key={cmd.id || index}
                  className={`library-command-item ${!hasActiveSession ? 'disabled' : ''}`}
                >
                  <div className="library-command-item-view">
                    <span className="library-command-number">
                      {index + 1}.
                    </span>
                    <span 
                      className="library-command-text"
                      style={{
                        fontFamily: terminalFontFamily || "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace"
                      }}
                    >
                      {cmd.command}
                    </span>
                    <button
                      type="button"
                      onClick={() => executeCommand(cmd.command, index)}
                      disabled={!hasActiveSession || isExecuting}
                      className={`library-command-execute-btn ${hasActiveSession && !isExecuting ? 'enabled' : 'disabled'}`}
                      title={hasActiveSession ? 'Execute command' : 'Connect to a session first'}
                    >
                      {isExecuting ? '...' : '▶'}
                    </button>
                  </div>
                  {cmd.description && (
                    <div className="library-command-description">
                      {cmd.description}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="library-commands-empty">
              No commands in this library
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Library"
        message={`Are you sure you want to delete library "${library.name}"? This action cannot be undone.`}
      />
    </div>
  );
});

