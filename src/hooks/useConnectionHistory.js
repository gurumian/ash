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
    
    // For SSH connections, check by host/user/port
    // For Serial connections, check by serialPort
    const newHistory = [connectionToSave, ...connectionHistory.filter(c => {
      if (connection.connectionType === 'serial') {
        return !(c.connectionType === 'serial' && c.serialPort === connection.serialPort);
      } else {
        return !(c.host === connection.host && c.user === connection.user && (c.port || '22') === (connection.port || '22'));
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
    const newHistory = isSerial
      ? connectionHistory.filter(c => !(c.connectionType === 'serial' && c.serialPort === connection.serialPort))
      : connectionHistory.filter(c => !(c.host === connection.host && c.user === connection.user && (c.port || '22') === (connection.port || '22')));
    
    setConnectionHistory(newHistory);
    localStorage.setItem('ssh-connections', JSON.stringify(newHistory));
    
    // Also remove from favorites if it's favorited
    const isFavorite = isSerial
      ? favorites.some(f => f.connectionType === 'serial' && f.serialPort === connection.serialPort)
      : favorites.some(f => f.host === connection.host && f.user === connection.user);
    
    if (isFavorite) {
      const newFavorites = isSerial
        ? favorites.filter(f => !(f.connectionType === 'serial' && f.serialPort === connection.serialPort))
        : favorites.filter(f => !(f.host === connection.host && f.user === connection.user));
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

