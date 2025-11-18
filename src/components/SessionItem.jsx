import React, { memo, useCallback } from 'react';

/**
 * Individual session item component - memoized for performance
 */
export const SessionItem = memo(function SessionItem({
  session,
  isActive,
  onSwitch,
  onDisconnect,
  onDragStart
}) {
  const handleDragStart = useCallback((e) => {
    onDragStart(e, session.id);
  }, [session.id, onDragStart]);

  const handleClick = useCallback(() => {
    onSwitch(session.id);
  }, [session.id, onSwitch]);

  const handleDisconnect = useCallback((e) => {
    e.stopPropagation();
    onDisconnect(session.id);
  }, [session.id, onDisconnect]);

  return (
    <div 
      className={`session-item ${isActive ? 'active' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
    >
      <span className="session-name">{session.name}</span>
      <span className={`connection-status ${session.isConnected ? 'connected' : 'disconnected'}`}>
        {session.isConnected ? '●' : '○'}
      </span>
      <button 
        className="close-session-btn"
        onClick={handleDisconnect}
        title="Close Session"
      >
        ×
      </button>
    </div>
  );
});

