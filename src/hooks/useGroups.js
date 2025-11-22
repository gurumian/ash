import { useState, useEffect, useRef } from 'react';
import { matchSavedSessionWithActiveSession } from '../utils/sessionMatcher';
import { getSessionLabel } from '../utils/sessionName';

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
        // Ensure all groups have savedSessions field with UUID and label, remove sessionIds (volatile data)
        const groupsWithSavedSessions = parsed.map(g => {
          const { sessionIds, ...groupWithoutSessionIds } = g;
          // Migrate old savedSessions format to new format with UUID and label
          const migratedSavedSessions = (g.savedSessions || []).map(saved => {
            // If already has id and label, keep as is
            if (saved.id && saved.label) {
              return saved;
            }
            // Otherwise, migrate old format to new format
            return {
              id: crypto.randomUUID(),
              label: getSessionLabel(saved),
              ...saved
            };
          });
          return {
            ...groupWithoutSessionIds,
            savedSessions: migratedSavedSessions
          };
        });
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

  // Group management functions
  const createGroup = (name) => {
    const newGroup = {
      id: Date.now().toString(),
      name: name || `Group ${groups.length + 1}`,
      savedSessions: [], // Connection info for sessions (persistent)
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
    // Add session's connection info to group's savedSessions with UUID and label
    console.log('Adding session to group:', { sessionId, groupId, skipSavedSessions });
    
    setGroups(prevGroups => {
      const finalGroups = prevGroups.map(g => {
        if (g.id === groupId) {
          // Build saved session with UUID and label from session
          let savedSession = null;
          if (session) {
            const label = getSessionLabel(session);
            
            savedSession = {
              id: crypto.randomUUID(),
              label: label,
              connectionType: session.connectionType,
              ...(session.connectionType === 'serial' ? {
                serialPort: session.serialPort,
                baudRate: session.baudRate,
                dataBits: session.dataBits,
                stopBits: session.stopBits,
                parity: session.parity,
                flowControl: session.flowControl
              } : {
                host: session.host,
                port: session.port,
                user: session.user,
                password: session.password || ''
              })
            };
          }
          
          // Update savedSessions: always add as a new instance (allow duplicates)
          // Skip if skipSavedSessions is true (e.g., when already in savedSessions)
          let updatedSavedSessions = [...(g.savedSessions || [])];
          if (savedSession && !skipSavedSessions) {
            // Always add as a new instance - same connection info can be added multiple times
            // This allows multiple terminals to the same host (class vs instance concept)
            updatedSavedSessions.push(savedSession);
          }
          
          return { 
            ...g, 
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
    // Add unconnected session info to group with UUID and label
    // Always creates a new instance - allows multiple instances of the same connection (class vs instance)
    console.log('Adding saved session to group:', { connection, groupId });
    setGroups(prevGroups => {
      const finalGroups = prevGroups.map(g => {
        if (g.id === groupId) {
          // Always create a new instance with UUID and label
          // Same connection info can be added multiple times (e.g., multiple terminals to same host)
          const label = getSessionLabel(connection);
          
          const savedSession = {
            id: crypto.randomUUID(),
            label: label,
            ...connection
          };
          
          return { 
            ...g, 
            savedSessions: [...(g.savedSessions || []), savedSession]
          };
        }
        return g;
      });
      console.log('Updated groups with saved session:', finalGroups);
      console.log('Group after adding saved session:', finalGroups.find(g => g.id === groupId));
      // localStorage will be updated by useEffect
      return finalGroups;
    });
  };

  const removeSessionFromGroup = (savedSessionId, groupId) => {
    // Remove saved session from group by UUID
    saveGroups(groups.map(g => {
      if (g.id === groupId) {
        const updatedSavedSessions = (g.savedSessions || []).filter(saved => saved.id !== savedSessionId);
        return { ...g, savedSessions: updatedSavedSessions };
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
    matchSavedSessionWithActiveSession
  };
}

