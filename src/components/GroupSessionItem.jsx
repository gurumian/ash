import React, { memo, useCallback } from 'react';
import { ConnectionStatusIcon } from './ConnectionStatusIcon';

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
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  isReorderTarget = false,
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

  const handleDragEnd = useCallback((e) => {
    if (onDragEnd) onDragEnd(e);
  }, [onDragEnd]);

  const handleSettings = useCallback((e) => {
    e.stopPropagation();
    if (onOpenSettings) {
      onOpenSettings(session);
    }
  }, [session, onOpenSettings]);

  return (
    <div
      className={`session-item group-session-item ${isActive ? 'active' : ''} ${isReorderTarget ? 'reorder-target' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={handleSwitch}
    >
      <span className="session-name">{session.name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <ConnectionStatusIcon 
          isConnected={session.isConnected}
          className={`connection-status ${session.isConnected ? 'connected' : 'disconnected'}`}
        />
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
          className="stop-session-btn"
          onClick={handleDisconnect}
          title="Stop Session"
        >
          ⏹
        </button>
        <button
          className="remove-from-group-btn"
          onClick={handleRemove}
          title="Remove from Group"
        >
          🗑
        </button>
      </div>
    </div>
  );
});

