import { useState, useRef } from 'react';

/**
 * Custom hook for session logging management
 */
export function useLogging(sessions, groups) {
  const sessionLogs = useRef({});
  const [logStates, setLogStates] = useState({});

  const appendToLog = async (sessionId, data) => {
    if (!sessionLogs.current[sessionId]) return;
    
    const logSession = sessionLogs.current[sessionId];
    logSession.content += data;
    logSession.bufferSize += data.length;
    logSession.lineCount += (data.match(/\n/g) || []).length;
    
    // Check if we need to flush to file
    const shouldFlush = logSession.lineCount >= 100 || logSession.bufferSize >= 10240; // 10KB
    
    if (shouldFlush && logSession.isLogging) {
      await flushLogToFile(sessionId);
    }
  };

  const flushLogToFile = async (sessionId) => {
    const logSession = sessionLogs.current[sessionId];
    if (!logSession || !logSession.content) return;
    
    try {
      const session = sessions.find(s => s.id === sessionId);
      const sessionName = session ? session.name.replace(/[^a-zA-Z0-9]/g, '_') : `session_${sessionId}`;
      
      // Find group for this session
      const group = groups.find(g => g.sessionIds.includes(sessionId));
      const groupName = group ? group.name.replace(/[^a-zA-Z0-9]/g, '_') : 'default';
      
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

