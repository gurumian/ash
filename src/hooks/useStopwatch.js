import { useState, useRef, useEffect } from 'react';

/**
 * Custom hook for managing stopwatch state per session
 * Each terminal session has its own independent stopwatch
 */
export function useStopwatch() {
  const [stopwatchStates, setStopwatchStates] = useState({});
  const intervalsRef = useRef({});

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(intervalsRef.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, []);

  const getStopwatchState = (sessionId) => {
    return stopwatchStates[sessionId] || {
      isRunning: false,
      elapsed: 0,
      startTime: null
    };
  };

  const startStopwatch = (sessionId) => {
    const currentState = getStopwatchState(sessionId);
    if (currentState.isRunning) return;

    const now = Date.now();
    const baseTime = now - (currentState.elapsed * 1000);
    
    setStopwatchStates(prev => ({
      ...prev,
      [sessionId]: {
        isRunning: true,
        elapsed: currentState.elapsed,
        startTime: baseTime
      }
    }));

    // Clear any existing interval for this session
    if (intervalsRef.current[sessionId]) {
      clearInterval(intervalsRef.current[sessionId]);
    }

    // Set up interval to update elapsed time
    intervalsRef.current[sessionId] = setInterval(() => {
      setStopwatchStates(prev => {
        const state = prev[sessionId];
        if (!state || !state.isRunning || !state.startTime) return prev;
        
        const now = Date.now();
        const diff = Math.floor((now - state.startTime) / 1000);
        
        return {
          ...prev,
          [sessionId]: {
            ...state,
            elapsed: diff
          }
        };
      });
    }, 1000);
  };

  const stopStopwatch = (sessionId) => {
    if (intervalsRef.current[sessionId]) {
      clearInterval(intervalsRef.current[sessionId]);
      intervalsRef.current[sessionId] = null;
    }

    setStopwatchStates(prev => {
      const state = prev[sessionId];
      if (!state) return prev;
      
      return {
        ...prev,
        [sessionId]: {
          ...state,
          isRunning: false
        }
      };
    });
  };

  const resetStopwatch = (sessionId) => {
    if (intervalsRef.current[sessionId]) {
      clearInterval(intervalsRef.current[sessionId]);
      intervalsRef.current[sessionId] = null;
    }

    setStopwatchStates(prev => ({
      ...prev,
      [sessionId]: {
        isRunning: false,
        elapsed: 0,
        startTime: null
      }
    }));
  };

  const cleanupStopwatch = (sessionId) => {
    if (intervalsRef.current[sessionId]) {
      clearInterval(intervalsRef.current[sessionId]);
      delete intervalsRef.current[sessionId];
    }

    setStopwatchStates(prev => {
      const newStates = { ...prev };
      delete newStates[sessionId];
      return newStates;
    });
  };

  return {
    getStopwatchState,
    startStopwatch,
    stopStopwatch,
    resetStopwatch,
    cleanupStopwatch
  };
}
