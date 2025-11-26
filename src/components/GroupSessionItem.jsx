import React, { memo, useCallback } from 'react';

/**
 * Session item within a group - memoized for performance
 */
export const GroupSessionItem = memo(function GroupSessionItem({
  session,
  isActive,
  groupId,
  savedSessionId,
  onSwitch,
  onDisconnect,
  onDragStart,
  onRemoveFromGroup,
  onOpenSettings
}) {
  const handleRemove = useCallback((e) => {
    e.stopPropagation();
    if (savedSessionId) {
      onRemoveFromGroup(savedSessionId, groupId);
    }
  }, [savedSessionId, groupId, onRemoveFromGroup]);

  const handleDisconnect = useCallback((e) => {
    e.stopPropagation();
    onDisconnect(session.id);
  }, [session.id, onDisconnect]);

  const handleSwitch = useCallback(() => {
    onSwitch(session.id);
  }, [session.id, onSwitch]);

  const handleDragStart = useCallback((e) => {
    onDragStart(e, session.id);
  }, [session.id, onDragStart]);

  const handleSettings = useCallback((e) => {
    e.stopPropagation();
    if (onOpenSettings) {
      onOpenSettings(session);
    }
  }, [session, onOpenSettings]);

  return (
    <div
      className={`session-item group-session-item ${isActive ? 'active' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onClick={handleSwitch}
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
          className="remove-from-group-btn"
          onClick={handleRemove}
          title="Remove from Group"
        >
          🗑
        </button>
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

