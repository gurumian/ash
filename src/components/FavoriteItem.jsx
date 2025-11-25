import React, { memo, useCallback } from 'react';

/**
 * Favorite item component - memoized for performance
 */
export const FavoriteItem = memo(function FavoriteItem({
  fav,
  onCreateNewSessionWithData,
  setErrorDialog
}) {
  // Helper function to format connection errors
  const formatConnectionError = useCallback((error) => {
    const errorMessage = error.message || String(error);
    const errorCode = error.code || '';
    
    let title = 'Connection Failed';
    let message = 'Failed to establish connection';
    let detail = errorMessage;
    
    // Parse common SSH error codes
    if (errorCode === 'EHOSTUNREACH' || errorMessage.includes('EHOSTUNREACH')) {
      title = 'Host Unreachable';
      message = 'Cannot reach the target host';
      const match = errorMessage.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
      const host = match ? match[1] : (error.address || 'target host');
      const port = match ? match[2] : (error.port || '22');
      detail = `The host ${host}:${port} is not reachable.\n\nPossible causes:\n- Host is down or unreachable\n- Network connectivity issues\n- Firewall blocking the connection\n- Incorrect host address`;
    } else if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
      title = 'Connection Refused';
      message = 'The connection was refused';
      const match = errorMessage.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
      const host = match ? match[1] : (error.address || 'target host');
      const port = match ? match[2] : (error.port || '22');
      detail = `Connection to ${host}:${port} was refused.\n\nPossible causes:\n- SSH service is not running on the target\n- Port ${port} is not open\n- Firewall is blocking the connection`;
    } else if (errorCode === 'ETIMEDOUT' || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
      title = 'Connection Timeout';
      message = 'Connection attempt timed out';
      detail = `The connection attempt timed out.\n\nPossible causes:\n- Network is slow or unstable\n- Host is not responding\n- Firewall is blocking the connection`;
    } else if (errorCode === 'ENOTFOUND' || errorMessage.includes('ENOTFOUND')) {
      title = 'Host Not Found';
      message = 'Hostname could not be resolved';
      detail = `The hostname could not be resolved to an IP address.\n\nPossible causes:\n- Incorrect hostname or domain name\n- DNS server issues\n- Network connectivity problems`;
    } else if (errorMessage.includes('authentication') || errorMessage.includes('password') || errorMessage.includes('Permission denied')) {
      title = 'Authentication Failed';
      message = 'Invalid credentials';
      detail = `Authentication failed.\n\nPlease check:\n- Username is correct\n- Password is correct\n- User has SSH access permissions`;
    }
    
    return { title, message, detail };
  }, []);

  const handleClick = useCallback(async () => {
    try {
      await onCreateNewSessionWithData({
        connectionType: fav.connectionType || 'ssh',
        host: fav.host || '',
        port: fav.port || '22',
        user: fav.user || '',
        password: fav.password || '',
        sessionName: fav.sessionName || fav.name || '',
        savePassword: !!fav.password,
        serialPort: fav.serialPort || '',
        baudRate: fav.baudRate || '9600',
        dataBits: fav.dataBits || '8',
        stopBits: fav.stopBits || '1',
        parity: fav.parity || 'none',
        flowControl: fav.flowControl || 'none'
      }, true);
    } catch (error) {
      console.error('Failed to connect from favorite:', error);
      if (setErrorDialog) {
        const formattedError = formatConnectionError(error);
        setErrorDialog({
          isOpen: true,
          title: formattedError.title,
          message: formattedError.message,
          detail: formattedError.detail
        });
      } else {
        alert('Connection failed: ' + error.message);
      }
    }
  }, [fav, onCreateNewSessionWithData, setErrorDialog, formatConnectionError]);

  const isSerial = fav.connectionType === 'serial';
  const tooltip = isSerial 
    ? fav.serialPort 
    : `${fav.user}@${fav.host}`;

  return (
    <div 
      className="session-item favorite"
      onClick={handleClick}
      title={tooltip}
    >
      <span className="session-name">⭐ {fav.name}</span>
    </div>
  );
});

