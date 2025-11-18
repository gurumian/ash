import React, { memo, useMemo, useCallback } from 'react';
import { SessionItem } from './SessionItem';
import { FavoriteItem } from './FavoriteItem';
import { ConnectionHistoryItem } from './ConnectionHistoryItem';
import { GroupSessionItem } from './GroupSessionItem';

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
  ungroupedSessions,
  draggedSessionId,
  dragOverGroupId,
  editingGroupId,
  editingGroupName,
  setEditingGroupName,
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
  // Memoize group calculations
  const groupCalculations = useMemo(() => {
    return groups.map(group => {
      const groupSessions = sessions.filter(s => group.sessionIds.includes(s.id));
      const savedSessions = group.savedSessions || [];
      const totalSessions = groupSessions.length + savedSessions.length;
      const allConnected = totalSessions > 0 && 
        groupSessions.every(s => s.isConnected) && 
        savedSessions.length === 0;
      
      return {
        group,
        groupSessions,
        savedSessions,
        totalSessions,
        allConnected
      };
    });
  }, [groups, sessions]);
  return (
    <div 
      className={`session-manager ${!showSessionManager ? 'hidden' : ''}`}
      style={{ width: showSessionManager ? `${sessionManagerWidth}px` : '0' }}
    >
      <div className="session-manager-header">
        <h3>Sessions</h3>
        <div className="header-buttons">
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
          {favorites.map((fav, index) => (
            <FavoriteItem
              key={`fav-${index}-${fav.name || fav.host || fav.serialPort}`}
              fav={fav}
              onCreateNewSessionWithData={onCreateNewSessionWithData}
            />
          ))}
        </div>
      )}

      {/* Session List - All saved sessions */}
      {connectionHistory.length > 0 && (
        <div className="section">
          <div className="section-header">Session List</div>
          {connectionHistory.map((conn, index) => (
            <ConnectionHistoryItem
              key={`conn-${index}-${conn.host || conn.serialPort}-${conn.user || ''}`}
              conn={conn}
              index={index}
              favorites={favorites}
              onConnectFromHistory={onConnectFromHistory}
              onToggleFavorite={onToggleFavorite}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}

      {/* Groups */}
      {groups.length > 0 && (
        <div className="section">
          <div className="section-header">Groups</div>
          {groupCalculations.map(({ group, groupSessions, savedSessions, totalSessions, allConnected }) => {
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
                        <GroupSessionItem
                          key={`${sessionId}-${index}`}
                          session={session}
                          isActive={activeSessionId === session.id}
                          groupId={group.id}
                          index={index}
                          onSwitch={onSwitchToSession}
                          onDisconnect={onDisconnectSession}
                          onDragStart={onDragStart}
                          onRemoveFromGroup={onRemoveSessionFromGroup}
                        />
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
      {ungroupedSessions.length > 0 && (
        <div className="section">
          <div className="section-header">Active Sessions</div>
          {ungroupedSessions.map(session => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={activeSessionId === session.id}
              onSwitch={onSwitchToSession}
              onDisconnect={onDisconnectSession}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}

      {/* Connection history */}
      {connectionHistory.length > 0 && (
        <div className="section">
          <div className="section-header">Recent</div>
          {connectionHistory.slice(0, 10).map((conn, index) => (
            <ConnectionHistoryItem
              key={`recent-${index}-${conn.host || conn.serialPort}-${conn.user || ''}`}
              conn={conn}
              index={index}
              favorites={favorites}
              onConnectFromHistory={onConnectFromHistory}
              onToggleFavorite={onToggleFavorite}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}
    </div>
  );
});

