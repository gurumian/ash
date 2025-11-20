import React, { memo, useCallback } from 'react';

/**
 * Individual session item component - memoized for performance
 */
export const SessionItem = memo(function SessionItem({
  session,
  isActive,
  onSwitch,
  onDisconnect,
  onDragStart,
  onOpenSettings
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

  const handleSettings = useCallback((e) => {
    e.stopPropagation();
    if (onOpenSettings) {
      onOpenSettings(session);
    }
  }, [session, onOpenSettings]);

  return (
    <div 
      className={`session-item ${isActive ? 'active' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
    >
      <span className="session-name">{session.name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span className={`connection-status ${session.isConnected ? 'connected' : 'disconnected'}`}>
          {session.isConnected ? '●' : '○'}
        </span>
        {onOpenSettings && (
          <button 
            className="session-settings-btn"
            onClick={handleSettings}
            title="Session Settings"
          >
            ⚙
          </button>
        )}
        <button 
          className="close-session-btn"
          onClick={handleDisconnect}
          title="Close Session"
        >
          ×
        </button>
      </div>
    </div>
  );
});

