import React, { memo } from 'react';

/**
 * Session Manager component - Left sidebar for managing sessions, groups, and connections
 */
export const SessionManager = memo(function SessionManager({
  showSessionManager,
  sessionManagerWidth,
  sessions,
  activeSessionId,
  groups,
  favorites,
  connectionHistory,
  draggedSessionId,
  dragOverGroupId,
  editingGroupId,
  editingGroupName,
  setEditingGroupName,
  onShowSettings,
  onShowConnectionForm,
  onCreateNewSessionWithData,
  onConnectFromHistory,
  onToggleFavorite,
  onSwitchToSession,
  onDisconnectSession,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onConnectGroup,
  onToggleGroupExpanded,
  onStartEditingGroupName,
  onSaveGroupName,
  onCancelEditingGroupName,
  onRemoveSessionFromGroup,
  onDeleteGroup,
  onCreateGroup,
  setGroups
}) {
  return (
    <div 
      className={`session-manager ${!showSessionManager ? 'hidden' : ''}`}
      style={{ width: showSessionManager ? `${sessionManagerWidth}px` : '0' }}
    >
      <div className="session-manager-header">
        <h3>Sessions</h3>
        <div className="header-buttons">
          <button 
            className="settings-btn"
            onClick={onShowSettings}
            title="Settings"
          >
            ⚙️
          </button>
          <button 
            className="new-session-btn"
            onClick={onShowConnectionForm}
            title="New Session"
          >
            +
          </button>
        </div>
      </div>
      
      {/* Favorites */}
      {favorites.length > 0 && (
        <div className="section">
          <div className="section-header">Favorites</div>
          {favorites.map((fav, index) => {
            const isSerial = fav.connectionType === 'serial';
            const tooltip = isSerial 
              ? fav.serialPort 
              : `${fav.user}@${fav.host}`;
            return (
              <div 
                key={index}
                className="session-item favorite"
                onClick={async () => {
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
                }}
                title={tooltip}
              >
                <span className="session-name">⭐ {fav.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Session List - All saved sessions */}
      {connectionHistory.length > 0 && (
        <div className="section">
          <div className="section-header">Session List</div>
          {connectionHistory.map((conn, index) => {
            const isSerial = conn.connectionType === 'serial';
            const isFavorite = isSerial 
              ? favorites.some(f => f.connectionType === 'serial' && f.serialPort === conn.serialPort)
              : favorites.some(f => f.host === conn.host && f.user === conn.user);
            const sessionId = isSerial 
              ? `saved-serial-${conn.serialPort}-${index}`
              : `saved-${conn.host}-${conn.user}-${conn.port || '22'}-${index}`;
            const displayName = conn.sessionName || conn.name || (isSerial 
              ? `Serial: ${conn.serialPort}`
              : `${conn.user}@${conn.host}`);
            const tooltip = isSerial
              ? `${conn.serialPort} - Drag to group or click to connect`
              : `${conn.user}@${conn.host} - Drag to group or click to connect`;
            
            return (
              <div 
                key={index}
                className="session-item session-list-item"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'saved-session',
                    connection: conn,
                    sessionId: sessionId
                  }));
                  onDragStart(e, sessionId);
                }}
                onClick={() => onConnectFromHistory(conn)}
                title={tooltip}
              >
                <span className="session-name">
                  {displayName}
                </span>
                <button 
                  className="favorite-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(conn);
                  }}
                  title="Toggle Favorite"
                >
                  {isFavorite ? '★' : '☆'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Groups */}
      {groups.length > 0 && (
        <div className="section">
          <div className="section-header">Groups</div>
          {groups.map(group => {
            const groupSessions = sessions.filter(s => group.sessionIds.includes(s.id));
            const savedSessions = group.savedSessions || [];
            const totalSessions = groupSessions.length + savedSessions.length;
            const allConnected = totalSessions > 0 && 
              groupSessions.every(s => s.isConnected) && 
              savedSessions.length === 0;
            
            return (
              <div key={group.id} className="group-container">
                <div 
                  className={`group-header ${dragOverGroupId === group.id ? 'drag-over' : ''} ${allConnected ? 'all-connected' : ''}`}
                  onDragOver={(e) => onDragOver(e, group.id)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, group.id)}
                  onClick={() => {
                    if (!allConnected && totalSessions > 0) {
                      onConnectGroup(group.id);
                    }
                  }}
                  style={{ cursor: (allConnected || totalSessions === 0) ? 'default' : 'pointer' }}
                >
                  <button
                    className="group-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleGroupExpanded(group.id);
                    }}
                    title={group.isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {group.isExpanded ? '▼' : '▶'}
                  </button>
                  {editingGroupId === group.id ? (
                    <input
                      type="text"
                      className="group-name-input"
                      value={editingGroupName}
                      onChange={(e) => setEditingGroupName(e.target.value)}
                      onBlur={() => onSaveGroupName(group.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onSaveGroupName(group.id);
                        } else if (e.key === 'Escape') {
                          onCancelEditingGroupName();
                        }
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span 
                      className="group-name"
                      onDoubleClick={() => onStartEditingGroupName(group.id)}
                      title="Double-click to rename"
                    >
                      {group.name}
                    </span>
                  )}
                  <span className="group-count">({totalSessions})</span>
                  <button
                    className="group-connect-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConnectGroup(group.id);
                    }}
                    title="Connect All Sessions in Group"
                    disabled={allConnected || totalSessions === 0}
                  >
                    ▶
                  </button>
                  <button
                    className="group-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteGroup(group.id);
                    }}
                    title="Delete Group"
                  >
                    ×
                  </button>
                </div>
                {group.isExpanded && (
                  <div className="group-sessions">
                    {group.sessionIds.map((sessionId, index) => {
                      const session = sessions.find(s => s.id === sessionId);
                      if (!session) return null;
                      
                      return (
                        <div
                          key={`${sessionId}-${index}`}
                          className={`session-item group-session-item ${activeSessionId === session.id ? 'active' : ''}`}
                          draggable
                          onDragStart={(e) => onDragStart(e, session.id)}
                          onClick={() => onSwitchToSession(session.id)}
                        >
                          <span className="session-name">{session.name}</span>
                          <span className={`connection-status ${session.isConnected ? 'connected' : 'disconnected'}`}>
                            {session.isConnected ? '●' : '○'}
                          </span>
                          <button
                            className="remove-from-group-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveSessionFromGroup(session.id, group.id, index);
                            }}
                            title="Remove from Group"
                          >
                            ⊗
                          </button>
                          <button
                            className="close-session-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDisconnectSession(session.id);
                            }}
                            title="Close Session"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    {/* Saved sessions (not connected yet) */}
                    {savedSessions.map((conn, index) => {
                      const displayName = conn.sessionName || conn.name || (conn.connectionType === 'serial'
                        ? `Serial: ${conn.serialPort}`
                        : `${conn.user}@${conn.host}`);
                      return (
                        <div
                          key={`saved-${index}`}
                          className="session-item group-session-item saved-session"
                        >
                          <span className="session-name">{displayName} (not connected)</span>
                          <span className="connection-status disconnected">○</span>
                          <button
                            className="remove-from-group-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setGroups(prevGroups => {
                                const updated = prevGroups.map(g => {
                                  if (g.id === group.id) {
                                    const newSavedSessions = [...(g.savedSessions || [])];
                                    newSavedSessions.splice(index, 1);
                                    return { ...g, savedSessions: newSavedSessions };
                                  }
                                  return g;
                                });
                                return updated;
                              });
                            }}
                            title="Remove from Group"
                          >
                            ⊗
                          </button>
                        </div>
                      );
                    })}
                    {group.sessionIds.length === 0 && savedSessions.length === 0 && (
                      <div className="group-empty">Drag sessions here</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create New Group Button */}
      <div className="section">
        <button
          className="new-group-btn"
          onClick={() => {
            const groupName = `Group ${groups.length + 1}`;
            onCreateGroup(groupName);
          }}
          title="Create a new empty group"
        >
          + Create New Group
        </button>
      </div>

      {/* Active sessions (ungrouped) */}
      {sessions.filter(s => !groups.some(g => g.sessionIds.includes(s.id))).length > 0 && (
        <div className="section">
          <div className="section-header">Active Sessions</div>
          {sessions
            .filter(s => !groups.some(g => g.sessionIds.includes(s.id)))
            .map(session => (
              <div 
                key={session.id}
                className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
                draggable
                onDragStart={(e) => onDragStart(e, session.id)}
                onClick={() => onSwitchToSession(session.id)}
              >
                <span className="session-name">{session.name}</span>
                <span className={`connection-status ${session.isConnected ? 'connected' : 'disconnected'}`}>
                  {session.isConnected ? '●' : '○'}
                </span>
                <button 
                  className="close-session-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDisconnectSession(session.id);
                  }}
                  title="Close Session"
                >
                  ×
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Connection history */}
      {connectionHistory.length > 0 && (
        <div className="section">
          <div className="section-header">Recent</div>
          {connectionHistory.slice(0, 10).map((conn, index) => (
            <div 
              key={index}
              className="session-item history"
              onClick={() => onConnectFromHistory(conn)}
              title={`${conn.user}@${conn.host}`}
            >
              <span className="session-name">{conn.user}@{conn.host}</span>
              <button 
                className="favorite-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(conn);
                }}
                title="Toggle Favorite"
              >
                {favorites.some(f => f.host === conn.host && f.user === conn.user) ? '★' : '☆'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

