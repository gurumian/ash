import { useState, useEffect } from 'react';

/**
 * Custom hook for connection history and favorites management
 */
export function useConnectionHistory() {
  // Load and migrate connection history (add UUID if missing)
  const [connectionHistory, setConnectionHistory] = useState(() => {
    const saved = localStorage.getItem('ssh-connections');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      // Check if migration is needed
      const needsMigration = parsed.some(conn => !conn.id);
      if (needsMigration) {
        // Migrate: add UUID to entries that don't have it
        const migrated = parsed.map(conn => ({
          ...conn,
          id: conn.id || crypto.randomUUID()
        }));
        // Save migrated data immediately
        localStorage.setItem('ssh-connections', JSON.stringify(migrated));
        return migrated;
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse connection history:', e);
      return [];
    }
  });

  // Load and migrate favorites (add UUID if missing)
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('ssh-favorites');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      // Check if migration is needed
      const needsMigration = parsed.some(fav => !fav.id);
      if (needsMigration) {
        // Migrate: add UUID to entries that don't have it
        const migrated = parsed.map(fav => ({
          ...fav,
          id: fav.id || crypto.randomUUID()
        }));
        // Save migrated data immediately
        localStorage.setItem('ssh-favorites', JSON.stringify(migrated));
        return migrated;
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse favorites:', e);
      return [];
    }
  });

  // Save connection history
  const saveConnectionHistory = (connection) => {
    // Remove password if save password option is not checked
    const connectionToSave = {
      ...connection,
      password: connection.savePassword ? connection.password : '',
      // Add UUID if not present (for individual management)
      id: connection.id || crypto.randomUUID(),
      // Ensure autoReconnect is explicitly included
      autoReconnect: connection.autoReconnect !== undefined ? connection.autoReconnect : false
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('[ConnectionHistory] Saving connection with autoReconnect:', connectionToSave.autoReconnect, connectionToSave);
    }

    // For SSH connections, check by host/user/port/sessionName
    // For Serial connections, check by serialPort/sessionName
    // Same connection info but different sessionName should be kept as separate entries
    const newHistory = [connectionToSave, ...connectionHistory.filter(c => {
      const sessionNameMatch = (c.sessionName || c.name || '') === (connection.sessionName || connection.name || '');
      if (connection.connectionType === 'serial') {
        const connectionMatch = c.connectionType === 'serial' && c.serialPort === connection.serialPort;
        // Only remove if both connection info and sessionName match
        return !(connectionMatch && sessionNameMatch);
        // Only remove if both connection info and sessionName match
        return !(connectionMatch && sessionNameMatch);
      } else if (connection.connectionType === 'local') {
        const connectionMatch = c.connectionType === 'local';
        // Only remove if both connection info (type) and sessionName match
        return !(connectionMatch && sessionNameMatch);
      } else {
        const connectionMatch = c.host === connection.host &&
          c.user === connection.user &&
          (c.port || '22') === (connection.port || '22');
        // Only remove if both connection info and sessionName match
        return !(connectionMatch && sessionNameMatch);
      }
    })].slice(0, 20); // Store maximum 20 items

    setConnectionHistory(newHistory);
    localStorage.setItem('ssh-connections', JSON.stringify(newHistory));

    if (process.env.NODE_ENV === 'development') {
      console.log('[ConnectionHistory] Saved to localStorage. autoReconnect in first item:', newHistory[0]?.autoReconnect);
    }
  };

  // Helper function to match connection for favorites (by UUID, or by connection info + sessionName)
  const matchesFavorite = (f, connection) => {
    // First check by UUID if both have it
    if (f.id && connection.id && f.id === connection.id) {
      return true;
    }

    // Fallback to connection info + sessionName matching
    const sessionNameMatch = (f.sessionName || f.name || '') === (connection.sessionName || connection.name || '');
    if (connection.connectionType === 'serial') {
      const connectionMatch = f.connectionType === 'serial' && f.serialPort === connection.serialPort;
      return connectionMatch && sessionNameMatch;
      return connectionMatch && sessionNameMatch;
    } else if (connection.connectionType === 'local') {
      const connectionMatch = f.connectionType === 'local';
      return connectionMatch && sessionNameMatch;
    } else {
      const connectionMatch = f.host === connection.host &&
        f.user === connection.user &&
        (f.port || '22') === (connection.port || '22');
      return connectionMatch && sessionNameMatch;
    }
  };

  // Toggle favorite
  const toggleFavorite = (connection) => {
    // Check if already favorited (by UUID or connection info + sessionName)
    const isFavorite = favorites.some(f => matchesFavorite(f, connection));

    if (isFavorite) {
      // Remove from favorites (match by UUID or connection info + sessionName)
      const newFavorites = favorites.filter(f => !matchesFavorite(f, connection));
      setFavorites(newFavorites);
      localStorage.setItem('ssh-favorites', JSON.stringify(newFavorites));
    } else {
      // Add to favorites with UUID and name
      const isSerial = connection.connectionType === 'serial';
      const name = connection.sessionName || connection.name || (isSerial
        ? `Serial: ${connection.serialPort}`
        : `${connection.user}@${connection.host}`);
      const favoriteToAdd = {
        ...connection,
        id: connection.id || crypto.randomUUID(), // Ensure UUID exists
        name
      };
      const newFavorites = [...favorites, favoriteToAdd];
      setFavorites(newFavorites);
      localStorage.setItem('ssh-favorites', JSON.stringify(newFavorites));
    }
  };

  // Helper function to match connection in history (by UUID, or by connection info + sessionName)
  const matchesConnection = (c, connection) => {
    // First check by UUID if both have it
    if (c.id && connection.id && c.id === connection.id) {
      return true;
    }

    // Fallback to connection info + sessionName matching
    const sessionNameMatch = (c.sessionName || c.name || '') === (connection.sessionName || connection.name || '');
    if (connection.connectionType === 'serial') {
      const connectionMatch = c.connectionType === 'serial' && c.serialPort === connection.serialPort;
      return connectionMatch && sessionNameMatch;
      return connectionMatch && sessionNameMatch;
    } else if (connection.connectionType === 'local') {
      const connectionMatch = c.connectionType === 'local';
      return connectionMatch && sessionNameMatch;
    } else {
      const connectionMatch = c.host === connection.host &&
        c.user === connection.user &&
        (c.port || '22') === (connection.port || '22');
      return connectionMatch && sessionNameMatch;
    }
  };

  // Remove connection from history
  const removeConnection = (connection) => {
    // Remove from history (match by UUID or connection info + sessionName)
    const newHistory = connectionHistory.filter(c => !matchesConnection(c, connection));

    setConnectionHistory(newHistory);
    localStorage.setItem('ssh-connections', JSON.stringify(newHistory));

    // Also remove from favorites if it's favorited (use same matching logic)
    const isFavorite = favorites.some(f => matchesFavorite(f, connection));

    if (isFavorite) {
      const newFavorites = favorites.filter(f => !matchesFavorite(f, connection));
      setFavorites(newFavorites);
      localStorage.setItem('ssh-favorites', JSON.stringify(newFavorites));
    }
  };

  return {
    connectionHistory,
    favorites,
    saveConnectionHistory,
    toggleFavorite,
    removeConnection
  };
}

