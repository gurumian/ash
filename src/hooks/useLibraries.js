import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for library/cheat-sheet management
 */
export function useLibraries() {
  const [libraries, setLibraries] = useState(() => {
    const saved = localStorage.getItem('ash-libraries');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure all libraries have required fields
        return parsed.map(lib => ({
          id: lib.id || Date.now().toString() + Math.random(),
          name: lib.name || 'Unnamed Library',
          description: lib.description || '',
          commands: lib.commands || [],
          isExpanded: lib.isExpanded !== undefined ? lib.isExpanded : false,
          createdAt: lib.createdAt || new Date().toISOString(),
          updatedAt: lib.updatedAt || new Date().toISOString()
        }));
      } catch (e) {
        console.error('Failed to parse libraries from localStorage:', e);
        return [];
      }
    }
    return [];
  });

  const isInitialLibrariesLoad = useRef(true);

  // Sync libraries to localStorage whenever libraries state changes (skip initial mount)
  useEffect(() => {
    if (isInitialLibrariesLoad.current) {
      isInitialLibrariesLoad.current = false;
      return; // Skip on initial mount
    }
    const serialized = JSON.stringify(libraries);
    localStorage.setItem('ash-libraries', serialized);
  }, [libraries]);

  // Save libraries to localStorage
  const saveLibraries = (newLibraries) => {
    setLibraries(newLibraries);
    localStorage.setItem('ash-libraries', JSON.stringify(newLibraries));
  };

  // Library management functions
  const createLibrary = (name, description = '') => {
    const newLibrary = {
      id: Date.now().toString() + Math.random(),
      name: name || `Library ${libraries.length + 1}`,
      description: description,
      commands: [],
      isExpanded: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveLibraries([...libraries, newLibrary]);
    return newLibrary; // Return the library object instead of just the ID
  };

  const updateLibrary = (libraryId, updates) => {
    saveLibraries(libraries.map(lib => 
      lib.id === libraryId 
        ? { ...lib, ...updates, updatedAt: new Date().toISOString() }
        : lib
    ));
  };

  const deleteLibrary = (libraryId) => {
    saveLibraries(libraries.filter(lib => lib.id !== libraryId));
  };

  const toggleLibraryExpanded = (libraryId) => {
    saveLibraries(libraries.map(lib => 
      lib.id === libraryId ? { ...lib, isExpanded: !lib.isExpanded } : lib
    ));
  };

  const addCommandToLibrary = (libraryId, command, description = '') => {
    saveLibraries(libraries.map(lib => {
      if (lib.id === libraryId) {
        const newCommand = {
          id: Date.now().toString() + Math.random(),
          command: command,
          description: description,
          enabled: true
        };
        return {
          ...lib,
          commands: [...lib.commands, newCommand],
          updatedAt: new Date().toISOString()
        };
      }
      return lib;
    }));
  };

  const updateCommandInLibrary = (libraryId, commandId, updates) => {
    saveLibraries(libraries.map(lib => {
      if (lib.id === libraryId) {
        return {
          ...lib,
          commands: lib.commands.map(cmd =>
            cmd.id === commandId ? { ...cmd, ...updates } : cmd
          ),
          updatedAt: new Date().toISOString()
        };
      }
      return lib;
    }));
  };

  const removeCommandFromLibrary = (libraryId, commandId) => {
    saveLibraries(libraries.map(lib => {
      if (lib.id === libraryId) {
        return {
          ...lib,
          commands: lib.commands.filter(cmd => cmd.id !== commandId),
          updatedAt: new Date().toISOString()
        };
      }
      return lib;
    }));
  };

  const reorderCommandsInLibrary = (libraryId, fromIndex, toIndex) => {
    saveLibraries(libraries.map(lib => {
      if (lib.id === libraryId) {
        const newCommands = [...lib.commands];
        const [moved] = newCommands.splice(fromIndex, 1);
        newCommands.splice(toIndex, 0, moved);
        return {
          ...lib,
          commands: newCommands,
          updatedAt: new Date().toISOString()
        };
      }
      return lib;
    }));
  };

  const importLibrary = (libraryData) => {
    // Generate new ID and timestamps for imported library
    const importedLibrary = {
      ...libraryData,
      id: Date.now().toString() + Math.random(),
      createdAt: libraryData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isExpanded: false
    };
    saveLibraries([...libraries, importedLibrary]);
    return importedLibrary;
  };

  return {
    libraries,
    setLibraries,
    saveLibraries,
    createLibrary,
    updateLibrary,
    deleteLibrary,
    toggleLibraryExpanded,
    addCommandToLibrary,
    updateCommandInLibrary,
    removeCommandFromLibrary,
    reorderCommandsInLibrary,
    importLibrary
  };
}

