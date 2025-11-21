import React, { memo } from 'react';

/**
 * Status Bar component - Bottom status bar showing connection info and session count
 */
export const StatusBar = memo(function StatusBar({ activeSession, sessionsCount, tftpStatus }) {
  const getConnectionText = () => {
    if (!activeSession) {
      return 'Ready';
    }
    
    if (activeSession.connectionType === 'serial') {
      return `Connected to Serial: ${activeSession.serialPort}`;
    } else {
      return `Connected to ${activeSession.user}@${activeSession.host}:${activeSession.port}`;
    }
  };

  return (
    <div className="status-bar">
      <div className="status-left">
        <span>{getConnectionText()}</span>
        {tftpStatus?.running && (
          <span className="status-tftp-indicator" title={`TFTP Server: UDP/${tftpStatus.port}`}>
            • TFTP: UDP/{tftpStatus.port}
          </span>
        )}
      </div>
      <div className="status-right">
        <span>Sessions: {sessionsCount}</span>
      </div>
    </div>
  );
});

