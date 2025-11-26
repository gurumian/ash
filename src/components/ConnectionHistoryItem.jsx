import React, { memo, useCallback, useMemo } from 'react';

/**
 * Connection history item component - memoized for performance
 */
export const ConnectionHistoryItem = memo(function ConnectionHistoryItem({
  conn,
  index,
  favorites,
  onConnectFromHistory,
  onToggleFavorite,
  onRemoveConnection,
  onDragStart
}) {
  const isSerial = conn.connectionType === 'serial';
  
  // Helper function to match connection for favorites (by UUID, or by connection info + sessionName)
  const matchesFavorite = (f, connection) => {
    // First check by UUID if both have it
    if (f.id && connection.id && f.id === connection.id) {
      return true;
    }
    
    // Fallback to connection info + sessionName matching
    const sessionNameMatch = (f.sessionName || f.name || '') === (connection.sessionName || connection.name || '');
    if (connection.connectionType === 'serial') {
      const connectionMatch = f.connectionType === 'serial' && f.serialPort === connection.serialPort;
      return connectionMatch && sessionNameMatch;
    } else {
      const connectionMatch = f.host === connection.host && 
                             f.user === connection.user && 
                             (f.port || '22') === (connection.port || '22');
      return connectionMatch && sessionNameMatch;
    }
  };

  // Memoize expensive calculations
  const isFavorite = useMemo(() => {
    return favorites.some(f => matchesFavorite(f, conn));
  }, [favorites, conn]);

  const sessionId = useMemo(() => {
    if (isSerial) {
      return `saved-serial-${conn.serialPort}-${index}`;
    } else {
      return `saved-${conn.host}-${conn.user}-${conn.port || '22'}-${index}`;
    }
  }, [isSerial, conn, index]);

  const displayName = useMemo(() => {
    return conn.sessionName || conn.name || (isSerial 
      ? `Serial: ${conn.serialPort}`
      : `${conn.user}@${conn.host}`);
  }, [conn, isSerial]);

  const tooltip = useMemo(() => {
    return isSerial
      ? `${conn.serialPort} - Drag to group or click to connect`
      : `${conn.user}@${conn.host} - Drag to group or click to connect`;
  }, [isSerial, conn]);

  const handleDragStart = useCallback((e) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'saved-session',
      connection: conn,
      sessionId: sessionId
    }));
    onDragStart(e, sessionId);
  }, [conn, sessionId, onDragStart]);

  const handleClick = useCallback(() => {
    onConnectFromHistory(conn);
  }, [conn, onConnectFromHistory]);

  const handleToggleFavorite = useCallback((e) => {
    e.stopPropagation();
    onToggleFavorite(conn);
  }, [conn, onToggleFavorite]);

  const handleRemove = useCallback((e) => {
    e.stopPropagation();
    if (onRemoveConnection) {
      onRemoveConnection(conn);
    }
  }, [conn, onRemoveConnection]);

  return (
    <div 
      className="session-item session-list-item"
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      title={tooltip}
    >
      <span className="session-name">
        {displayName}
      </span>
      <button 
        className="favorite-btn"
        onClick={handleToggleFavorite}
        title="Toggle Favorite"
      >
        {isFavorite ? '★' : '☆'}
      </button>
      {onRemoveConnection && (
        <button 
          className="remove-from-group-btn"
          onClick={handleRemove}
          title="Remove from Session List"
        >
          🗑
        </button>
      )}
    </div>
  );
});

