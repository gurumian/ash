import { useState, useRef } from 'react';

/**
 * Custom hook for session logging management
 * Optimized for minimal input latency
 */
export function useLogging(sessions, groups) {
  const sessionLogs = useRef({});
  const [logStates, setLogStates] = useState({});
  const flushTimeouts = useRef({});
  const flushPending = useRef({});

  // Fast synchronous append - no blocking operations
  // Maximum buffer size: 1MB per session to prevent excessive memory usage
  const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB
  
  const appendToLog = (sessionId, data) => {
    if (!sessionLogs.current[sessionId]) return;
    
    const logSession = sessionLogs.current[sessionId];
    
    // Optimized: Use array for efficient string building (avoids string recreation)
    if (!logSession.contentArray) {
      logSession.contentArray = [logSession.content || ''];
    }
    logSession.contentArray.push(data);
    logSession.bufferSize += data.length;
    
    // Optimized line count - only count if we're close to flush threshold
    if (logSession.bufferSize > 8000) { // Only count when approaching 10KB
      // Join array for line count (only when needed)
      const contentStr = logSession.contentArray.join('');
      logSession.lineCount = (contentStr.match(/\n/g) || []).length;
    } else {
      // Fast increment for small data
      for (let i = 0; i < data.length; i++) {
        if (data[i] === '\n') logSession.lineCount++;
      }
    }
    
    // Force flush if buffer exceeds maximum size (memory protection)
    const shouldFlush = logSession.isLogging && (
      logSession.lineCount >= 100 || 
      logSession.bufferSize >= 10240 ||
      logSession.bufferSize >= MAX_BUFFER_SIZE
    );
    
    // Schedule flush asynchronously - don't block input
    if (shouldFlush) {
      // Cancel previous flush timeout
      if (flushTimeouts.current[sessionId]) {
        clearTimeout(flushTimeouts.current[sessionId]);
      }
      
      // Schedule flush in next idle period or after short delay
      flushPending.current[sessionId] = true;
      flushTimeouts.current[sessionId] = setTimeout(() => {
        if (flushPending.current[sessionId]) {
          flushPending.current[sessionId] = false;
          // Use requestIdleCallback if available, otherwise setTimeout
          if (window.requestIdleCallback) {
            window.requestIdleCallback(() => {
              flushLogToFile(sessionId).catch(err => {
                console.error('Failed to flush log:', err);
              });
            }, { timeout: 1000 });
          } else {
            setTimeout(() => {
              flushLogToFile(sessionId).catch(err => {
                console.error('Failed to flush log:', err);
              });
            }, 0);
          }
        }
      }, 0);
    }
  };

  const flushLogToFile = async (sessionId) => {
    const logSession = sessionLogs.current[sessionId];
    if (!logSession) return;
    
    // Join array to string only when flushing (efficient)
    const content = logSession.contentArray ? logSession.contentArray.join('') : logSession.content || '';
    if (!content) return;
    
    try {
      // If filePath exists, append to existing file; otherwise create new one
      if (logSession.filePath) {
        // Append to existing file
        const result = await window.electronAPI.appendLogToFile(sessionId, content, logSession.filePath);
        
        if (result.success) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`Log flushed to file: ${logSession.filePath}`);
          }
          
          // Reset buffer
          logSession.contentArray = [];
          logSession.content = '';
          logSession.bufferSize = 0;
          logSession.lineCount = 0;
        }
      } else {
        // Fallback: create new file (shouldn't happen if startLogging worked)
        const session = sessions.find(s => s.id === sessionId);
        const sessionName = session ? session.name.replace(/[^a-zA-Z0-9]/g, '_') : `session_${sessionId}`;
        
        let groupName = 'default';
        if (session) {
          const group = groups.find(g => {
            if (!g.savedSessions || !Array.isArray(g.savedSessions)) return false;
            return g.savedSessions.some(savedSession => {
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
          if (group) {
            groupName = group.name.replace(/[^a-zA-Z0-9]/g, '_');
          }
        }
        
        const result = await window.electronAPI.saveLogToFile(sessionId, content, sessionName, groupName, true);
        
        if (result.success) {
          logSession.filePath = result.filePath;
          if (process.env.NODE_ENV === 'development') {
            console.log(`Log flushed to file: ${result.filePath}`);
          }
          
          // Reset buffer
          logSession.contentArray = [];
          logSession.content = '';
          logSession.bufferSize = 0;
          logSession.lineCount = 0;
        }
      }
    } catch (error) {
      console.error('Failed to flush log to file:', error);
    }
  };

  const startLogging = async (sessionId) => {
    if (!sessionLogs.current[sessionId]) {
      // Initialize log session and create a single log file for this session
      const session = sessions.find(s => s.id === sessionId);
      const sessionName = session ? session.name.replace(/[^a-zA-Z0-9]/g, '_') : `session_${sessionId}`;
      
      // Find group for this session
      let groupName = 'default';
      if (session) {
        const group = groups.find(g => {
          if (!g.savedSessions || !Array.isArray(g.savedSessions)) return false;
          return g.savedSessions.some(savedSession => {
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
        if (group) {
          groupName = group.name.replace(/[^a-zA-Z0-9]/g, '_');
        }
      }
      
      // Create initial log file
      const startTime = new Date().toISOString();
      const initialContent = `[${new Date().toLocaleString()}] Logging started\r\n`;
      const result = await window.electronAPI.saveLogToFile(sessionId, initialContent, sessionName, groupName, true);
      
      sessionLogs.current[sessionId] = {
        content: '',
        contentArray: [], // Optimized: use array for efficient string building
        startTime: startTime,
        isLogging: true,
        bufferSize: 0,
        lineCount: 0,
        filePath: result.success ? result.filePath : null
      };
    } else {
      // Start new recording session - create a new file
      const session = sessions.find(s => s.id === sessionId);
      const sessionName = session ? session.name.replace(/[^a-zA-Z0-9]/g, '_') : `session_${sessionId}`;
      
      // Find group for this session
      let groupName = 'default';
      if (session) {
        const group = groups.find(g => {
          if (!g.savedSessions || !Array.isArray(g.savedSessions)) return false;
          return g.savedSessions.some(savedSession => {
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
        if (group) {
          groupName = group.name.replace(/[^a-zA-Z0-9]/g, '_');
        }
      }
      
      // Create new log file for this recording session
      const startTime = new Date().toISOString();
      const initialContent = `[${new Date().toLocaleString()}] Logging started\r\n`;
      const result = await window.electronAPI.saveLogToFile(sessionId, initialContent, sessionName, groupName, true);
      
      sessionLogs.current[sessionId].isLogging = true;
      sessionLogs.current[sessionId].startTime = startTime;
      sessionLogs.current[sessionId].content = '';
      sessionLogs.current[sessionId].contentArray = []; // Optimized: reset array
      sessionLogs.current[sessionId].bufferSize = 0;
      sessionLogs.current[sessionId].lineCount = 0;
      sessionLogs.current[sessionId].filePath = result.success ? result.filePath : null;
    }
    
    // Update UI state with startTime
    setLogStates(prev => ({
      ...prev,
      [sessionId]: { 
        isLogging: true,
        startTime: sessionLogs.current[sessionId]?.startTime || new Date().toISOString()
      }
    }));
  };

  const stopLogging = async (sessionId) => {
    if (sessionLogs.current[sessionId]) {
      sessionLogs.current[sessionId].isLogging = false;
    }
    
    // Update UI state
    setLogStates(prev => ({
      ...prev,
      [sessionId]: { isLogging: false }
    }));
    
    // Add log entry when stopping
    const logEntry = `\r\n[${new Date().toLocaleTimeString()}] Logging stopped\r\n`;
    await appendToLog(sessionId, logEntry);
    
    // Flush any remaining data to file
    await flushLogToFile(sessionId);
    
    // Clear filePath so next recording session creates a new file
    if (sessionLogs.current[sessionId]) {
      sessionLogs.current[sessionId].filePath = null;
    }
    
    return logEntry;
  };

  const saveLog = async (sessionId) => {
    if (sessionLogs.current[sessionId]) {
      const logSession = sessionLogs.current[sessionId];
      
      // Flush current buffer to file (append mode)
      await flushLogToFile(sessionId);
      
      if (logSession.filePath) {
        // Show success message with file path
        if (process.env.NODE_ENV === 'development') {
          console.log(`Log saved to: ${logSession.filePath}`);
        }
        alert(`Log saved to: ${logSession.filePath}`);
      } else {
        alert('No log data to save');
      }
    }
  };

  const clearLog = (sessionId) => {
    if (sessionLogs.current[sessionId]) {
      sessionLogs.current[sessionId].content = '';
      sessionLogs.current[sessionId].contentArray = []; // Optimized: reset array
      sessionLogs.current[sessionId].bufferSize = 0;
      sessionLogs.current[sessionId].lineCount = 0;
      sessionLogs.current[sessionId].filePath = null;
      if (process.env.NODE_ENV === 'development') {
        console.log(`Log cleared for session ${sessionId}`);
      }
    }
  };

  const cleanupLog = async (sessionId) => {
    // Clear flush timeout
    if (flushTimeouts.current[sessionId]) {
      clearTimeout(flushTimeouts.current[sessionId]);
      delete flushTimeouts.current[sessionId];
    }
    delete flushPending.current[sessionId];
    
    if (sessionLogs.current[sessionId]) {
      // Flush any remaining data before cleanup
      if (sessionLogs.current[sessionId].isLogging) {
        await flushLogToFile(sessionId);
      }
      delete sessionLogs.current[sessionId];
    }
    
    // Clean up log states
    setLogStates(prev => {
      const newStates = { ...prev };
      delete newStates[sessionId];
      return newStates;
    });
  };

  return {
    sessionLogs,
    logStates,
    appendToLog,
    startLogging,
    stopLogging,
    saveLog,
    clearLog,
    cleanupLog
  };
}

