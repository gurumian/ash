import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for group management
 */
export function useGroups() {
  const [groups, setGroups] = useState(() => {
    const saved = localStorage.getItem('ash-groups');
    console.log('Loading groups from localStorage:', saved);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('Parsed groups:', parsed);
        // Ensure all groups have savedSessions field for backward compatibility
        const groupsWithSavedSessions = parsed.map(g => ({
          ...g,
          savedSessions: g.savedSessions || []
        }));
        console.log('Groups with savedSessions:', groupsWithSavedSessions);
        return groupsWithSavedSessions;
      } catch (e) {
        console.error('Failed to parse groups from localStorage:', e);
        return [];
      }
    }
    console.log('No saved groups found in localStorage');
    return [];
  });

  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const isInitialGroupsLoad = useRef(true);

  // Save groups to localStorage
  const saveGroups = (newGroups) => {
    setGroups(newGroups);
    localStorage.setItem('ash-groups', JSON.stringify(newGroups));
    console.log('Groups saved to localStorage:', newGroups);
  };
  
  // Sync groups to localStorage whenever groups state changes (skip initial mount)
  useEffect(() => {
    if (isInitialGroupsLoad.current) {
      isInitialGroupsLoad.current = false;
      console.log('Initial groups load, skipping sync:', groups);
      return; // Skip on initial mount
    }
    const serialized = JSON.stringify(groups);
    localStorage.setItem('ash-groups', serialized);
    console.log('Groups synced to localStorage:', groups);
    console.log('Serialized data:', serialized);
    
    // Verify it was saved correctly
    const verify = localStorage.getItem('ash-groups');
    console.log('Verification - localStorage contains:', verify);
  }, [groups]);

  // Clean up orphaned sessionIds
  const cleanupOrphanedSessions = (sessions) => {
    if (sessions.length === 0) {
      return;
    }
    
    setGroups(prevGroups => {
      let hasChanges = false;
      const updatedGroups = prevGroups.map(group => {
        // Find sessionIds that don't exist in current sessions
        const orphanedSessionIds = group.sessionIds.filter(sessionId => 
          !sessions.some(s => s.id === sessionId)
        );
        
        if (orphanedSessionIds.length === 0) {
          return group; // No orphaned sessions
        }
        
        // Remove orphaned sessionIds
        const newSessionIds = group.sessionIds.filter(sessionId => 
          sessions.some(s => s.id === sessionId)
        );
        
        // Only update if there are changes
        if (newSessionIds.length !== group.sessionIds.length) {
          hasChanges = true;
          console.log(`Removing ${orphanedSessionIds.length} orphaned sessionIds from group ${group.name}`);
          return {
            ...group,
            sessionIds: newSessionIds
          };
        }
        
        return group;
      });
      
      if (hasChanges) {
        console.log('Cleaned up orphaned sessionIds from groups:', updatedGroups);
        return updatedGroups;
      }
      
      return prevGroups;
    });
  };

  // Group management functions
  const createGroup = (name) => {
    const newGroup = {
      id: Date.now().toString(),
      name: name || `Group ${groups.length + 1}`,
      sessionIds: [], // Active session IDs
      savedSessions: [], // Connection info for unconnected sessions
      isExpanded: true
    };
    saveGroups([...groups, newGroup]);
    return newGroup.id;
  };

  const createGroupWithName = (name, sessionId = null) => {
    const newGroupId = createGroup(name);
    return newGroupId;
  };

  const deleteGroup = (groupId) => {
    saveGroups(groups.filter(g => g.id !== groupId));
  };

  const toggleGroupExpanded = (groupId) => {
    saveGroups(groups.map(g => 
      g.id === groupId ? { ...g, isExpanded: !g.isExpanded } : g
    ));
  };

  const startEditingGroupName = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
      setEditingGroupId(groupId);
      setEditingGroupName(group.name);
    }
  };

  const saveGroupName = (groupId) => {
    saveGroups(groups.map(g => 
      g.id === groupId ? { ...g, name: editingGroupName } : g
    ));
    setEditingGroupId(null);
    setEditingGroupName('');
  };

  const cancelEditingGroupName = () => {
    setEditingGroupId(null);
    setEditingGroupName('');
  };

  const addSessionToGroup = (sessionId, groupId, session, skipSavedSessions = false) => {
    // Allow duplicate sessions in the same group - just add to target group
    console.log('Adding session to group:', { sessionId, groupId, skipSavedSessions });
    
    setGroups(prevGroups => {
      const finalGroups = prevGroups.map(g => {
        if (g.id === groupId) {
          // Build connection info from session
          let connectionInfo = null;
          if (session) {
            connectionInfo = session.connectionType === 'serial' ? {
              connectionType: 'serial',
              serialPort: session.serialPort,
              baudRate: session.baudRate,
              dataBits: session.dataBits,
              stopBits: session.stopBits,
              parity: session.parity,
              flowControl: session.flowControl,
              sessionName: session.name
            } : {
              connectionType: 'ssh',
              host: session.host,
              port: session.port,
              user: session.user,
              password: session.password || '',
              sessionName: session.name
            };
          }
          
          // Update savedSessions: ensure connection info is stored (for persistence)
          // Skip if skipSavedSessions is true (e.g., when moving from savedSessions to sessionIds)
          let updatedSavedSessions = [...(g.savedSessions || [])];
          if (connectionInfo && !skipSavedSessions) {
            // Check if this connection already exists in savedSessions
            const exists = updatedSavedSessions.some(saved => {
              if (session.connectionType === 'serial') {
                return saved.connectionType === 'serial' && saved.serialPort === session.serialPort;
              } else {
                return saved.host === session.host && 
                       saved.user === session.user && 
                       (saved.port || '22') === (session.port || '22');
              }
            });
            
            if (!exists) {
              updatedSavedSessions.push(connectionInfo);
            }
          }
          
          // Add to sessionIds only if session exists (for active tracking)
          // Also check if already in sessionIds to avoid duplicates
          const updatedSessionIds = session && !g.sessionIds.includes(sessionId) 
            ? [...g.sessionIds, sessionId] 
            : g.sessionIds;
          
          return { 
            ...g, 
            sessionIds: updatedSessionIds,
            savedSessions: updatedSavedSessions
          };
        }
        return g;
      });
      console.log('Updated groups:', finalGroups);
      // localStorage will be updated by useEffect
      return finalGroups;
    });
  };

  const addSavedSessionToGroup = (connection, groupId) => {
    // Add unconnected session info to group
    console.log('Adding saved session to group:', { connection, groupId });
    setGroups(prevGroups => {
      const finalGroups = prevGroups.map(g => {
        if (g.id === groupId) {
          // Check if already exists in savedSessions
          const exists = (g.savedSessions || []).some(saved => {
            const connType = connection.connectionType || 'ssh';
            if (connType === 'serial') {
              return saved.connectionType === 'serial' && saved.serialPort === connection.serialPort;
            } else {
              return saved.host === connection.host && 
                     saved.user === connection.user && 
                     (saved.port || '22') === (connection.port || '22');
            }
          });
          
          if (!exists) {
            return { 
              ...g, 
              savedSessions: [...(g.savedSessions || []), connection]
            };
          } else {
            // Already exists, return group as is
            return g;
          }
        }
        return g;
      });
      console.log('Updated groups with saved session:', finalGroups);
      console.log('Group after adding saved session:', finalGroups.find(g => g.id === groupId));
      // localStorage will be updated by useEffect
      return finalGroups;
    });
  };

  const removeSessionFromGroup = (sessionId, groupId, index = null) => {
    saveGroups(groups.map(g => {
      if (g.id === groupId) {
        if (index !== null) {
          // Remove specific index (for duplicate sessions)
          const newSessionIds = [...g.sessionIds];
          newSessionIds.splice(index, 1);
          return { ...g, sessionIds: newSessionIds };
        } else {
          // Remove first occurrence (backward compatibility)
          const newSessionIds = [...g.sessionIds];
          const firstIndex = newSessionIds.indexOf(sessionId);
          if (firstIndex !== -1) {
            newSessionIds.splice(firstIndex, 1);
          }
          return { ...g, sessionIds: newSessionIds };
        }
      }
      return g;
    }));
  };

  return {
    groups,
    setGroups,
    saveGroups,
    editingGroupId,
    editingGroupName,
    setEditingGroupName,
    createGroup,
    createGroupWithName,
    deleteGroup,
    toggleGroupExpanded,
    startEditingGroupName,
    saveGroupName,
    cancelEditingGroupName,
    addSessionToGroup,
    addSavedSessionToGroup,
    removeSessionFromGroup,
    cleanupOrphanedSessions
  };
}

