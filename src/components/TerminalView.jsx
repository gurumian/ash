import React, { memo, useCallback } from 'react';
import { TabItem } from './TabItem';
import { TerminalSearchBar } from './TerminalSearchBar';

/**
 * Terminal View component - Right side terminal area with tabs and terminal content
 */
export const TerminalView = memo(function TerminalView({
  activeSession,
  sessions,
  activeSessionId,
  terminalRefs,
  logStates,
  sessionLogs,
  onSwitchToSession,
  onDisconnectSession,
  onDetachTab,
  onReorderTabs,
  onStartLogging,
  onStopLogging,
  onSaveLog,
  onClearLog,
  onShowConnectionForm,
  terminalInstances,
  searchAddons,
  showSearchBar,
  onCloseSearchBar
}) {
  const handleTabDragOver = useCallback((e, index) => {
    // Visual feedback can be added here if needed
  }, []);

  const handleTabDrop = useCallback((draggedSessionId, targetIndex) => {
    if (onReorderTabs) {
      onReorderTabs(draggedSessionId, targetIndex);
    }
  }, [onReorderTabs]);
  return (
    <div className="terminal-area">
      {activeSession ? (
        <div className="terminal-container">
          <div className="terminal-header">
            <div className="tab-bar">
              {sessions.map((session, index) => (
                <TabItem
                  key={session.id}
                  session={session}
                  isActive={activeSessionId === session.id}
                  index={index}
                  onSwitch={onSwitchToSession}
                  onDisconnect={onDisconnectSession}
                  onDetachTab={onDetachTab}
                  onDragOver={handleTabDragOver}
                  onDrop={handleTabDrop}
                />
              ))}
            </div>
            {activeSessionId && (
              <div className="log-controls">
                <button 
                  className={`log-btn ${logStates[activeSessionId]?.isLogging ? 'logging' : 'not-logging'}`}
                  onClick={async () => {
                    if (logStates[activeSessionId]?.isLogging) {
                      const logEntry = await onStopLogging(activeSessionId);
                      if (logEntry && terminalInstances.current[activeSessionId]) {
                        terminalInstances.current[activeSessionId].write(logEntry);
                      }
                    } else {
                      onStartLogging(activeSessionId);
                    }
                  }}
                  title={logStates[activeSessionId]?.isLogging 
                    ? 'Recording - Automatically saving logs to file. Click to stop.' 
                    : 'Start Recording - Begin automatically saving logs to file'}
                >
                  ●
                </button>
                <button 
                  className="log-btn save-log"
                  onClick={() => onSaveLog(activeSessionId)}
                  disabled={!sessionLogs.current[activeSessionId]?.content}
                  title="Save Log - Save current buffer to file (appends to existing file)"
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                </button>
                <button 
                  className="log-btn clear-log"
                  onClick={() => onClearLog(activeSessionId)}
                  disabled={!sessionLogs.current[activeSessionId]?.content}
                  title="Clear Log - Clear current buffer (saved logs remain in file)"
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
                <span className="log-status">
                  {logStates[activeSessionId]?.isLogging ? 'Recording' : 'Not Recording'}
                </span>
              </div>
            )}
          </div>
          <div className="terminal-content-container">
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
            {activeSessionId && (
              <TerminalSearchBar
                terminal={terminalInstances.current[activeSessionId]}
                searchAddon={searchAddons?.current[activeSessionId]}
                isVisible={showSearchBar}
                onClose={onCloseSearchBar}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="welcome-screen">
          <h2>Welcome to ash SSH Client</h2>
          <p>Create a new session to get started</p>
          <button 
            className="welcome-connect-btn"
            onClick={onShowConnectionForm}
          >
            New Session
          </button>
        </div>
      )}
    </div>
  );
});

