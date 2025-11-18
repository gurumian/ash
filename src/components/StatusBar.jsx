import React from 'react';

/**
 * Status Bar component - Bottom status bar showing connection info and session count
 */
export function StatusBar({ activeSession, sessionsCount }) {
  return (
    <div className="status-bar">
      <div className="status-left">
        {activeSession ? (
          <span>Connected to {activeSession.user}@{activeSession.host}:{activeSession.port}</span>
        ) : (
          <span>Ready</span>
        )}
      </div>
      <div className="status-right">
        <span>Sessions: {sessionsCount}</span>
      </div>
    </div>
  );
}

