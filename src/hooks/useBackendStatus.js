import { useState, useEffect, useRef } from 'react';
import QwenAgentService from '../services/qwen-agent-service';

/**
 * Hook to monitor backend status
 * @param {boolean} enabled - Whether to start monitoring (e.g., when AIChatSidebar is visible)
 * @returns {string} Status: 'ready' | 'starting' | 'not-ready'
 */
export function useBackendStatus(enabled = true) {
  const [status, setStatus] = useState('not-ready');
  const intervalRef = useRef(null);
  const startingTimeoutRef = useRef(null);
  const qwenAgentServiceRef = useRef(null);
  const isStartingRef = useRef(false); // Track if backend start is in progress

  // Initialize service once
  useEffect(() => {
    if (!qwenAgentServiceRef.current) {
      qwenAgentServiceRef.current = new QwenAgentService();
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Stop monitoring when disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (startingTimeoutRef.current) {
        clearTimeout(startingTimeoutRef.current);
        startingTimeoutRef.current = null;
      }
      return;
    }

    // Check health immediately and start backend if needed
    const checkHealthAndStart = async () => {
      try {
        const isHealthy = await qwenAgentServiceRef.current.checkHealth();
        if (isHealthy) {
          setStatus('ready');
          // Clear starting timeout if health check succeeds
          if (startingTimeoutRef.current) {
            clearTimeout(startingTimeoutRef.current);
            startingTimeoutRef.current = null;
          }
          isStartingRef.current = false;
        } else {
          // If not healthy and not already starting, try to start backend
          if (!isStartingRef.current) {
            // Try to start backend automatically
            console.log('[useBackendStatus] Backend not healthy, attempting to start...');
            if (window.electronAPI && window.electronAPI.startBackend) {
              console.log('[useBackendStatus] Starting backend via electronAPI...');
              isStartingRef.current = true;
              setStatus('starting');
              try {
                const startResult = await window.electronAPI.startBackend();
                console.log('[useBackendStatus] Backend start result:', startResult);
                if (!startResult.success) {
                  console.error('Failed to start backend:', startResult.error);
                  setStatus('not-ready');
                  isStartingRef.current = false;
                  return;
                }
                // Wait for backend to become ready
                let retries = 30; // 30 seconds timeout
                while (retries > 0) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  const isHealthyNow = await qwenAgentServiceRef.current.checkHealth();
                  if (isHealthyNow) {
                    setStatus('ready');
                    if (startingTimeoutRef.current) {
                      clearTimeout(startingTimeoutRef.current);
                      startingTimeoutRef.current = null;
                    }
                    isStartingRef.current = false;
                    return;
                  }
                  retries--;
                }
                // Timeout
                setStatus('not-ready');
                isStartingRef.current = false;
              } catch (error) {
                console.error('Error starting backend:', error);
                setStatus('not-ready');
                isStartingRef.current = false;
              }
            } else {
              console.warn('[useBackendStatus] window.electronAPI.startBackend is not available');
              setStatus('not-ready');
            }
          }
        }
      } catch (error) {
        console.error('[useBackendStatus] Health check error:', error);
        // If health check throws an error and we're not starting, try to start backend
        if (!isStartingRef.current) {
          console.log('[useBackendStatus] Health check threw error, attempting to start backend...');
          if (window.electronAPI && window.electronAPI.startBackend) {
            console.log('[useBackendStatus] Starting backend via electronAPI (from catch)...');
            isStartingRef.current = true;
            setStatus('starting');
            try {
              const startResult = await window.electronAPI.startBackend();
              console.log('[useBackendStatus] Backend start result (from catch):', startResult);
              if (!startResult.success) {
                console.error('Failed to start backend:', startResult.error);
                setStatus('not-ready');
                isStartingRef.current = false;
                return;
              }
              // Wait for backend to become ready
              let retries = 30; // 30 seconds timeout
              while (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const isHealthyNow = await qwenAgentServiceRef.current.checkHealth();
                if (isHealthyNow) {
                  setStatus('ready');
                  if (startingTimeoutRef.current) {
                    clearTimeout(startingTimeoutRef.current);
                    startingTimeoutRef.current = null;
                  }
                  isStartingRef.current = false;
                  return;
                }
                retries--;
              }
              // Timeout
              setStatus('not-ready');
              isStartingRef.current = false;
            } catch (startError) {
              console.error('Error starting backend:', startError);
              setStatus('not-ready');
              isStartingRef.current = false;
            }
          } else {
            console.warn('[useBackendStatus] window.electronAPI.startBackend is not available (from catch)');
            setStatus('not-ready');
          }
        }
      }
    };

    // Check health and start backend if needed
    checkHealthAndStart();

    // Set up interval for periodic checks (every 5 seconds)
    intervalRef.current = setInterval(checkHealthAndStart, 5000);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (startingTimeoutRef.current) {
        clearTimeout(startingTimeoutRef.current);
        startingTimeoutRef.current = null;
      }
    };
  }, [enabled]); // Only depend on enabled, not status to avoid infinite loops

  /**
   * Manually set status to 'starting' (useful when triggering backend start)
   * This will automatically revert to 'not-ready' or 'ready' based on health check
   */
  const setStarting = () => {
    setStatus('starting');
    // Auto-revert to not-ready after 30 seconds if still not ready
    if (startingTimeoutRef.current) {
      clearTimeout(startingTimeoutRef.current);
    }
    startingTimeoutRef.current = setTimeout(() => {
      if (status === 'starting') {
        setStatus('not-ready');
      }
    }, 30000);
  };

  return { status, setStarting };
}

