import React, { memo } from 'react';

/**
 * Status Bar component - Bottom status bar showing connection info, servers, and session count
 */
export const StatusBar = memo(function StatusBar({ 
  activeSession, 
  sessionsCount, 
  tftpStatus, 
  webStatus,
  iperfStatus,
  onTftpClick,
  onWebClick,
  onIperfClick,
}) {
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
          <button 
            type="button"
            className="status-indicator status-tftp-indicator" 
            title={`TFTP Server: UDP/${tftpStatus.port}\nClick to open TFTP dialog`}
            onClick={onTftpClick}
          >
            • TFTP: UDP/{tftpStatus.port}
          </button>
        )}
        {webStatus?.running && (
          <button 
            type="button"
            className="status-indicator status-web-indicator" 
            title={`Web Server: HTTP/${webStatus.port}\nClick to open Web Server dialog`}
            onClick={onWebClick}
          >
            • Web: HTTP/{webStatus.port}
          </button>
        )}
        {iperfStatus?.running && (
          <button 
            type="button"
            className="status-indicator status-iperf-indicator" 
            title={`iperf3 Server: TCP/${iperfStatus.port}\nClick to open iperf3 dialog`}
            onClick={onIperfClick}
          >
            • iperf3: TCP/{iperfStatus.port}
          </button>
        )}
      </div>
      <div className="status-right">
        <span>Sessions: {sessionsCount}</span>
      </div>
    </div>
  );
});

