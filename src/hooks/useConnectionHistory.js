import { useState, useEffect } from 'react';

/**
 * Custom hook for connection history and favorites management
 */
export function useConnectionHistory() {
  const [connectionHistory, setConnectionHistory] = useState(
    JSON.parse(localStorage.getItem('ssh-connections') || '[]')
  );
  const [favorites, setFavorites] = useState(
    JSON.parse(localStorage.getItem('ssh-favorites') || '[]')
  );

  // Save connection history
  const saveConnectionHistory = (connection) => {
    // Remove password if save password option is not checked
    const connectionToSave = {
      ...connection,
      password: connection.savePassword ? connection.password : ''
    };
    
    // For SSH connections, check by host/user/port/sessionName
    // For Serial connections, check by serialPort/sessionName
    // Same connection info but different sessionName should be kept as separate entries
    const newHistory = [connectionToSave, ...connectionHistory.filter(c => {
      const sessionNameMatch = (c.sessionName || c.name || '') === (connection.sessionName || connection.name || '');
      if (connection.connectionType === 'serial') {
        const connectionMatch = c.connectionType === 'serial' && c.serialPort === connection.serialPort;
        // Only remove if both connection info and sessionName match
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
  };

  // Toggle favorite
  const toggleFavorite = (connection) => {
    const isSerial = connection.connectionType === 'serial';
    const isFavorite = isSerial
      ? favorites.some(f => f.connectionType === 'serial' && f.serialPort === connection.serialPort)
      : favorites.some(f => f.host === connection.host && f.user === connection.user);
    
    if (isFavorite) {
      const newFavorites = isSerial
        ? favorites.filter(f => !(f.connectionType === 'serial' && f.serialPort === connection.serialPort))
        : favorites.filter(f => !(f.host === connection.host && f.user === connection.user));
      setFavorites(newFavorites);
      localStorage.setItem('ssh-favorites', JSON.stringify(newFavorites));
    } else {
      const name = connection.sessionName || connection.name || (isSerial
        ? `Serial: ${connection.serialPort}`
        : `${connection.user}@${connection.host}`);
      const newFavorites = [...favorites, { ...connection, name }];
      setFavorites(newFavorites);
      localStorage.setItem('ssh-favorites', JSON.stringify(newFavorites));
    }
  };

  // Remove connection from history
  const removeConnection = (connection) => {
    const isSerial = connection.connectionType === 'serial';
    const sessionNameMatch = (c) => (c.sessionName || c.name || '') === (connection.sessionName || connection.name || '');
    
    const newHistory = isSerial
      ? connectionHistory.filter(c => {
          const connectionMatch = c.connectionType === 'serial' && c.serialPort === connection.serialPort;
          // Only remove if both connection info and sessionName match
          return !(connectionMatch && sessionNameMatch(c));
        })
      : connectionHistory.filter(c => {
          const connectionMatch = c.host === connection.host && 
                                 c.user === connection.user && 
                                 (c.port || '22') === (connection.port || '22');
          // Only remove if both connection info and sessionName match
          return !(connectionMatch && sessionNameMatch(c));
        });
    
    setConnectionHistory(newHistory);
    localStorage.setItem('ssh-connections', JSON.stringify(newHistory));
    
    // Also remove from favorites if it's favorited (check by connection info and sessionName)
    const isFavorite = isSerial
      ? favorites.some(f => {
          const connectionMatch = f.connectionType === 'serial' && f.serialPort === connection.serialPort;
          const nameMatch = (f.name || '') === (connection.sessionName || connection.name || '');
          return connectionMatch && nameMatch;
        })
      : favorites.some(f => {
          const connectionMatch = f.host === connection.host && f.user === connection.user;
          const nameMatch = (f.name || '') === (connection.sessionName || connection.name || '');
          return connectionMatch && nameMatch;
        });
    
    if (isFavorite) {
      const newFavorites = isSerial
        ? favorites.filter(f => {
            const connectionMatch = f.connectionType === 'serial' && f.serialPort === connection.serialPort;
            const nameMatch = (f.name || '') === (connection.sessionName || connection.name || '');
            return !(connectionMatch && nameMatch);
          })
        : favorites.filter(f => {
            const connectionMatch = f.host === connection.host && f.user === connection.user;
            const nameMatch = (f.name || '') === (connection.sessionName || connection.name || '');
            return !(connectionMatch && nameMatch);
          });
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

