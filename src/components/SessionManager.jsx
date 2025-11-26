import React, { memo, useMemo, useCallback, useState } from 'react';
import { SessionItem } from './SessionItem';
import { FavoriteItem } from './FavoriteItem';
import { ConnectionHistoryItem } from './ConnectionHistoryItem';
import { GroupSessionItem } from './GroupSessionItem';
import { LibraryItem } from './LibraryItem';
import { ConnectionStatusIcon } from './ConnectionStatusIcon';
import { matchSavedSessionWithActiveSession } from '../utils/sessionMatcher';
import { getSessionDisplayName } from '../utils/sessionName';

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
  onDisconnectGroup,
  onToggleGroupExpanded,
  onStartEditingGroupName,
  onSaveGroupName,
  onCancelEditingGroupName,
  onRemoveSessionFromGroup,
  onDeleteGroup,
  onCreateGroup,
  setGroups,
  onOpenSessionSettings,
  libraries,
  sshConnections,
  terminalFontFamily,
  onEditLibrary,
  onDeleteLibrary,
  onToggleLibraryExpanded,
  onCreateLibrary,
  onExportLibrary,
  onImportLibrary,
  setErrorDialog
}) {
  // Memoize group calculations - optimized with Map for O(1) lookup
  // Match savedSessions with active sessions at runtime
  const groupCalculations = useMemo(() => {
    // Create a map of session keys for fast O(1) lookup instead of O(n) some()
    // This reduces complexity from O(n*m) to O(n+m)
    const sessionKeyMap = new Map();
    sessions.forEach(session => {
      if (session.connectionType === 'serial') {
        sessionKeyMap.set(`serial:${session.serialPort}`, session);
      } else {
        sessionKeyMap.set(`ssh:${session.host}:${session.user}:${session.port || '22'}`, session);
      }
    });

    return groups.map(group => {
      const savedSessions = group.savedSessions || [];
      
      // Optimized: Use Map lookup instead of nested filter/some (O(n*m) -> O(n+m))
      const groupSessions = [];
      savedSessions.forEach(savedSession => {
        let key;
        const connType = savedSession.connectionType || 'ssh';
        if (connType === 'serial') {
          key = `serial:${savedSession.serialPort}`;
        } else {
          key = `ssh:${savedSession.host}:${savedSession.user}:${savedSession.port || '22'}`;
        }
        const matchedSession = sessionKeyMap.get(key);
        if (matchedSession && matchSavedSessionWithActiveSession(savedSession, matchedSession)) {
          groupSessions.push(matchedSession);
        }
      });
      
      const totalSessions = savedSessions.length;
      const allConnected = totalSessions > 0 && 
        groupSessions.length === totalSessions &&
        groupSessions.every(s => s.isConnected);
      const hasConnectedSessions = groupSessions.some(s => s.isConnected);
      
      return {
        group,
        groupSessions,
        savedSessions,
        totalSessions,
        allConnected,
        hasConnectedSessions
      };
    });
  }, [groups, sessions]);

  // Section expansion state
  const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(true);
  const [isSessionListExpanded, setIsSessionListExpanded] = useState(true);
  const [isActiveSessionsExpanded, setIsActiveSessionsExpanded] = useState(true);
  const [isRecentExpanded, setIsRecentExpanded] = useState(true);
  const [isLibrariesExpanded, setIsLibrariesExpanded] = useState(false);

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
      
      <div className="session-manager-content">
      {/* Favorites */}
      {favorites.length > 0 && (
        <div className="section">
          <div 
            className="section-header section-header-clickable"
            onClick={() => setIsFavoritesExpanded(!isFavoritesExpanded)}
            style={{ cursor: 'pointer' }}
          >
            <button
              className="section-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setIsFavoritesExpanded(!isFavoritesExpanded);
              }}
              title={isFavoritesExpanded ? 'Collapse' : 'Expand'}
            >
              {isFavoritesExpanded ? '▼' : '▶'}
            </button>
            Favorites
          </div>
          {isFavoritesExpanded && favorites.map((fav, index) => (
            <FavoriteItem
              key={`fav-${index}-${fav.name || fav.host || fav.serialPort}`}
              fav={fav}
              onCreateNewSessionWithData={onCreateNewSessionWithData}
              setErrorDialog={setErrorDialog}
            />
          ))}
        </div>
      )}

      {/* Session List - All saved sessions */}
      {connectionHistory.length > 0 && (
        <div className="section">
          <div 
            className="section-header section-header-clickable"
            onClick={() => setIsSessionListExpanded(!isSessionListExpanded)}
            style={{ cursor: 'pointer' }}
          >
            <button
              className="section-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setIsSessionListExpanded(!isSessionListExpanded);
              }}
              title={isSessionListExpanded ? 'Collapse' : 'Expand'}
            >
              {isSessionListExpanded ? '▼' : '▶'}
            </button>
            Session List
          </div>
          {isSessionListExpanded && connectionHistory.map((conn, index) => (
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
          {groupCalculations.map(({ group, groupSessions, savedSessions, totalSessions, allConnected, hasConnectedSessions }) => {
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
                    className={allConnected ? "group-disconnect-btn" : "group-connect-btn"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (allConnected) {
                        onDisconnectGroup(group.id);
                      } else {
                        onConnectGroup(group.id);
                      }
                    }}
                    title={allConnected ? "Disconnect All Sessions in Group" : "Connect All Sessions in Group"}
                    disabled={totalSessions === 0}
                  >
                    {allConnected ? "⏹" : "▶"}
                  </button>
                  <button
                    className="group-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteGroup(group.id);
                    }}
                    title="Delete Group"
                  >
                    🗑
                  </button>
                </div>
                {group.isExpanded && (
                  <div className="group-sessions">
                    {/* Active sessions (connected) */}
                    {groupSessions.map((session) => {
                      // Find the savedSession that matches this active session
                      const matchingSavedSession = savedSessions.find(savedSession => 
                        matchSavedSessionWithActiveSession(savedSession, session)
                      );
                      
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
                          onOpenSettings={onOpenSessionSettings}
                        />
                      );
                    })}
                    {/* Saved sessions (not connected yet) - only show if not already connected */}
                    {savedSessions
                      .filter(savedSession => {
                        // Only show saved sessions that don't have an active session
                        const activeSession = groupSessions.find(session => 
                          matchSavedSessionWithActiveSession(savedSession, session)
                        );
                        // Only show if no active session exists (not connected)
                        return !activeSession;
                      })
                      .map((savedSession) => {
                        const displayName = getSessionDisplayName(savedSession);
                        
                        return (
                          <div
                            key={savedSession.id}
                            className="session-item group-session-item saved-session"
                          >
                            <span className="session-name">
                              {displayName} (not connected)
                            </span>
                            <ConnectionStatusIcon 
                              isConnected={false}
                              className="connection-status disconnected"
                            />
                            <button
                              className="remove-from-group-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveSessionFromGroup(savedSession.id, group.id);
                              }}
                              title="Remove from Group"
                            >
                              🗑
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
          <div 
            className="section-header section-header-clickable"
            onClick={() => setIsActiveSessionsExpanded(!isActiveSessionsExpanded)}
            style={{ cursor: 'pointer' }}
          >
            <button
              className="section-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setIsActiveSessionsExpanded(!isActiveSessionsExpanded);
              }}
              title={isActiveSessionsExpanded ? 'Collapse' : 'Expand'}
            >
              {isActiveSessionsExpanded ? '▼' : '▶'}
            </button>
            Active Sessions
          </div>
          {isActiveSessionsExpanded && ungroupedSessions.map(session => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={activeSessionId === session.id}
              onSwitch={onSwitchToSession}
              onDisconnect={onDisconnectSession}
              onDragStart={onDragStart}
              onOpenSettings={onOpenSessionSettings}
            />
          ))}
        </div>
      )}

      {/* Connection history */}
      {connectionHistory.length > 0 && (
        <div className="section">
          <div 
            className="section-header section-header-clickable"
            onClick={() => setIsRecentExpanded(!isRecentExpanded)}
            style={{ cursor: 'pointer' }}
          >
            <button
              className="section-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setIsRecentExpanded(!isRecentExpanded);
              }}
              title={isRecentExpanded ? 'Collapse' : 'Expand'}
            >
              {isRecentExpanded ? '▼' : '▶'}
            </button>
            Recent
          </div>
          {isRecentExpanded && connectionHistory.slice(0, 10).map((conn, index) => (
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

      {/* Libraries / Cheat-sheets */}
      <div className="section">
        <div 
          className="section-header section-header-clickable"
          onClick={() => setIsLibrariesExpanded(!isLibrariesExpanded)}
          style={{ cursor: 'pointer' }}
        >
          <button
            className="section-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setIsLibrariesExpanded(!isLibrariesExpanded);
            }}
            title={isLibrariesExpanded ? 'Collapse' : 'Expand'}
          >
            {isLibrariesExpanded ? '▼' : '▶'}
          </button>
          Libraries
        </div>
        {isLibrariesExpanded && (
          <>
            {libraries && libraries.length > 0 ? (
              libraries.map((library) => (
                <LibraryItem
                  key={library.id}
                  library={library}
                  activeSessionId={activeSessionId}
                  sessions={sessions}
                  sshConnections={sshConnections}
                  terminalFontFamily={terminalFontFamily}
                  onEdit={onEditLibrary}
                  onDelete={onDeleteLibrary}
                  onToggleExpanded={onToggleLibraryExpanded}
                  onExport={onExportLibrary}
                />
              ))
            ) : (
              <div style={{
                padding: '12px',
                textAlign: 'center',
                color: '#00ff41',
                opacity: 0.5,
                fontSize: '12px'
              }}>
                No libraries yet
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <button
                className="new-library-btn"
                onClick={onCreateLibrary}
                title="Create a new library"
              >
                + Create New Library
              </button>
              <button
                className="new-library-btn"
                onClick={onImportLibrary}
                title="Import library from clipboard, file, or manual input"
                style={{
                  backgroundColor: 'rgba(0, 255, 65, 0.1)',
                  border: '1px solid rgba(0, 255, 65, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Import Library
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
});

