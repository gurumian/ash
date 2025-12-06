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

    // Check health immediately
    const checkHealth = async () => {
      try {
        const isHealthy = await qwenAgentServiceRef.current.checkHealth();
        if (isHealthy) {
          setStatus('ready');
          // Clear starting timeout if health check succeeds
          if (startingTimeoutRef.current) {
            clearTimeout(startingTimeoutRef.current);
            startingTimeoutRef.current = null;
          }
        } else {
          // If not healthy and not already starting, set to not-ready
          if (status !== 'starting') {
            setStatus('not-ready');
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[useBackendStatus] Health check failed:', error.message);
        }
        if (status !== 'starting') {
          setStatus('not-ready');
        }
      }
    };

    // Initial check
    checkHealth();

    // Set up interval for periodic checks (every 5 seconds)
    intervalRef.current = setInterval(checkHealth, 5000);

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
  }, [enabled, status]);

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

