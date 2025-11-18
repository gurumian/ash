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
  onRemoveConnection,
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
  // Match savedSessions with active sessions at runtime
  const groupCalculations = useMemo(() => {
    return groups.map(group => {
      const savedSessions = group.savedSessions || [];
      
      // Find active sessions that match saved sessions
      const groupSessions = sessions.filter(session => {
        return savedSessions.some(savedSession => {
          const connType = savedSession.connectionType || 'ssh';
          if (connType === 'serial') {
            return session.connectionType === 'serial' && 
                   session.serialPort === savedSession.serialPort;
          } else {
            return session.connectionType === 'ssh' &&
                   session.host === savedSession.host && 
                   session.user === savedSession.user && 
                   (session.port || '22') === (savedSession.port || '22');
          }
        });
      });
      
      const totalSessions = savedSessions.length;
      const allConnected = totalSessions > 0 && 
        groupSessions.length === totalSessions &&
        groupSessions.every(s => s.isConnected);
      
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
              onRemoveConnection={onRemoveConnection}
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
                    {/* Active sessions (connected) */}
                    {groupSessions.map((session) => {
                      // Find the savedSession that matches this active session
                      const matchingSavedSession = savedSessions.find(savedSession => {
                        const connType = savedSession.connectionType || 'ssh';
                        if (connType === 'serial') {
                          return session.connectionType === 'serial' && 
                                 session.serialPort === savedSession.serialPort;
                        } else {
                          return session.connectionType === 'ssh' &&
                                 session.host === savedSession.host && 
                                 session.user === savedSession.user && 
                                 (session.port || '22') === (savedSession.port || '22');
                        }
                      });
                      
                      return (
                        <GroupSessionItem
                          key={session.id}
                          session={session}
                          isActive={activeSessionId === session.id}
                          groupId={group.id}
                          savedSessionId={matchingSavedSession?.id}
                          onSwitch={onSwitchToSession}
                          onDisconnect={onDisconnectSession}
                          onDragStart={onDragStart}
                          onRemoveFromGroup={onRemoveSessionFromGroup}
                        />
                      );
                    })}
                    {/* Saved sessions (not connected yet) */}
                    {savedSessions.map((savedSession) => {
                      // Check if this saved session has an active session
                      const activeSession = groupSessions.find(session => {
                        const connType = savedSession.connectionType || 'ssh';
                        if (connType === 'serial') {
                          return session.connectionType === 'serial' && 
                                 session.serialPort === savedSession.serialPort;
                        } else {
                          return session.connectionType === 'ssh' &&
                                 session.host === savedSession.host && 
                                 session.user === savedSession.user && 
                                 (session.port || '22') === (savedSession.port || '22');
                        }
                      });
                      
                      const displayName = savedSession.label || savedSession.sessionName || savedSession.name || (savedSession.connectionType === 'serial'
                        ? `Serial: ${savedSession.serialPort}`
                        : `${savedSession.user}@${savedSession.host}`);
                      
                      return (
                        <div
                          key={savedSession.id}
                          className="session-item group-session-item saved-session"
                        >
                          <span className="session-name">
                            {displayName} {!activeSession ? '(not connected)' : ''}
                          </span>
                          <span className={`connection-status ${activeSession?.isConnected ? 'connected' : 'disconnected'}`}>
                            {activeSession?.isConnected ? '●' : '○'}
                          </span>
                          <button
                            className="remove-from-group-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveSessionFromGroup(savedSession.id, group.id);
                            }}
                            title="Remove from Group"
                          >
                            ⊗
                          </button>
                        </div>
                      );
                    })}
                    {savedSessions.length === 0 && (
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
              onRemoveConnection={onRemoveConnection}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}
    </div>
  );
});

