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
  const appendToLog = (sessionId, data) => {
    if (!sessionLogs.current[sessionId]) return;
    
    const logSession = sessionLogs.current[sessionId];
    
    // Fast string append - synchronous, no blocking
    logSession.content += data;
    logSession.bufferSize += data.length;
    
    // Optimized line count - only count if we're close to flush threshold
    if (logSession.bufferSize > 8000) { // Only count when approaching 10KB
      logSession.lineCount = (logSession.content.match(/\n/g) || []).length;
    } else {
      // Fast increment for small data
      for (let i = 0; i < data.length; i++) {
        if (data[i] === '\n') logSession.lineCount++;
      }
    }
    
    // Schedule flush asynchronously - don't block input
    if (logSession.isLogging && (logSession.lineCount >= 100 || logSession.bufferSize >= 10240)) {
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
    if (!logSession || !logSession.content) return;
    
    try {
      const session = sessions.find(s => s.id === sessionId);
      const sessionName = session ? session.name.replace(/[^a-zA-Z0-9]/g, '_') : `session_${sessionId}`;
      
      // Find group for this session by matching connection info with savedSessions
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
      
      const result = await window.electronAPI.saveLogToFile(sessionId, logSession.content, sessionName, groupName);
      
      if (result.success) {
        logSession.filePath = result.filePath;
        console.log(`Log flushed to file: ${result.filePath}`);
        
        // Reset buffer
        logSession.content = '';
        logSession.bufferSize = 0;
        logSession.lineCount = 0;
      }
    } catch (error) {
      console.error('Failed to flush log to file:', error);
    }
  };

  const startLogging = (sessionId) => {
    if (!sessionLogs.current[sessionId]) {
      sessionLogs.current[sessionId] = {
        content: '',
        startTime: new Date().toISOString(),
        isLogging: true,
        bufferSize: 0,
        lineCount: 0,
        filePath: null
      };
    } else {
      sessionLogs.current[sessionId].isLogging = true;
    }
    
    // Update UI state
    setLogStates(prev => ({
      ...prev,
      [sessionId]: { isLogging: true }
    }));
    
    // Add log entry when starting
    const logEntry = `\r\n[${new Date().toLocaleTimeString()}] Logging started\r\n`;
    appendToLog(sessionId, logEntry);
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
    
    return logEntry;
  };

  const saveLog = async (sessionId) => {
    if (sessionLogs.current[sessionId]) {
      // Flush current buffer to file first
      await flushLogToFile(sessionId);
      
      const logSession = sessionLogs.current[sessionId];
      if (logSession.filePath) {
        // Show success message with file path
        console.log(`Log saved to: ${logSession.filePath}`);
        alert(`Log saved to: ${logSession.filePath}`);
      } else {
        alert('No log data to save');
      }
    }
  };

  const clearLog = (sessionId) => {
    if (sessionLogs.current[sessionId]) {
      sessionLogs.current[sessionId].content = '';
      sessionLogs.current[sessionId].bufferSize = 0;
      sessionLogs.current[sessionId].lineCount = 0;
      sessionLogs.current[sessionId].filePath = null;
      console.log(`Log cleared for session ${sessionId}`);
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

