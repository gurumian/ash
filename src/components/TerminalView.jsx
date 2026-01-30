import React, { memo, useCallback, useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TabItem } from './TabItem';
import { TerminalSearchBar } from './TerminalSearchBar';
import { SessionContent } from './SessionContent';

/**
 * Stopwatch component - independent timer with play, stop, reset controls per session
 */
function Stopwatch({ sessionId, stopwatchState, onStart, onStop, onReset }) {
  const { isRunning, elapsed } = stopwatchState || { isRunning: false, elapsed: 0 };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}' ${secs.toString().padStart(2, '0')}"`;
    }
    return `${minutes}' ${secs.toString().padStart(2, '0')}"`;
  };

  return (
    <div className="stopwatch-container">
      <span className="stopwatch-time">⏱ {formatTime(elapsed)}</span>
      <div className="stopwatch-controls">
        {!isRunning ? (
          <button
            className="stopwatch-btn play-btn"
            onClick={() => onStart(sessionId)}
            title="Start timer"
          >
            ▶
          </button>
        ) : (
          <button
            className="stopwatch-btn stop-btn"
            onClick={() => onStop(sessionId)}
            title="Stop timer"
          >
            ⏸
          </button>
        )}
        <button
          className="stopwatch-btn reset-btn"
          onClick={() => onReset(sessionId)}
          title="Reset timer"
          disabled={elapsed === 0}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

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
  onCloseSearchBar,
  showAICommandInput, // For button state (toggles AIChatSidebar)
  onToggleAICommandInput, // Toggles AIChatSidebar
  onUpdateSession, // For SessionContent to update session state
  onFileDrop,
  onReconnectSession,
  reconnectingSessions,
  stopwatchState,
  onStartStopwatch,
  onStopStopwatch,
  onResetStopwatch,
  backendStatus,
  pendingUserRequest,
  onRespondToRequest,
  llmSettings,
  sshConnections,
  resizeTerminal, // Function to resize terminal, needed by SessionContent
  iperfLongTermData
}) {
  const { t } = useTranslation('common');
  // Track previous value for change detection (debug only)
  // showAICommandInput is now used for button state (toggles AIChatSidebar)
  const handleTabDragOver = useCallback((e, index) => {
    // Visual feedback can be added here if needed
  }, []);

  const handleTabDrop = useCallback((draggedSessionId, targetIndex) => {
    if (onReorderTabs) {
      onReorderTabs(draggedSessionId, targetIndex);
    }
  }, [onReorderTabs]);

  const handleDragOver = useCallback((e) => {
    // Only allow file drops on SSH sessions - early return for performance
    if (!activeSession || activeSession.connectionType !== 'ssh' || !activeSession.isConnected) {
      return;
    }

    // Only prevent default if it's actually a file drag
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, [activeSession]);

  const handleDrop = useCallback((e) => {
    // Only handle file drops on SSH sessions - early return for performance
    if (!activeSession || activeSession.connectionType !== 'ssh' || !activeSession.isConnected) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && onFileDrop) {
      // Use the first file
      const file = files[0];
      // In Electron, file.path should be available
      const filePath = file.path || file.name;
      onFileDrop(filePath);
    }
  }, [activeSession, onFileDrop]);

  // We need to pass sshConnections to SessionContent. 
  // It's not passed to TerminalView explicitly in props above? 
  // Checking App.jsx: it's not passed! 
  // Wait, I missed sshConnections in TerminalView props list in App.jsx?
  // I need to check if sshConnections is available.
  // TerminalView usage in App.jsx (Step 102/116) does NOT show sshConnections passed.
  // BUT useTerminalManagement provides it.
  // TerminalView normally didn't need it (App.jsx managed connection logic).
  // But SessionContent -> useAICommand NEEDS it.
  // I MUST add sshConnections to TerminalView props in App.jsx.
  // I missed this dependency.

  // I'll assume I update App.jsx to pass sshConnections.
  // Or I can pick it up from window? No.
  // I'll assume current props list for now, but I need to fix App.jsx AGAIN to pass sshConnections.

  return (
    <div className="terminal-area">
      {activeSession ? (
        <div
          className="terminal-container"
          onDragOver={activeSession?.connectionType === 'ssh' && activeSession?.isConnected ? handleDragOver : undefined}
          onDrop={activeSession?.connectionType === 'ssh' && activeSession?.isConnected ? handleDrop : undefined}
        >
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
                {activeSession && !activeSession.isConnected && onReconnectSession && (
                  <button
                    className="log-btn reconnect-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onReconnectSession && !(reconnectingSessions?.get(activeSessionId))) {
                        onReconnectSession(activeSessionId);
                      }
                    }}
                    disabled={reconnectingSessions?.get(activeSessionId) || false}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    title={reconnectingSessions?.get(activeSessionId) ? t('common:reconnecting') : t('common:reconnect')}
                    style={{
                      marginRight: '8px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: 'var(--theme-surface)',
                      border: '1px solid var(--theme-accent)',
                      color: 'var(--theme-text)',
                      borderRadius: '4px',
                      cursor: reconnectingSessions?.get(activeSessionId) ? 'not-allowed' : 'pointer',
                      opacity: reconnectingSessions?.get(activeSessionId) ? 0.6 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '28px',
                      width: '28px',
                      height: '28px',
                      zIndex: 10000,
                      position: 'relative'
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        animation: reconnectingSessions?.get(activeSessionId) ? 'spin 1s linear infinite' : 'none',
                        display: 'inline-block'
                      }}
                    >
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                      <path d="M3 21v-5h5" />
                    </svg>
                  </button>
                )}
                <button
                  className="log-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onToggleAICommandInput) {
                      onToggleAICommandInput();
                    } else if (process.env.NODE_ENV === 'development') {
                      console.error('ERROR: onToggleAICommandInput is not defined!');
                    }
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  title={window.electronAPI?.platform === 'darwin' ? `${t('common:aiCommand')} (⌘⇧A)` : `${t('common:aiCommand')} (Ctrl+Shift+A)`}
                  style={{
                    marginRight: '8px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    background: showAICommandInput ? 'var(--theme-accent)' : 'var(--theme-surface)',
                    border: '1px solid var(--theme-accent)',
                    color: showAICommandInput ? 'var(--theme-bg)' : 'var(--theme-text)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    zIndex: 10000,
                    position: 'relative'
                  }}
                >
                  AI
                </button>
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
                    ? t('common:recordingDesc')
                    : t('common:startRecordingDesc')}
                >
                  ●
                </button>
                <button
                  className="log-btn save-log"
                  onClick={() => onSaveLog(activeSessionId)}
                  disabled={!sessionLogs.current[activeSessionId]?.content && !sessionLogs.current[activeSessionId]?.contentArray?.length}
                  title={t('common:saveLogDesc')}
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
                  disabled={!sessionLogs.current[activeSessionId]?.content && !sessionLogs.current[activeSessionId]?.contentArray?.length}
                  title={t('common:clearLogDesc')}
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
                  {logStates[activeSessionId]?.isLogging ? t('common:recording') : t('common:notRecording')}
                </span>
                <Stopwatch
                  sessionId={activeSessionId}
                  stopwatchState={stopwatchState}
                  onStart={onStartStopwatch}
                  onStop={onStopStopwatch}
                  onReset={onResetStopwatch}
                />
              </div>
            )}
          </div>
          <div className="terminal-content-container">
            {sessions.map(session => (
              <div
                key={session.id}
                style={{ display: activeSessionId === session.id ? 'block' : 'none', height: '100%', width: '100%', position: 'absolute' }}
              >
                <SessionContent
                  session={session}
                  isActive={activeSessionId === session.id}
                  terminalRef={(el) => terminalRefs.current[session.id] = el}
                  terminalInstance={terminalInstances.current[session.id]}
                  terminalInstances={terminalInstances}
                  sshConnections={sshConnections}
                  llmSettings={llmSettings}
                  onUpdateSession={onUpdateSession}
                  backendStatus={backendStatus}
                  pendingUserRequest={pendingUserRequest}
                  handleAskUserResponse={onRespondToRequest}
                  activeSessionId={session.id} // Pass own IDs
                  resizeTerminal={() => resizeTerminal && resizeTerminal()}
                  iperfLongTermData={iperfLongTermData}
                />
              </div>
            ))}
            {activeSessionId && (
              <>
                <TerminalSearchBar
                  terminal={terminalInstances.current[activeSessionId]}
                  searchAddon={searchAddons?.current[activeSessionId]}
                  isVisible={showSearchBar}
                  onClose={onCloseSearchBar}
                />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="welcome-screen">
          <h2>{t('common:welcomeToAsh')}</h2>
          <p>{t('common:createNewSessionToStart')}</p>
          <button
            className="welcome-connect-btn"
            onClick={onShowConnectionForm}
          >
            {t('common:newSession')}
          </button>
        </div>
      )}
    </div>
  );
});
