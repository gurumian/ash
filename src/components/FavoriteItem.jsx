import React, { memo, useCallback } from 'react';

/**
 * Favorite item component - memoized for performance
 */
export const FavoriteItem = memo(function FavoriteItem({
  fav,
  onCreateNewSessionWithData
}) {
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
      alert('Connection failed: ' + error.message);
    }
  }, [fav, onCreateNewSessionWithData]);

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

